import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';
import { Envs } from '../constants';
import { pool } from '../db';

export interface TokenPayload {
    id: number;
    email: string;
}

export function generateToken(user: TokenPayload): string {
    //@ts-ignore
    return jwt.sign(
        { id: user.id, email: user.email },
        Envs.jwtSecret,
        { expiresIn: (process.env.JWT_EXPIRES_IN as string) }
    );
}

export function verifyToken(token: string): TokenPayload {
    return jwt.verify(token, Envs.jwtSecret) as TokenPayload;
}

export function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void {
    try {
        const token = req.cookies[Envs.jwtCookieKey];

        if (!token) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export function optionalAuthMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void {

    try {
        const token = req.cookies[Envs.jwtCookieKey];

        if (token) {
            const decoded = verifyToken(token);

            // 토큰의 유저가 실제 DB에 존재하는지 확인
            pool.query('SELECT id FROM users WHERE id = $1', [decoded.id])
                .then(result => {
                    if (result.rows.length > 0) {
                        req.user = decoded;
                    }
                    // 존재하지 않으면 비로그인으로 처리 (req.user 미설정)
                    next();
                })
                .catch(() => {
                    next();
                });
        } else {
            next();
        }

    } catch (error) {
        // 액세스 토큰 없어도 비로그인으로 이용하는거
        next();
    }
}
