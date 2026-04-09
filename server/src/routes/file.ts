import express, { Response } from 'express';
import multer from 'multer';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs/promises';
import { pool } from '../db';
import { optionalAuthMiddleware } from '../middleware/auth';
import { generateUniqueFileKey } from '../utils/fileKeyGenerator';
import { AuthRequest } from '../types';
import { Envs, Strings, FileConstants } from '../constants';
import { io } from '../index';
import { downloaderSockets } from '../index';

const router = express.Router();

// 비로그인 최대 파일 업로드 사이즈 (2GB)
const MAX_FILE_SIZE_FREE = parseInt(process.env.MAX_FILE_SIZE_FREE || '2147483648');

// 로그인 시 최대 파일 업로드 사이즈 (100GB)
const MAX_FILE_SIZE_LOGGED_IN = parseInt(process.env.MAX_FILE_SIZE_LOGGED_IN || '107374182400');

// 한 아이피 당 최대 파일 업로드 사이즈 (100GB)
const MAX_STORAGE_PER_IP = parseInt(process.env.MAX_STORAGE_PER_IP || '107374182400');

////////////// multer 관련 - 디스크 저장 (암호화된 청크를 디스크에 저장)
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), FileConstants.UPLOAD_DIR);
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error as Error, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        // 고유한 파일명 생성 (timestamp + random)
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.enc`;
        cb(null, uniqueName);
    }
});
//////////////

const upload = multer({
    storage,
    limits: {
        fileSize: FileConstants.CHUNK_SIZE_WITH_OVERHEAD // 청크 크기 제한 (500MB + 암호화 오버헤드)
    }
});

// Multer 에러 핸들링 미들웨어
const handleMulterError = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ error: '청크 크기가 제한을 초과했습니다. 각 청크는 500MB 이하여야 합니다.' });
            return;
        }
        res.status(400).json({ error: `파일 업로드 오류: ${err.message}` });
        return;
    }
    next(err);
};

/**  express req에서 아이피 얻기  */
function getClientIP(req: express.Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '0.0.0.0';
}

/**  다운로드 키가 존재하는지 확인  */
async function fileKeyExists(key: string): Promise<boolean> {
    const result = await pool.query(`
        SELECT 
            id 
        FROM 
            files 
        WHERE
            file_key = $1 AND deleted_at IS NULL
    `,[key]);

    return result.rows.length > 0;
}

//
// 파일 업로드 초기화 (메타데이터 생성)
//
router.post('/init-upload', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { fileName, fileSize, totalChunks, password, salt, iv } = req.body;
        const clientIP = getClientIP(req);
        const isEncrypted = !!password; // 암호가 있으면 암호화된 것으로 간주

        if (!fileName || !fileSize || !totalChunks) {
            res.status(400).json({ error: '필수 데이터가 누락되었습니다' });
            return;
        }

        // 암호화된 경우 salt, iv 확인
        if (isEncrypted && (!salt || !iv)) {
            res.status(400).json({ error: '암호화 데이터가 누락되었습니다' });
            return;
        }

        const originalSize = parseInt(fileSize);
        const chunks = parseInt(totalChunks);

        // 최대 업로드 크기 확인
        const maxFileSize = req.user ? MAX_FILE_SIZE_LOGGED_IN : MAX_FILE_SIZE_FREE;

        if (originalSize > maxFileSize) {
            res.status(400).json({
                error: req.user
                    ? '파일 크기가 허용된 최대 크기를 초과합니다'
                    : '파일 크기가 2GB를 초과합니다. 더 큰 파일을 업로드하려면 로그인하세요.'
            });
            return;
        }

        // IP당 업로드 총량 확인
        const ipStorageResult = await pool.query(`
            SELECT total_storage FROM ip_storage WHERE ip_address = $1
        `, [clientIP]);

        const currentStorage = ipStorageResult.rows.length > 0
            ? parseInt(ipStorageResult.rows[0].total_storage)
            : 0;

        if (currentStorage + originalSize > MAX_STORAGE_PER_IP) {
            res.status(400).json({
                error: 'IP 주소의 저장 제한을 초과했습니다 (100GB 제한)'
            });
            return;
        }

        // 파일 키 생성
        const fileKey = await generateUniqueFileKey(fileKeyExists);

        // 만료 시간
        const expiresAt = new Date(Date.now() + Envs.fileExpiredMs);

        // 암호 해시화 (암호화된 경우에만)
        const passwordHash = isEncrypted ? await bcrypt.hash(password, 10) : null;

        // 파일 메타데이터 저장
        const result = await pool.query(`
            INSERT INTO files (
                file_key,          -- 1
                file_type,         -- 2
                file_name,         -- 3
                file_size,         -- 4
                total_chunks,      -- 5
                iv,                -- 6
                password_hash,     -- 7
                salt,              -- 8
                is_encrypted,      -- 9
                uploader_ip,       -- 10
                uploader_user_id,  -- 11
                expires_at,        -- 12
                upload_completed   -- 13
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING id
        `, [
            fileKey, 'file', fileName, originalSize, chunks,
            iv || null, passwordHash, salt || null, isEncrypted, clientIP, req.user?.id || null,
            expiresAt, false
        ]);

        const fileId = result.rows[0].id;

        res.json({
            fileId,
            fileKey,
            fileName,
            fileSize: originalSize,
            totalChunks: chunks,
            expiresAt
        });
    } catch (error) {
        console.error('업로드 초기화 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

//
// 청크 업로드 (500MB 단위 암호화 청크)
//
router.post('/upload-chunk', optionalAuthMiddleware, upload.single('chunk'), handleMulterError, async (req: AuthRequest, res: Response) => {
    try {
        const file = req.file;
        const { fileId, chunkIndex } = req.body;

        if (!file || !fileId || chunkIndex === undefined) {
            res.status(400).json({ error: '필수 데이터가 누락되었습니다' });
            return;
        }

        const parsedFileId = parseInt(fileId);
        const parsedChunkIndex = parseInt(chunkIndex);

        // 파일 메타데이터 확인
        const fileResult = await pool.query(`
            SELECT 
                id, total_chunks, upload_completed 
            FROM 
                files 
            WHERE 
                id = $1 AND 
                deleted_at IS NULL
        `, [parsedFileId]);

        if (fileResult.rows.length === 0) {
            res.status(404).json({ error: '파일을 찾을 수 없습니다' });
            return;
        }

        const fileRecord = fileResult.rows[0];

        if (fileRecord.upload_completed) {
            res.status(400).json({ error: '이미 업로드가 완료된 파일입니다' });
            return;
        }

        if (parsedChunkIndex >= fileRecord.total_chunks) {
            res.status(400).json({ error: '잘못된 청크 인덱스입니다' });
            return;
        }

        // 청크 정보 저장
        await pool.query(`
            INSERT INTO 
                file_chunks (file_id, chunk_index, chunk_size, chunk_path)
            VALUES 
                ($1, $2, $3, $4)
            ON CONFLICT 
                (file_id, chunk_index) 
            DO UPDATE SET 
                chunk_size = $3,
                chunk_path = $4
        `, [parsedFileId, parsedChunkIndex, file.size, file.path]);

        res.json({
            success: true,
            chunkIndex: parsedChunkIndex,
            chunkSize: file.size
        });
    } catch (error) {
        console.error('청크 업로드 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

//
// 업로드 완료 처리
//
router.post('/complete-upload', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { fileId } = req.body;
        const clientIP = getClientIP(req);

        if (!fileId) {
            res.status(400).json({ error: '파일 ID가 필요합니다' });
            return;
        }

        const parsedFileId = parseInt(fileId);

        // 파일 정보 조회
        const fileResult = await pool.query(`
            SELECT 
                id, file_size, total_chunks, uploader_ip 
            FROM 
                files 
            WHERE 
                id = $1 AND 
                deleted_at IS NULL
        `, [parsedFileId]);

        if (fileResult.rows.length === 0) {
            res.status(404).json({ error: '파일을 찾을 수 없습니다' });
            return;
        }

        const fileRecord = fileResult.rows[0];

        // 모든 청크가 업로드되었는지 확인
        const chunkResult = await pool.query(`
            SELECT 
                COUNT(*) as count 
            FROM 
                file_chunks 
            WHERE 
                file_id = $1
        `, [parsedFileId]);

        const uploadedChunks = parseInt(chunkResult.rows[0].count);

        if (uploadedChunks !== fileRecord.total_chunks) {
            res.status(400).json({ 
                error: '모든 청크가 업로드되지 않았습니다',
                uploaded: uploadedChunks,
                total: fileRecord.total_chunks
            });
            return;
        }

        // 업로드 완료 표시
        await pool.query(`
            UPDATE
                files 
            SET 
                upload_completed = TRUE 
            WHERE 
                id = $1
        `, [parsedFileId]);

        // IP당 업로드 총량 반영
        const ipStorageResult = await pool.query(`
            SELECT
                total_storage 
            FROM
                ip_storage 
            WHERE 
                ip_address = $1
        `, [clientIP]);

        if (ipStorageResult.rows.length > 0) {
            await pool.query(`
                UPDATE 
                    ip_storage
                SET 
                    total_storage = total_storage + $1, 
                    last_updated = NOW()
                WHERE
                    ip_address = $2
            `, [fileRecord.file_size, clientIP]);
        } else {
            await pool.query(`
                INSERT INTO 
                    ip_storage (ip_address, total_storage)
                VALUES 
                    ($1, $2)
            `, [clientIP, fileRecord.file_size]);
        }

        res.json({
            success: true,
            message: '업로드가 완료되었습니다'
        });
    } catch (error) {
        console.error('업로드 완료 처리 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

//
// 업로드 취소 처리
//
router.post('/cancel-upload', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { fileId } = req.body;

        if (!fileId) {
            res.status(400).json({ error: '파일 ID가 필요합니다' });
            return;
        }

        const parsedFileId = parseInt(fileId);

        // 파일 정보 조회
        const fileResult = await pool.query(`
            SELECT 
                id, upload_completed
            FROM 
                files
            WHERE 
                id = $1 AND 
                deleted_at IS NULL
        `, [parsedFileId]);

        if (fileResult.rows.length === 0) {
            res.status(404).json({ error: '파일을 찾을 수 없습니다' });
            return;
        }

        const fileRecord = fileResult.rows[0];

        // 이미 업로드가 완료된 경우 취소 불가
        if (fileRecord.upload_completed) {
            res.status(400).json({ error: '이미 업로드가 완료된 파일은 취소할 수 없습니다' });
            return;
        }

        // 업로드된 청크 파일들 조회 및 삭제
        const chunkResult = await pool.query(`
            SELECT 
                chunk_path
            FROM 
                file_chunks
            WHERE 
                file_id = $1
        `, [parsedFileId]);

        // 디스크에서 청크 파일들 삭제
        for (const chunk of chunkResult.rows) {
            try {
                await fs.unlink(chunk.chunk_path);
            } catch (err) {
                console.error('청크 파일 삭제 실패:', chunk.chunk_path, err);
            }
        }

        // DB에서 청크 레코드 삭제
        await pool.query(`
            DELETE FROM 
                file_chunks
            WHERE 
                file_id = $1
        `, [parsedFileId]);

        // DB에서 파일 레코드 삭제
        await pool.query(`
            DELETE FROM 
                files
            WHERE 
                id = $1
        `, [parsedFileId]);

        res.json({
            success: true,
            message: '업로드가 취소되었습니다'
        });
    } catch (error) {
        console.error('업로드 취소 처리 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

//
// 공유 중단 (업로드 완료 후 공유 중 삭제)
//
router.delete('/cancel-share/:key', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { key } = req.params;

        if (key.length !== 6) {
            res.status(400).json({ error: '잘못된 파일 키' });
            return;
        }

        const fileResult = await pool.query(`
            SELECT 
                id, file_type, file_size, uploader_ip, upload_completed
            FROM 
                files
            WHERE 
                file_key = $1 AND 
                deleted_at IS NULL AND 
                is_downloaded = FALSE
        `, [key]);

        if (fileResult.rows.length === 0) {
            res.status(404).json({ error: '파일을 찾을 수 없습니다' });
            return;
        }

        const fileRecord = fileResult.rows[0];

        // 파일 타입인 경우 청크 파일 삭제
        if (fileRecord.file_type === 'file') {
            const chunkResult = await pool.query(`
                SELECT 
                    chunk_path 
                FROM 
                    file_chunks 
                WHERE 
                    file_id = $1
            `, [fileRecord.id]);

            for (const chunk of chunkResult.rows) {
                try {
                    await fs.unlink(chunk.chunk_path);
                } catch (err) {
                    console.error('청크 파일 삭제 실패:', chunk.chunk_path, err);
                }
            }

            await pool.query(`DELETE FROM file_chunks WHERE file_id = $1`, [fileRecord.id]);

            // 업로드 완료된 파일이면 IP 스토리지에서 차감
            if (fileRecord.upload_completed) {
                await pool.query(`
                    UPDATE 
                        ip_storage
                    SET 
                        total_storage = GREATEST(0, total_storage - $1), 
                        last_updated = NOW()
                    WHERE 
                        ip_address = $2
                `, [fileRecord.file_size, fileRecord.uploader_ip]);
            }
        }

        await pool.query(`
            DELETE FROM 
                files 
            WHERE 
                id = $1
        `, [fileRecord.id]);

        res.json({ success: true, message: '공유가 중단되었습니다' });

    } catch (error) {
        console.error('공유 중단 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

// Upload text (암호화 선택적)
router.post('/upload-text', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { text, encrypted, iv, password, salt } = req.body;
        const clientIP = getClientIP(req);
        const isEncrypted = !!password;

        // 암호화된 경우와 그렇지 않은 경우 구분
        if (isEncrypted) {
            if (!encrypted || !iv || !salt) {
                res.status(400).json({ error: '암호화된 데이터가 제공되지 않았습니다' });
                return;
            }
        } else {
            if (!text) {
                res.status(400).json({ error: '텍스트가 제공되지 않았습니다' });
                return;
            }
        }

        // 파일 6자리 키 생성
        const fileKey = await generateUniqueFileKey(fileKeyExists);

        // 12시간 만료
        const expiresAt = new Date(Date.now() + Envs.fileExpiredMs);

        // 암호 해시화 (암호화된 경우에만)
        const passwordHash = isEncrypted ? await bcrypt.hash(password, 10) : null;

        // Insert text record
        await pool.query(`
            INSERT INTO
                files (file_key, file_type, encrypted_content, iv, password_hash, salt, is_encrypted, uploader_ip, uploader_user_id, expires_at, upload_completed)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [fileKey, 'text', isEncrypted ? encrypted : text, isEncrypted ? iv : null, passwordHash, isEncrypted ? salt : null, isEncrypted, clientIP, req.user?.id || null, expiresAt, true]);

        res.json({
            fileKey,
            expiresAt
        });

    } catch (error) {
        console.error('텍스트 업로드 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

//
//  URL 업로드 (암호화 선택적)
//  
router.post('/upload-url', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { url, encrypted, iv, password, salt } = req.body;
        const clientIP = getClientIP(req);
        const isEncrypted = !!password;

        // 암호화된 경우와 그렇지 않은 경우 구분
        if (isEncrypted) {
            if (!encrypted || !iv || !salt) {
                res.status(400).json({ error: '암호화된 데이터가 제공되지 않았습니다' });
                return;
            }
        } else {
            if (!url) {
                res.status(400).json({ error: 'URL이 제공되지 않았습니다' });
                return;
            }
        }

        // Generate unique file key
        const fileKey = await generateUniqueFileKey(fileKeyExists);

        // Calculate expiry time (12 hours from now)
        const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

        // 암호 해시화 (암호화된 경우에만)
        const passwordHash = isEncrypted ? await bcrypt.hash(password, 10) : null;

        // Insert URL record
        await pool.query(`
            INSERT INTO
                files (file_key, file_type, encrypted_content, iv, password_hash, salt, is_encrypted, uploader_ip, uploader_user_id, expires_at, upload_completed)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
        ,[fileKey, 'url', isEncrypted ? encrypted : url, isEncrypted ? iv : null, passwordHash, isEncrypted ? salt : null, isEncrypted, clientIP, req.user?.id || null, expiresAt, true]);

        res.json({
            fileKey,
            expiresAt
        });

    } catch (error) {
        console.error('URL 업로드 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

//
//  키로 다운로드
//
router.post('/download/:key', async (req, res: Response) => {
    try {
        const { key } = req.params;
        const { password } = req.body;

        if (key.length !== 6) {
            res.status(400).json({ error: '잘못된 파일 키' });
            return;
        }

        // Get file record
        const result = await pool.query(`
            SELECT * FROM 
                files 
            WHERE
                file_key = $1 AND 
                deleted_at IS NULL AND 
                expires_at > NOW()
        `,[key]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: '파일을 찾을 수 없거나 만료되었습니다' });
            return;
        }

        const fileRecord = result.rows[0];

        // 암호화된 파일인 경우 암호 검증
        if (fileRecord.is_encrypted) {
            if (!password) {
                res.status(400).json({ error: '암호가 필요합니다' });
                return;
            }

            const isPasswordValid = await bcrypt.compare(password, fileRecord.password_hash);
            if (!isPasswordValid) {
                res.status(401).json({ error: '잘못된 암호입니다' });
                return;
            }
        }

        // 텍스트를 다운로드
        if (fileRecord.file_type === 'text') {
            const response: any = {
                type: 'text',
                isEncrypted: fileRecord.is_encrypted
            };
            
            if (fileRecord.is_encrypted) {
                response.encrypted = fileRecord.encrypted_content;
                response.iv = fileRecord.iv;
                response.salt = fileRecord.salt;
            } else {
                response.content = fileRecord.encrypted_content; // 암호화되지 않은 경우 그냥 텍스트
            }
            
            res.json(response);
        } 
        
        // url를 다운로드
        else if (fileRecord.file_type === 'url') {
            const response: any = {
                type: 'url',
                isEncrypted: fileRecord.is_encrypted
            };
            
            if (fileRecord.is_encrypted) {
                response.encrypted = fileRecord.encrypted_content;
                response.iv = fileRecord.iv;
                response.salt = fileRecord.salt;
            } else {
                response.content = fileRecord.encrypted_content; // 암호화되지 않은 경우 그냥 URL
            }
            
            res.json(response);
        } 
        
        // 파일을 다운로드 (청크 메타데이터 반환)
        else if (fileRecord.file_type === 'file') {
            // 업로드가 완료되지 않은 경우
            if (!fileRecord.upload_completed) {
                res.status(400).json({ error: '파일 업로드가 아직 완료되지 않았습니다' });
                return;
            }

            const response: any = {
                type: 'file',
                fileName: fileRecord.file_name,
                fileSize: fileRecord.file_size,
                totalChunks: fileRecord.total_chunks,
                isEncrypted: fileRecord.is_encrypted,
                fileKey: key
            };
            
            if (fileRecord.is_encrypted) {
                response.iv = fileRecord.iv;
                response.salt = fileRecord.salt;
            }
            
            res.json(response);

            return;
        }

        // URL이나 텍스트를 다운로드 -> 파일 다운로드했다고 db에 표시하기
        await pool.query(`
            UPDATE 
                files
            SET 
                is_downloaded = TRUE,
                deleted_at = NOW() 
            WHERE
                id = $1`
        ,[fileRecord.id]);

        // Socket.IO로 업로더에게 다운로드 알림
        io.to(`file-${key}`).emit('file-downloaded', {
            fileKey: key,
            fileName: fileRecord.file_name,
            fileType: fileRecord.file_type,
            downloadedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('다운로드 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

//
// 청크 다운로드
//
router.get('/download-chunk/:key/:chunkIndex', async (req, res: Response) => {
    try {
        const { key, chunkIndex } = req.params;
        const parsedChunkIndex = parseInt(chunkIndex);

        if (key.length !== 6) {
            res.status(400).json({ error: '잘못된 파일 키' });
            return;
        }

        // 파일 레코드 조회
        const fileResult = await pool.query(`
            SELECT
                id, file_type, total_chunks, upload_completed
            FROM 
                files
            WHERE 
                file_key = $1 AND 
                deleted_at IS NULL AND 
                expires_at > NOW()
        `, [key]);

        if (fileResult.rows.length === 0) {
            res.status(404).json({ error: '파일을 찾을 수 없거나 만료되었습니다' });
            return;
        }

        const fileRecord = fileResult.rows[0];

        if (fileRecord.file_type !== 'file') {
            res.status(400).json({ error: '파일 타입만 청크 다운로드가 가능합니다' });
            return;
        }

        if (!fileRecord.upload_completed) {
            res.status(400).json({ error: '파일 업로드가 아직 완료되지 않았습니다' });
            return;
        }

        if (parsedChunkIndex < 0 || parsedChunkIndex >= fileRecord.total_chunks) {
            res.status(400).json({ error: '잘못된 청크 인덱스' });
            return;
        }

        // 청크 정보 조회
        const chunkResult = await pool.query(`
            SELECT
                chunk_path, chunk_size
            FROM 
                file_chunks
            WHERE 
                file_id = $1 AND
                chunk_index = $2
        `, [fileRecord.id, parsedChunkIndex]);

        if (chunkResult.rows.length === 0) {
            res.status(404).json({ error: '청크를 찾을 수 없습니다' });
            return;
        }

        const chunk = chunkResult.rows[0];

        // 청크 파일 스트리밍
        const chunkPath = path.resolve(chunk.chunk_path);
        
        // 파일 존재 확인
        try {
            await fs.access(chunkPath);
        } catch {
            res.status(404).json({ error: '청크 파일을 찾을 수 없습니다' });
            return;
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', chunk.chunk_size);
        res.setHeader('X-Chunk-Index', parsedChunkIndex.toString());

        const fileStream = require('fs').createReadStream(chunkPath);
        fileStream.pipe(res);

        fileStream.on('end', () => {
            const progress = Math.round(((parsedChunkIndex + 1) / fileRecord.total_chunks) * 100);
            io.to(`file-${key}`).emit('file-download-progress', {
                fileKey: key,
                progress
            });
        });

        fileStream.on('error', (error: Error) => {
            console.error('청크 스트리밍 오류:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: '청크 전송 실패' });
            }
        });

    } catch (error) {
        console.error('청크 다운로드 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

//
// 파일 다운로드 완료 처리
//
router.post('/complete-download/:key', async (req, res: Response) => {
    try {
        const { key } = req.params;

        if (key.length !== 6) {
            res.status(400).json({ error: '잘못된 파일 키' });
            return;
        }

        // 파일 레코드 조회
        const fileResult = await pool.query(`
            SELECT
                id, file_name, file_size, file_type, uploader_ip
            FROM 
                files
            WHERE 
                file_key = $1 AND
                deleted_at IS NULL
        `, [key]);

        if (fileResult.rows.length === 0) {
            res.status(404).json({ error: '파일을 찾을 수 없습니다' });
            return;
        }

        const fileRecord = fileResult.rows[0];

        // 파일 타입인 경우 청크 파일들을 디스크에서 삭제
        if (fileRecord.file_type === 'file') {
            const chunkResult = await pool.query(`
                SELECT
                    chunk_path
                FROM 
                    file_chunks 
                WHERE 
                    file_id = $1
            `, [fileRecord.id]);

            for (const chunk of chunkResult.rows) {
                try {
                    const chunkPath = path.resolve(chunk.chunk_path);
                    await fs.unlink(chunkPath);
                } catch (error) {
                    console.error(`청크 파일 삭제 실패 (${chunk.chunk_path}):`, error);
                }
            }

            // 청크 레코드 삭제
            await pool.query(`
                DELETE FROM 
                    file_chunks 
                WHERE 
                    file_id = $1
            `, [fileRecord.id]);
        }

        // 다운로드 완료 처리
        await pool.query(`
            UPDATE 
                files 
            SET 
                is_downloaded = TRUE, 
                deleted_at = NOW() 
            WHERE 
                id = $1
        `, [fileRecord.id]);

        // IP당 업로드 총량 차감
        await pool.query(`
            UPDATE
                ip_storage
            SET 
                total_storage = GREATEST(total_storage - $1, 0), 
                last_updated = NOW()
            WHERE 
                ip_address = $2
        `, [fileRecord.file_size, fileRecord.uploader_ip]);

        /////
        ///// 업로더한테 다운로드 완료 알림
        /////

        // 다운로더 소켓 등록 해제
        downloaderSockets.delete(key);
        
        io.to(`file-${key}`).emit('file-downloaded', {
            fileKey: key,
            fileName: fileRecord.file_name,
            fileType: fileRecord.file_type,
            downloadedAt: new Date().toISOString()
        });

        res.json({ success: true });

    } catch (error) {
        console.error('다운로드 완료 처리 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

export default router;
