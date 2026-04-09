import axios from 'axios';

const API_URL = import.meta.env.MODE === 'development' ? 'http://localhost:5820/api' : 'https://sendbox-api.saehyeon.kr/api';

// axios 타임아웃ms (10시간)
const LONG_TIMEOUT = 10 * 60 * 60 * 1000;

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: LONG_TIMEOUT
});

// 인증 관련api
export const authAPI = {
    register: (email: string, password: string) =>
        api.post('/auth/register', { email, password }),

    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),

    logout: () => api.post('/auth/logout'),

    getMe: () => api.get('/auth/me'),

    changePassword: (currentPassword: string, newPassword: string) =>
        api.post('/auth/change-password', { currentPassword, newPassword }),

    deleteAccount: () => api.delete('/auth/delete-account'),
};

// 파일 관련 api
export const fileAPI = {
    // 파일 업로드 초기화
    initUpload: (data: { fileName: string; fileSize: number; totalChunks: number; password?: string; salt?: string; iv?: string }) =>
        api.post('/files/init-upload', data),

    // 청크 업로드
    uploadChunk: (formData: FormData, onUploadProgress?: (progressEvent: any) => void, signal?: AbortSignal) =>
        api.post('/files/upload-chunk', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress,
            signal,
        }),

    // 업로드 완료
    completeUpload: (fileId: number) =>
        api.post('/files/complete-upload', { fileId }),

    // 업로드 취소
    cancelUpload: (fileId: number) =>
        api.post('/files/cancel-upload', { fileId }),

    // 공유 중단 (업로드 완료 후 삭제)
    cancelShare: (fileKey: string) =>
        api.delete(`/files/cancel-share/${fileKey}`),

    uploadText: (data: { text?: string; encrypted?: string; iv?: string; password?: string; salt?: string }) =>
        api.post('/files/upload-text', data),

    uploadURL: (data: { url?: string; encrypted?: string; iv?: string; password?: string; salt?: string }) =>
        api.post('/files/upload-url', data),

    download: (key: string, password?: string) =>
        api.post(`/files/download/${key}`, { password }),

    // 청크 다운로드
    downloadChunk: (key: string, chunkIndex: number) =>
        api.get(`/files/download-chunk/${key}/${chunkIndex}`, {
            responseType: 'arraybuffer'
        }),

    // 다운로드 완료
    completeDownload: (key: string) =>
        api.post(`/files/complete-download/${key}`),
};

export default api;
