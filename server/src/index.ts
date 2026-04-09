import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { Envs } from './constants';
import authRoutes from './routes/auth';
import fileRoutes from './routes/file';
import { startCleanupInterval } from './utils/cleanup';

dotenv.config();
const corsOrigin = Envs.isDev ? process.env.DEV_CLIENT_URL : process.env.CLIENT_URL;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: corsOrigin,
        credentials: true
    }
});

// 다운로더 소켓 추적 (fileKey -> socketId)
export const downloaderSockets = new Map<string, string>();

app.use(cors({
    origin: corsOrigin,
    credentials: true
}));

// express 페이로드 제한 증가
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

//
//  라우터 모음
//
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// 백엔드 테스트
app.get("/ping", (req,res) => {
    res.send("pong")
})

//
//  socket.io 
//
io.on('connection', (socket) => {
    console.log('클라이언트 연결:', socket.id);

    // 파일 room에 join
    socket.on('join-file-room', (fileKey: string) => {
        socket.join(`file-${fileKey}`);
        console.log(`클라이언트 ${socket.id}가 room file-${fileKey}에 참여`);
    });

    // 파일 room에서 leave
    socket.on('leave-file-room', (fileKey: string) => {
        socket.leave(`file-${fileKey}`);
        console.log(`클라이언트 ${socket.id}가 room file-${fileKey}에서 나감`);
    });

    // 다운로더 등록 (다운로드 시작 시 다운로더 측에서 emit)
    socket.on('register-downloader', (fileKey: string) => {
        downloaderSockets.set(fileKey, socket.id);
        socket.join(`file-${fileKey}`);
        console.log(`다운로더 ${socket.id}가 file-${fileKey} 등록`);
    });

    // 연결해제 헨들러
    socket.on('disconnect', () => {
        
        console.log('클라이언트 연결 해제:', socket.id);

        // 다운로더였다면 업로더에게 중단 알림
        for (const [fileKey, socketId] of downloaderSockets.entries()) {
            if (socketId === socket.id) {
                downloaderSockets.delete(fileKey);
                io.to(`file-${fileKey}`).emit('download-interrupted', { fileKey });
                console.log(`다운로더 연결 해제: file-${fileKey} 중단 알림`);
                break;
            }
        }
    });

    // 파일 업로드 헨들러
    socket.on('upload-progress', (data) => {
        socket.emit('upload-progress-update', data);
    });
});

// 오류 헨들링 미들웨어
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('오류:', err);

    res.status(err.status || 500).json({
        error: err.message || '내부 서버 오류'
    });
});

//
//   파일 청소 타이머 시작
//
startCleanupInterval();

//
//  express 타임아웃 설정
//
server.timeout = Envs.serverTimeoutMs;
server.keepAliveTimeout = Envs.serverTimeoutMs;
server.headersTimeout = Envs.serverTimeoutMs + 1000; // <-- timeout보다 약간 더 길게

server.listen(process.env.PORT, () => {
    console.clear();
    console.log();
    console.log(`SendBox 백엔드 서버 (포트: ${process.env.PORT})`)
    console.log(`└─ NODE_ENV: ${process.env.NODE_ENV}`)
    console.log(`└─ Origins: ${corsOrigin}`)
    console.log(`└─ Timeout: ${Envs.serverTimeoutMs / 1000 / 60 / 60}시간`)
    console.log();
});

export { io };
