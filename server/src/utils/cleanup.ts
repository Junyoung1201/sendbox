import { pool } from '../db';
import fs from 'fs/promises';
import path from 'path';

/**
 *  만료된 파일 DB에서 삭제 및 디스크에서 청크 파일 삭제
 */
export async function cleanupExpiredFiles(): Promise<void> {
    try {
        const result = await pool.query(`
            SELECT 
                id, file_size, file_type, uploader_ip 
            FROM 
                files 
            WHERE
                expires_at < NOW() AND deleted_at IS NULL
        `);

        for (const file of result.rows) {
            // 파일 타입인 경우 청크 파일들을 디스크에서 삭제
            if (file.file_type === 'file') {
                const chunkResult = await pool.query(`
                    SELECT chunk_path FROM file_chunks WHERE file_id = $1
                `, [file.id]);

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
                    DELETE FROM file_chunks WHERE file_id = $1
                `, [file.id]);
            }

            // IP당 파일 업로드 크기 업데이트 
            if (file.file_size > 0) {
                await pool.query(`
                    UPDATE 
                        ip_storage 
                    SET
                        total_storage = GREATEST(total_storage - $1, 0),
                        last_updated = NOW()
                    WHERE
                        ip_address = $2
                `,[file.file_size, file.uploader_ip]);
            }

            // 파일 언제 삭제됐는지 기록하기
            await pool.query(`
                UPDATE 
                    files 
                SET
                    deleted_at = NOW() 
                WHERE
                    id = $1
            `,[file.id]);
        }

        if (result.rows.length > 0) {
            console.log(`${result.rows.length}개의 만료된 파일을 삭제했습니다.`);
        }
    } catch (error) {
        console.error('만료 파일 청소 중 오류가 발생했습니다:', error);
    }
}

/**
 *  1시간 마다 12시간 초과된 파일 청소하는 타이머
 */
export function startCleanupInterval(): void {
    cleanupExpiredFiles();
    setInterval(cleanupExpiredFiles, 60 * 60 * 1000);
}
