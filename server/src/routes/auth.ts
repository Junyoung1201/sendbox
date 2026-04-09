import express, { Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db';
import { generateToken } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { Envs, Strings } from '../constants';

const router = express.Router();

//
//  회원가입
//
router.post('/register', async (req, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: '올바르지 않은 요청입니다.' });
            return;
        }

        // 이미 유저 있음
        const existingUser = await pool.query(`
            SELECT id FROM users WHERE email = $1
        `,[email]);

        if (existingUser.rows.length > 0) {
            res.status(400).json({ error: '이미 존재하는 사용자입니다' });
            return;
        }

        // 비밀번호 단방향 암호화
        const hashedPassword = await bcrypt.hash(password, 10);

        // 유저 데이터 insert
        const result = await pool.query(`
            INSERT INTO 
                users (email, password)
            VALUES 
                ($1, $2)
            RETURNING
                id, email, created_at
        `,[email, hashedPassword]);

        const user = result.rows[0];
        const token = generateToken({ id: user.id, email: user.email });

        res.cookie(Envs.jwtCookieKey, token, {
            httpOnly: true,
            secure: Envs.cookieSecure,
            maxAge: Envs.jwtCookieExpired,
            sameSite: Envs.cookieSameSite
        });

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('회원가입 실패:', error);
        res.status(500).json({ error: '내부 서버 오류' });
    }
});

//
//  로그인
//
router.post('/login', async (req, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: '이메일과 비밀번호가 필요합니다' });
            return;
        }

        // 유저가 존재하는지 확인
        const result = await pool.query(`
            SELECT
                id, email, password 
            FROM
                users 
            WHERE 
                email = $1
        `,[email]);

        if (result.rows.length === 0) {
            res.status(401).json({ error: '잘못된 인증 정보' });
            return;
        }

        const user = result.rows[0];

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            res.status(401).json({ error: '잘못된 인증 정보' });
            return;
        }

        const token = generateToken({ id: user.id, email: user.email });

        res.cookie(Envs.jwtCookieKey, token, {
            httpOnly: true,
            secure: Envs.cookieSecure,
            maxAge: Envs.jwtCookieExpired,
            sameSite: Envs.cookieSameSite
        });

        res.json({
            user: {
                id: user.id,
                email: user.email
            }
        });
    } catch (error) {
        console.error('로그인 실패:', error);
        res.status(500).json({ error: '내부 서버 오류' });
    }
});

//
//  로그아웃
//
router.post('/logout', (req, res: Response) => {
    res.clearCookie(Envs.jwtCookieKey);
    res.json({ message: '로그아웃 성공' });
});

//
//  유저 정보 확인
//
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT id, email, created_at FROM users WHERE id = $1',
            [req.user!.id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
            return;
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('유저 정보 조회 실패:', error);
        res.status(500).json({ error: '내부 서버 오류' });
    }
});

//
//  비밀번호 변경
//
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: '현재 비밀번호와 새 비밀번호가 필요합니다' });
            return;
        }

        // 기존 암호화된 비밀번호 얻기
        const result = await pool.query(`
            SELECT 
                password 
            FROM 
                users 
            WHERE 
                id = $1`
        ,[req.user!.id]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
            return;
        }

        const user = result.rows[0];

        // 기존 비밀번호 일치하는지 확인
        const isValid = await bcrypt.compare(currentPassword, user.password);

        if (!isValid) {
            res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
            return;
        }

        // 새로운 비밀번호 암호화하고 db에 저장
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(`
            UPDATE 
                users 
            SET 
                password = $1 
            WHERE
                id = $2`
        ,[hashedPassword, req.user!.id]);

        res.json({ message: '비밀번호가 변경되었습니다.' });

    } catch (error) {
        console.error('비밀번호 변경 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

//
//  계정 삭제
//
router.delete('/delete-account', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        await pool.query(`
            DELETE FROM 
                users 
            WHERE 
                id = $1`
        , [req.user!.id]);

        res.clearCookie(Envs.jwtCookieKey);
        res.json({ message: '계정이 삭제되었습니다.' });

    } catch (error) {
        console.error('계정 삭제 실패:', error);
        res.status(500).json({ error: Strings.INTERNAL_SERVER_ERROR });
    }
});

export default router;
