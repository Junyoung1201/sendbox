import { useState, useEffect } from 'react';
import { fileAPI } from '../api';
import { useAppSelector } from '../hooks/useRedux';
import { FileIcon, TextIcon, LinkIcon } from '../components/icons';
import { useIsMobile } from '../hooks/useIsMobile';
import UploadMobile from './UploadMobile';
import {
    deriveKeyFromPassword,
    encryptText,
} from '../utils/crypto';
import { subscribeToFileEvents } from '../utils/socket';
import { registerMockUploadHandlers } from '../debug/mockUploadStates';
import './Upload.css';

type UploadType = 'file' | 'text' | 'url';

export default function Upload() {
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
    const [result, setResult] = useState<{
        fileKey: string;
        fileName?: string;
        fileSize?: number;
        expiresAt: string;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [peerDownloadProgress, setPeerDownloadProgress] = useState(0);
    const [peerDownloadComplete, setPeerDownloadComplete] = useState(false);
    const [peerDownloadInterrupted, setPeerDownloadInterrupted] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);
    const [currentFileId, setCurrentFileId] = useState<number | null>(null);
    const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);

    // 다운로드 진행률 + 완료 구독
    useEffect(() => {
        if (!result?.fileKey) return;

        const unsubscribe = subscribeToFileEvents(
            result.fileKey,
            (progress) => {
                setPeerDownloadProgress(progress);
            },
            (data) => {
                console.log('파일 다운로드됨:', data);
                setPeerDownloadComplete(true);
                setPeerDownloadInterrupted(false);
            },
            () => {
                if (!peerDownloadComplete) {
                    setPeerDownloadInterrupted(true);
                }
            }
        );

        return () => {
            unsubscribe();
        };
    }, [result?.fileKey]);

    // 텍스트/URL 업로드 후 다운로드 완료 시 자동으로 초기화
    useEffect(() => {
        if (peerDownloadComplete && uploadType !== 'file') {
            // 약간의 지연 후 초기화 (사용자가 완료를 인지할 수 있도록)
            const timer = setTimeout(() => {
                handleClose();
                setText('');
                setUrl('');
                setPassword('');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [peerDownloadComplete, uploadType]);

    // 🔧 디버그: F1/F2/F3 키로 모의 상태 테스트 (삭제 가능)
    useEffect(() => {
        const cleanup = registerMockUploadHandlers({
            setUploading,
            setEncryptProgress,
            setUploadProgress,
            setResult,
            setPeerDownloadProgress,
            setPeerDownloadComplete,
            setFile
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
            // 진행 중인 요청 중단
            if (uploadAbortController) {
                uploadAbortController.abort();
            }

            if (currentFileId) {
                await fileAPI.cancelUpload(currentFileId);
            }
            
            setUploading(false);
            setUploadProgress(0);
            setEncryptProgress(0);
            setCurrentFileId(null);
            setUploadAbortController(null);
            setError(null);
        } catch (err: any) {
            // abort된 경우는 에러로 표시하지 않음
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
        if (!uploading) {
            if (uploadType === 'text' || uploadType === 'url') {
                return '공유하기';
            }
            return '업로드';
        }
        if (uploadType === 'file') {

            return '처리 중...';
        }
        return '공유 중...';
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    // 드래그 앤 드롭 핸들러
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

        // AbortController 생성
        const abortController = new AbortController();
        setUploadAbortController(abortController);

        try {
            // 비밀번호로부터 암호화 키 유도 (암호가 있을 때만)
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

                // 인증 상태 확인 중일 때는 업로드 방지
                if (authLoading) {
                    setError('인증 상태를 확인하는 중입니다. 잠시 후 다시 시도해주세요.');
                    setUploading(false);
                    return;
                }

                // Check file size
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
                    
                    // iv 생성 -> initUpload -> 각 청크 암호화 -> 암호화된 청크 즉시 업로드 -> 그 다음 청크 -> 반복
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

                        // encryptedBlob 전송 후 참조가 끊기면 GC 대상이 됨
                        const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });

                        const formData = new FormData();
                        formData.append('chunk', encryptedBlob);
                        formData.append('fileId', fileId.toString());
                        formData.append('chunkIndex', i.toString());

                        await fileAPI.uploadChunk(formData, (progressEvent) => {

                            const chunkPercent = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );

                            const totalPercent = Math.round(
                                ((i + chunkPercent / 100) / totalChunks) * 100
                            );

                            setUploadProgress(totalPercent);
                            setEncryptProgress(Math.round(((i + 1) / totalChunks) * 100));
                        }, abortController.signal);
                    }

                    await fileAPI.completeUpload(fileId);
                    setResult({ fileKey, fileName: file.name, fileSize: file.size, expiresAt });

                } else {
                    // 비암호화: file.slice()는 Blob 참조(메모리 복사 없음)이므로 메모리 안전
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
                            const chunkPercent = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );
                            const totalPercent = Math.round(
                                ((i + chunkPercent / 100) / totalChunks) * 100
                            );
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

                // 텍스트 암호화 (암호가 있을 때만)
                if (isEncrypted && encryptionKey) {
                    const { encrypted, iv } = await encryptText(text, encryptionKey);
                    const response = await fileAPI.uploadText({ encrypted, iv, password, salt });
                    setResult({ ...response.data });
                } else {
                    const response = await fileAPI.uploadText({ text });
                    setResult({ ...response.data });
                }
            } else if (uploadType === 'url') {
                if (!url.trim()) {
                    setError('URL을 입력해주세요');
                    setUploading(false);
                    return;
                }

                // URL 암호화 (암호가 있을 때만)
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
            // abort되어 취소된 경우는 별도로 에러 메시지를 표시하지 않음
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
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const isMobile = useIsMobile();
    if (isMobile) return <UploadMobile />;

    return (
        <div
            className="page upload-page"
            data-drag-active={dragActive}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <div className="upload-type-selector">
                <button
                    className={uploadType === 'file' ? 'active' : ''}
                    onClick={() => setUploadType('file')}
                    disabled={uploading || (!!result && uploadType !== 'file')}
                    title="파일"
                >
                    <FileIcon className="type-btn-icon" />
                    <span className="type-btn-label">파일</span>
                </button>
                <button
                    className={uploadType === 'text' ? 'active' : ''}
                    onClick={() => setUploadType('text')}
                    disabled={uploading || (!!result && uploadType !== 'text')}
                    title="텍스트"
                >
                    <TextIcon className="type-btn-icon" />
                    <span className="type-btn-label">텍스트</span>
                </button>
                <button
                    className={uploadType === 'url' ? 'active' : ''}
                    onClick={() => setUploadType('url')}
                    disabled={uploading || (!!result && uploadType !== 'url')}
                    title="URL"
                >
                    <LinkIcon className="type-btn-icon" />
                    <span className="type-btn-label">URL</span>
                </button>
            </div>

            <form onSubmit={handleUpload} className="upload-form">
                {/* 텍스트/URL 업로드 완료 시 폼 전체를 가리는 패널 */}
                {result && uploadType !== 'file' ? (
                    <div className="text-url-result-overlay">
                        {peerDownloadInterrupted ? (
                            <div className="download-interrupted-panel">
                                <svg className="interrupted-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M12 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                    <circle cx="12" cy="16.5" r="1" fill="currentColor"/>
                                </svg>
                                <p className="interrupted-text">다운로드가 중단되었어요.</p>
                                <button type="button" className="btn btn-secondary download-complete-close-btn" onClick={handleDownloadInterruptedClose}>
                                    닫기
                                </button>
                            </div>
                        ) : peerDownloadComplete ? (
                            <div className="download-complete-panel">
                                <svg className="check-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <p className="download-complete-text">
                                    {uploadType === 'text' ? '텍스트' : 'URL'} 다운로드가 완료되었습니다.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div 
                                    className="result-key-section clickable"
                                    onClick={handleCopyKey}
                                    title="클릭하여 키 복사"
                                >
                                    <label>{keyCopied ? '다운로드 키 - 복사됨' : '다운로드 키'}</label>
                                    <div className="key-display">
                                        {result.fileKey.split('').map((digit, index) => (
                                            <span key={index} className="key-digit">
                                                {digit}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <p className="waiting-text">상대방의 다운로드를 기다리는 중...</p>
                                <p className="expires-info">
                                    만료일: {new Date(result.expiresAt).toLocaleString()}
                                </p>
                                <button type="button" className="btn btn-danger cancel-share-btn" onClick={handleCancelShare}>
                                    공유 중단
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="form-group">
                            <label htmlFor="password-input">암호 설정 (선택사항)</label>
                            <input
                                id="password-input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={uploading}
                                placeholder="다운로드할 때 사용할 암호를 입력하세요 (비워두면 암호 없이 공유)"
                            />
                        </div>

                        {uploadType === 'file' && (
                            <div className="form-group">
                                <label htmlFor="file-input">파일 선택</label>
                                <div className="file-upload-area">
                                    {result ? (
                                <div className="upload-result-panel">
                                    {peerDownloadInterrupted ? (
                                        <div className="download-interrupted-panel">
                                            <svg className="interrupted-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                                <path d="M12 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                <circle cx="12" cy="16.5" r="1" fill="currentColor"/>
                                            </svg>
                                            <p className="interrupted-text">다운로드가 중단되었어요.</p>
                                            <button type="button" className="btn btn-secondary download-complete-close-btn" onClick={handleDownloadInterruptedClose}>
                                                닫기
                                            </button>
                                        </div>
                                    ) : peerDownloadComplete ? (
                                        <div className="download-complete-panel">
                                            <svg className="check-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                                <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                            <p className="download-complete-text">파일 다운로드가 완료되었습니다.</p>
                                            <button type="button" className="btn btn-secondary download-complete-close-btn" onClick={handleClose}>
                                                닫기
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {peerDownloadProgress === 0 && (
                                                <div 
                                                    className="result-key-section clickable"
                                                    onClick={handleCopyKey}
                                                    title="클릭하여 키 복사"
                                                >
                                                    <label>{keyCopied ? '다운로드 키 - 복사됨' : '다운로드 키'}</label>
                                                    <div className="key-display">
                                                        {result.fileKey.split('').map((digit, index) => (
                                                            <span key={index} className="key-digit">
                                                                {digit}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="peer-download-status">
                                                {peerDownloadProgress > 0 ? (
                                                    <>
                                                        <p className="peer-download-text">상대방 다운로드 중... {peerDownloadProgress}%</p>
                                                        <div className="progress-bar peer-progress-bar">
                                                            <div className="progress-fill" style={{ width: `${peerDownloadProgress}%` }} />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="waiting-text">상대방의 다운로드를 기다리는 중...</p>
                                                )}
                                            </div>
                                            {peerDownloadProgress === 0 && (
                                                <button type="button" className="btn btn-danger cancel-share-btn" onClick={handleCancelShare}>
                                                    공유 중단
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            ) : uploading ? (
                                <div className="uploading-placeholder-panel">
                                    <div className="uploading-spinner" />
                                    <p className="uploading-placeholder-text">
                                        {encryptProgress > 0 && encryptProgress < 100
                                            ? `암호화 중... ${encryptProgress}%`
                                            : uploadProgress > 0
                                                ? `업로드 중... ${uploadProgress}%`
                                                : '파일 업로드 중...'}
                                    </p>
                                </div>
                            ) : (
                                <>        
                                    <input
                                        id="file-input"
                                        type="file"
                                        onChange={handleFileChange}
                                        className="file-input-hidden"
                                    />
                                    <label htmlFor="file-input" className={`file-upload-label ${file ? 'file-selected' : ''}`}>
                                        <svg className="upload-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M18.944 11.112C18.507 7.67 15.56 5 12 5 9.244 5 6.85 6.611 5.757 9.15 3.609 9.792 2 11.82 2 14c0 2.757 2.243 5 5 5h11c2.206 0 4-1.794 4-4a4.01 4.01 0 0 0-3.056-3.888zM13 14v3h-2v-3H8l4-5 4 5h-3z" fill="currentColor"/>
                                        </svg>
                                        <span className="upload-text">
                                            {file ? (
                                                <>
                                                    <strong>{file.name}</strong>
                                                    <small>({formatFileSize(file.size)})</small>
                                                </>
                                            ) : (
                                                <>
                                                    <strong>파일을 선택하거나 드래그하세요</strong>
                                                    <small>클릭하여 파일 선택</small>
                                                </>
                                            )}
                                        </span>
                                    </label>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {uploadType === 'text' && (
                    <div className="form-group text-input-form">
                        <label htmlFor="text-input">텍스트 입력</label>
                        <textarea
                            id="text-input"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            disabled={uploading}
                            rows={10}
                            placeholder="여기에 텍스트를 입력하세요."
                        />
                    </div>
                )}

                {uploadType === 'url' && (
                    <div className="form-group">
                        <label htmlFor="url-input">URL 입력</label>
                        <input
                            id="url-input"
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={uploading}
                            placeholder="https://example.com"
                        />
                    </div>
                )}

                {uploading && uploadType === 'file' && (
                    <>
                        {encryptProgress > 0 && encryptProgress < 100 && (
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${encryptProgress}%` }}
                                />
                            </div>
                        )}
                        {uploadProgress > 0 && (
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}
                    </>
                )}

                {error && <div className="error-message">{error}</div>}

                {!result && (
                    <div className="upload-action-row">
                        {!uploading && (
                            <button type="submit" className="btn btn-primary upload-submit-btn">
                                {getButtonText()}
                            </button>
                        )}
                        {uploading && (
                            <button 
                                type="button" 
                                className="btn btn-danger upload-cancel-btn" 
                                onClick={handleCancelUpload}
                            >
                                업로드 취소
                            </button>
                        )}
                    </div>
                )}
                    </>
                )}
            </form>

            {!isAuthenticated && (
                <div className="info-box">
                    <p>
                        무료 사용자는 최대 2GB까지 파일을 업로드할 수 있습니다.
                        <br />
                        로그인하면 최대 100GB까지 업로드할 수 있습니다!
                    </p>
                </div>
            )}
        </div>
    );
}
