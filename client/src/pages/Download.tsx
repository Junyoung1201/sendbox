import { useState, useEffect } from 'react';
import { fileAPI } from '../api';
import {
    deriveKeyFromPasswordWithSalt,
    decryptText,
    decryptFileChunksStreaming,
} from '../utils/crypto';
import streamSaver from 'streamsaver';
import './Download.css';

export default function Download() {
    const [fileKey, setFileKey] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [decryptProgress, setDecryptProgress] = useState(0);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{
        type: 'text' | 'url';
        content: string;
    } | null>(null);

    const [copied, setCopied] = useState(false);

    // URL 해시에서 키 추출 (암호화 키는 제거)
    useEffect(() => {
        
        // StreamSaver 설정
        streamSaver.mitm = '/mitm.html';
        
        const hash = window.location.hash.substring(1); // # 제거

        if (hash) {

            // 6자리 숫자만 추출
            if (hash.length === 6 && /^\d{6}$/.test(hash)) {
                setFileKey(hash);
            }

        }
    }, []);

    const handleDownload = async (e: React.FormEvent) => {

        e.preventDefault();

        setError(null);
        setResult(null);
        setDecryptProgress(0);
        setDownloadProgress(0);

        if (fileKey.length !== 6 || !/^\d{6}$/.test(fileKey)) {
            setError('6자리 숫자를 입력해주세요.');
            return;
        }

        setLoading(true);

        try {
            // 서버에서 데이터 가져오기 (암호 선택적)
            const response = await fileAPI.download(fileKey, password);

            // 텍스트나 URL일 경우
            if (response.data.type === 'text' || response.data.type === 'url') {

                if (response.data.isEncrypted) {

                    const { encrypted, iv, salt } = response.data;
                    
                    // 비밀번호로부터 암호화 키 유도
                    const cryptoKey = await deriveKeyFromPasswordWithSalt(password, salt);
                    const decryptedContent = await decryptText(encrypted, iv, cryptoKey);

                    setResult({
                        type: response.data.type,
                        content: decryptedContent,
                    });

                    if (response.data.type === 'url') {
                        window.open(decryptedContent, '_blank', 'noopener,noreferrer');
                    }

                } else {

                    // 암호화되지 않은 데이터
                    setResult({
                        type: response.data.type,
                        content: response.data.content,
                    });
                    if (response.data.type === 'url') {
                        window.open(response.data.content, '_blank', 'noopener,noreferrer');
                    }

                }
            } 
            
            ////////////////////////////////
            //
            //       파일 다운로드
            //
            ////////////////////////////////
            else if (response.data.type === 'file') {

                const { fileName, totalChunks, isEncrypted, iv, salt, fileKey: key } = response.data;
                
                // StreamSaver로 파일 스트림 생성
                const fileStream = streamSaver.createWriteStream(fileName || 'download');
                const writer = fileStream.getWriter();
                
                try {

                    // 파일이 암호화 되어있으면
                    if (isEncrypted) {

                        // 비밀번호로 키 유도
                        const cryptoKey = await deriveKeyFromPasswordWithSalt(password, salt);
                        
                        /** 청크 다운로드  */
                        const downloadChunk = async (chunkIndex: number) => {
                            const chunkResponse = await fileAPI.downloadChunk(key, chunkIndex);
                            return chunkResponse.data;
                        };
                        
                        // 스트리밍 복호화
                        await decryptFileChunksStreaming(
                            downloadChunk,
                            totalChunks,
                            iv,
                            cryptoKey,
                            writer,
                            (downloadPercent, decryptPercent) => {
                                setDownloadProgress(downloadPercent);
                                setDecryptProgress(decryptPercent);
                            }
                        );

                    } else {
                        
                        // 암호화되지 않은 파일 다운로드
                        // 그럼 복호화할 필요 없이 그냥 다운로드 받으면 됨
                        for (let i = 0; i < totalChunks; i++) {
                            const chunkResponse = await fileAPI.downloadChunk(key, i);
                            await writer.write(new Uint8Array(chunkResponse.data));
                            
                            const downloadPercent = Math.round(((i + 1) / totalChunks) * 100);
                            setDownloadProgress(downloadPercent);
                        }
                        await writer.close();
                    }
                    
                    // 다운로드 완료 알림
                    await fileAPI.completeDownload(key);
                    
                    setFileKey('');

                } catch (streamError) {
                    // 스트림 오류 시 writer 중단
                    await writer.abort();
                    throw streamError;
                }
            }
        } catch (err: any) {
            console.error('다운로드 실패:', err);
            setError(err.response?.data?.error || '다운로드 실패');
        } finally {
            setLoading(false);
            setDecryptProgress(0);
            setDownloadProgress(0);
        }
    };

    const handleCopyContent = () => {
        if (result) {
            navigator.clipboard.writeText(result.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="page download-page">
            <form onSubmit={handleDownload} className="download-form">
                <div className="form-group">
                    <label htmlFor="key-input">다운로드 키 입력</label>
                    <input
                        id="key-input"
                        type="text"
                        value={fileKey}
                        onChange={(e) => setFileKey(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        disabled={loading}
                        placeholder="123456"
                        maxLength={6}
                        className="key-input"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password-input">암호 입력 (암호화된 파일인 경우에만)</label>
                    <input
                        id="password-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        placeholder="업로드시 설정한 암호 (선택사항)"
                    />
                </div>

                {loading && downloadProgress > 0 && (
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${downloadProgress}%` }}
                        />
                        <span className="progress-text">다운로드 중.. {downloadProgress}%</span>
                    </div>
                )}

                {loading && decryptProgress > 0 && (
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${decryptProgress}%` }}
                        />
                        <span className="progress-text">복호화 중.. {decryptProgress}%</span>
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}

                {result && (
                    <>
                        {result.type === 'url' ? (
                            <div className="content-display url-opened-display">
                                <p className="url-opened-text">URL이 새 창에서 열렸습니다.</p>
                                <a href={result.content} target="_blank" rel="noopener noreferrer" className="url-reopen-link">
                                    {result.content}
                                </a>
                                <button
                                    type="button"
                                    onClick={handleCopyContent}
                                    className="copy-icon-btn"
                                    title="복사"
                                >
                                    {copied ? (
                                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="content-display text-content-display">
                                <pre>{result.content}</pre>
                                <button
                                    type="button"
                                    onClick={handleCopyContent}
                                    className="copy-icon-btn"
                                    title="복사"
                                >
                                    {copied ? (
                                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}

                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? '다운로드/복호화 중..' : '다운로드 및 복호화'}
                </button>
            </form>

            <div className="info-box">
                <h3>E2E 암호화 정보</h3>
                <ul>
                    <li>모든 데이터는 서버로 전송되기 전에 브라우저에서 암호화됩니다.</li>
                    <li>서버는 암호화된 데이터만 저장하며 내용을 볼 수 없습니다.</li>
                    <li>암호화 키는 비밀번호로부터 유도됩니다 (PBKDF2).</li>
                    <li>파일은 다운로드 후 삭제됩니다.</li>
                    <li>파일이 다운로드되지 않으면 12시간 후 만료됩니다.</li>
                </ul>
            </div>
        </div>
    );
}
