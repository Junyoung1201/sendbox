import { configDotenv } from "dotenv"

configDotenv({ quiet: true });

export const Envs = {
    isDev: process.env.NODE_ENV === 'development',
    jwtCookieKey: process.env.JWT_TOKEN_COOKIE_KEY as string,
    jwtCookieExpired: parseInt(process.env.JWT_TOKEN_COOKIE_EXPIRED as string),
    cookieSameSite: process.env.NODE_ENV === 'development' ? 'lax' : 'none' as 'lax' | 'none',
    cookieSecure: process.env.NODE_ENV !== 'development', // 개발 시 false, 프로덕션 시 true (SameSite=None은 Secure 필수)
    fileExpiredMs: parseInt(process.env.FILE_EXPIRED_MS as string),
    jwtSecret: process.env.JWT_SECRET as string,
    serverTimeoutMs: parseInt(process.env.SERVER_TIMEOUT_MS || '36000000') // 기본값 10시간
}

export const FileConstants = {
    CHUNK_SIZE: 500 * 1024 * 1024, // 500MB
    CHUNK_SIZE_WITH_OVERHEAD: 500 * 1024 * 1024 + 1024 * 1024, // 500MB + 1MB (암호화 오버헤드 고려)
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
}

export const Strings = {
    INTERNAL_SERVER_ERROR: "내부 서버 오류"
}