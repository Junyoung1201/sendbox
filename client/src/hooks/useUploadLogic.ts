import { useState, useEffect } from 'react';
import { fileAPI } from '../api';
import { useAppSelector } from './useRedux';
import {
    deriveKeyFromPassword,
    encryptText,
} from '../utils/crypto';
import { subscribeToFileEvents } from '../utils/socket';
import { registerMockUploadHandlers } from '../debug/mockUploadStates';

export type UploadType = 'file' | 'text' | 'url';

export interface UploadResult {
    fileKey: string;
    fileName?: string;
    fileSize?: number;
    expiresAt: string;
}

export function useUploadLogic() {
    const { isAuthenticated, loading: authLoading } = useAppSelector((state) => state.auth);
    const [uploadType, setUploadType] = useState<UploadType>('file');
    const [file, setFile] = useState<File | null>(null);
    const [text, setText] = useState('');
    const [url, setUrl] = useState('');
    const [password, setPassword] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [encryptProgress, setEncryptProgress] = useState(0);
    const [dragActive, setDragActive] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [peerDownloadProgress, setPeerDownloadProgress] = useState(0);
    const [peerDownloadComplete, setPeerDownloadComplete] = useState(false);
    const [peerDownloadInterrupted, setPeerDownloadInterrupted] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);
    const [currentFileId, setCurrentFileId] = useState<number | null>(null);
    const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);

    useEffect(() => {
        if (!result?.fileKey) return;
        const unsubscribe = subscribeToFileEvents(
            result.fileKey,
            (progress) => setPeerDownloadProgress(progress),
            (data) => {
                console.log('파일 다운로드됨:', data);
                setPeerDownloadComplete(true);
                setPeerDownloadInterrupted(false);
            },
            () => {
                // 이미 완료된 경우 무시
                if (!peerDownloadComplete) {
                    setPeerDownloadInterrupted(true);
                }
            }
        );
        return () => unsubscribe();
    }, [result?.fileKey]);

    useEffect(() => {
        if (peerDownloadComplete && uploadType !== 'file') {
            const timer = setTimeout(() => {
                handleClose();
                setText('');
                setUrl('');
                setPassword('');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [peerDownloadComplete, uploadType]);

    // 디자인 테스트 용 키 등록 (F1, F2)
    useEffect(() => {
        const cleanup = registerMockUploadHandlers({
            setUploading,
            setEncryptProgress,
            setUploadProgress,
            setResult,
            setPeerDownloadProgress,
            setPeerDownloadComplete,
            setFile,
        });
        return cleanup;
    }, []);

    const handleClose = () => {
        setResult(null);
        setFile(null);
        setPeerDownloadProgress(0);
        setPeerDownloadComplete(false);
        setPeerDownloadInterrupted(false);
        setKeyCopied(false);
        setError(null);
        setCurrentFileId(null);
        setUploadAbortController(null);
    };

    const handleDownloadInterruptedClose = () => {
        setPeerDownloadInterrupted(false);
        setPeerDownloadProgress(0);
    };

    const handleCancelUpload = async () => {
        if (!uploading) return;
        try {
            if (uploadAbortController) uploadAbortController.abort();
            if (currentFileId) await fileAPI.cancelUpload(currentFileId);
            setUploading(false);
            setUploadProgress(0);
            setEncryptProgress(0);
            setCurrentFileId(null);
            setUploadAbortController(null);
            setError(null);
        } catch (err: any) {
            if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
                console.error('Upload cancel error:', err);
                setError(err.response?.data?.error || '업로드 취소 실패');
            }
            setUploading(false);
            setUploadProgress(0);
            setEncryptProgress(0);
            setCurrentFileId(null);
            setUploadAbortController(null);
        }
    };

    const handleCancelShare = async () => {
        if (!result?.fileKey) return;
        try {
            await fileAPI.cancelShare(result.fileKey);
            handleClose();
            setText('');
            setUrl('');
            setPassword('');
        } catch (err: any) {
            setError(err.response?.data?.error || '공유 중단 실패');
        }
    };

    const handleCopyKey = () => {
        if (result?.fileKey) {
            navigator.clipboard.writeText(result.fileKey);
            setKeyCopied(true);
            setTimeout(() => setKeyCopied(false), 2000);
        }
    };

    const getButtonText = () => {
        if (!uploading) return uploadType === 'file' ? '업로드' : '공유하기';
        return uploadType === 'file' ? '처리 중..' : '공유 중..';
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
            setError(null);
            setUploadType('file');
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setUploading(true);
        setUploadProgress(0);
        setEncryptProgress(0);

        const abortController = new AbortController();
        setUploadAbortController(abortController);

        try {
            const isEncrypted = !!password;
            let encryptionKey: CryptoKey | null = null;
            let salt: string | undefined;

            if (isEncrypted) {
                const derived = await deriveKeyFromPassword(password);
                encryptionKey = derived.key;
                salt = derived.salt;
            }

            if (uploadType === 'file') {
                if (!file) {
                    setError('파일을 선택해주세요.');
                    setUploading(false);
                    return;
                }
                if (authLoading) {
                    setError('인증 상태를 확인하는 중입니다. 잠시 후 다시 시도해주세요.');
                    setUploading(false);
                    return;
                }

                const maxSize = isAuthenticated ? 100 * 1024 * 1024 * 1024 : 2 * 1024 * 1024 * 1024;
                if (file.size > maxSize) {
                    setError(
                        isAuthenticated
                            ? '파일 크기가 100GB 제한을 초과합니다'
                            : '파일 크기가 2GB를 초과합니다. 더 큰 파일을 업로드하려면 로그인하세요.'
                    );
                    setUploading(false);
                    return;
                }

                const CHUNK_SIZE = 90 * 1024 * 1024; // 90MB (Cloudflare 무료 플랜 100MB 제한 고려)
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

                if (isEncrypted && encryptionKey) {
                    // 암호화: IV를 먼저 생성한 뒤 initUpload → 청크별 encrypt → 즉시 upload → 다음 청크
                    // 청크 전체를 메모리에 쌓지 않으므로 100GB 파일도 OOM 없음
                    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
                    const iv = btoa(String.fromCharCode(...ivBytes));

                    const initResponse = await fileAPI.initUpload({
                        fileName: file.name,
                        fileSize: file.size,
                        totalChunks,
                        password,
                        salt,
                        iv,
                    });

                    const { fileId, fileKey, expiresAt } = initResponse.data;

                    setCurrentFileId(fileId);

                    for (let i = 0; i < totalChunks; i++) {
                        const start = i * CHUNK_SIZE;
                        const end = Math.min(start + CHUNK_SIZE, file.size);

                        // arrayBuffer()는 해당 청크(최대 500MB)만 읽음
                        const arrayBuffer = await file.slice(start, end).arrayBuffer();
                        const encryptedData = await crypto.subtle.encrypt(
                            { name: 'AES-GCM', iv: ivBytes },
                            encryptionKey,
                            arrayBuffer
                        );

                        // encryptedBlob 전송 후 참조가 끊김 = GC 대상
                        const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });

                        const formData = new FormData();
                        formData.append('chunk', encryptedBlob);
                        formData.append('fileId', fileId.toString());
                        formData.append('chunkIndex', i.toString());

                        await fileAPI.uploadChunk(formData, (progressEvent) => {
                            const chunkPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            const totalPercent = Math.round(((i + chunkPercent / 100) / totalChunks) * 100);
                            setUploadProgress(totalPercent);
                            setEncryptProgress(Math.round(((i + 1) / totalChunks) * 100));
                        }, abortController.signal);
                    }

                    await fileAPI.completeUpload(fileId);
                    setResult({ fileKey, fileName: file.name, fileSize: file.size, expiresAt });

                } else {

                    const initResponse = await fileAPI.initUpload({
                        fileName: file.name,
                        fileSize: file.size,
                        totalChunks,
                    });

                    const { fileId, fileKey, expiresAt } = initResponse.data;
                    setCurrentFileId(fileId);

                    for (let i = 0; i < totalChunks; i++) {
                        const start = i * CHUNK_SIZE;
                        const end = Math.min(start + CHUNK_SIZE, file.size);

                        const formData = new FormData();
                        formData.append('chunk', file.slice(start, end));
                        formData.append('fileId', fileId.toString());
                        formData.append('chunkIndex', i.toString());

                        await fileAPI.uploadChunk(formData, (progressEvent) => {
                            const chunkPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            const totalPercent = Math.round(((i + chunkPercent / 100) / totalChunks) * 100);
                            setUploadProgress(totalPercent);
                        }, abortController.signal);
                    }

                    await fileAPI.completeUpload(fileId);
                    setResult({ fileKey, fileName: file.name, fileSize: file.size, expiresAt });
                }

            } else if (uploadType === 'text') {

                if (!text.trim()) {
                    setError('텍스트를 입력해주세요');
                    setUploading(false);
                    return;
                }

                if (isEncrypted && encryptionKey) {
                    const { encrypted, iv } = await encryptText(text, encryptionKey);
                    const response = await fileAPI.uploadText({ encrypted, iv, password, salt });
                    setResult({ ...response.data });
                } else {
                    const response = await fileAPI.uploadText({ text });
                    setResult({ ...response.data });
                }

            } 
            
            else if (uploadType === 'url') {

                if (!url.trim()) {
                    setError('URL을 입력해주세요');
                    setUploading(false);
                    return;
                }

                if (isEncrypted && encryptionKey) {

                    const { encrypted, iv } = await encryptText(url, encryptionKey);
                    const response = await fileAPI.uploadURL({ encrypted, iv, password, salt });
                    setResult({ ...response.data });

                } else {

                    const response = await fileAPI.uploadURL({ url });
                    setResult({ ...response.data });
                }
            }
        } catch (err: any) {

            if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
                setError(err.response?.data?.error || '업로드 실패');
                console.error('Upload error:', err);
            }

        } finally {
            setUploading(false);
            setUploadProgress(0);
            setEncryptProgress(0);
            setCurrentFileId(null);
            setUploadAbortController(null);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) {
            return '0 Bytes';
        }

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return {
        isAuthenticated,
        uploadType, setUploadType,
        file,
        text, setText,
        url, setUrl,
        password, setPassword,
        uploading,
        uploadProgress,
        encryptProgress,
        dragActive,
        result,
        error,
        peerDownloadProgress,
        peerDownloadComplete,
        peerDownloadInterrupted,
        keyCopied,
        handleClose,
        handleDownloadInterruptedClose,
        handleCancelUpload,
        handleCancelShare,
        handleCopyKey,
        handleFileChange,
        handleDrag,
        handleDrop,
        handleUpload,
        getButtonText,
        formatFileSize,
    };
}

export type UploadLogicReturn = ReturnType<typeof useUploadLogic>;
