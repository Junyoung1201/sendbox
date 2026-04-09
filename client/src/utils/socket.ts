import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.MODE === 'production' 
    ? 'https://sendbox-api.saehyeon.kr' 
    : 'http://localhost:5820';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        socket.on('connect', () => {
            console.log('Socket connected:', socket?.id);
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });
    }

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

// 파일 다운로드 알림 구독
export const subscribeToFileDownload = (
    fileKey: string,
    callback: (data: {
        fileKey: string;
        fileName?: string;
        fileType: string;
        downloadedAt: string;
    }) => void
) => {
    const s = getSocket();
    
    // 해당 파일의 room에 join
    s.emit('join-file-room', fileKey);
    
    // 다운로드 이벤트 리스너 등록
    s.on('file-downloaded', callback);
    
    // cleanup 함수 반환
    return () => {
        s.off('file-downloaded', callback);
        s.emit('leave-file-room', fileKey);
    };
};

// 파일 다운로드 진행률 + 완료 통합 구독
export const subscribeToFileEvents = (
    fileKey: string,
    onProgress: (progress: number) => void,
    onComplete: (data: {
        fileKey: string;
        fileName?: string;
        fileType: string;
        downloadedAt: string;
    }) => void
) => {
    const s = getSocket();

    s.emit('join-file-room', fileKey);

    const progressHandler = (data: { fileKey: string; progress: number }) => {
        onProgress(data.progress);
    };

    s.on('file-download-progress', progressHandler);
    s.on('file-downloaded', onComplete);

    return () => {
        s.off('file-download-progress', progressHandler);
        s.off('file-downloaded', onComplete);
        s.emit('leave-file-room', fileKey);
    };
};
