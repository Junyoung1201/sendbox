import { configDotenv } from "dotenv"

configDotenv({ quiet: true });

export const Envs = {
    isDev: process.env.NODE_ENV === 'development',
    jwtCookieKey: process.env.JWT_TOKEN_COOKIE_KEY as string,
    jwtCookieExpired: parseInt(process.env.JWT_TOKEN_COOKIE_EXPIRED as string),
    cookieSameSite: process.env.NODE_ENV === 'development' ? 'lax' : 'none' as 'lax' | 'none',
    cookieSecure: process.env.NODE_ENV !== 'development', // 개발 시 false, 프로덕션 시 true (samesite=None은 secure 필수)
    fileExpiredMs: parseInt(process.env.FILE_EXPIRED_MS as string),
    jwtSecret: process.env.JWT_SECRET as string,
    serverTimeoutMs: parseInt(process.env.SERVER_TIMEOUT_MS || '36000000') // 기본값 10시간
}

export const FileConstants = {

    // 한 청크 당 사이즈 (90MB)
    // 클라우드플레어 Tunnel 이용하고 있는데, 무료플랜은 제한 100MB 걸려서 90MB + 오버헤드로 계산해야함
    CHUNK_SIZE: 90 * 1024 * 1024, 

    // 암호화 고려한 한 청크 당 사이즈 (91MB)
    CHUNK_SIZE_WITH_OVERHEAD: 90 * 1024 * 1024 + 1024 * 1024,

    // 파일 업로드 폴더
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
}

export const Strings = {
    INTERNAL_SERVER_ERROR: "내부 서버 오류"
}