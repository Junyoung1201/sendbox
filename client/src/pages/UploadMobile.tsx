import { useUploadLogic } from '../hooks/useUploadLogic';
import { FileIcon, TextIcon, LinkIcon } from '../components/icons';
import './UploadMobile.css';

export default function UploadMobile() {
    const {
        isAuthenticated,
        uploadType, setUploadType,
        file,
        text, setText,
        url, setUrl,
        password, setPassword,
        uploading,
        uploadProgress,
        encryptProgress,
        result,
        error,
        peerDownloadProgress,
        peerDownloadComplete,
        keyCopied,
        handleClose,
        handleCancelUpload,
        handleCancelShare,
        handleCopyKey,
        handleFileChange,
        handleUpload,
        getButtonText,
        formatFileSize,
    } = useUploadLogic();

    const CheckIcon = () => (
        <svg className="m-check-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );

    const KeyDigits = ({ fileKey }: { fileKey: string }) => (
        <div className="m-key-display" onClick={handleCopyKey} title="탭하여 복사">
            {fileKey.split('').map((digit, i) => (
                <span key={i} className="m-key-digit">{digit}</span>
            ))}
        </div>
    );

    /*  결과 화면 (파일)  */
    const FileResultPanel = () => {
        if (!result) return null;
        if (peerDownloadComplete) {
            return (
                <div className="m-result">
                    <CheckIcon />
                    <p className="m-result-title">다운로드 완료!</p>
                    <button className="m-btn m-btn-secondary" onClick={handleClose}>닫기</button>
                </div>
            );
        }
        return (
            <div className="m-result">
                <p className="m-result-label">{keyCopied ? '복사됨 ✓' : '다운로드 키 (탭하여 복사)'}</p>
                <KeyDigits fileKey={result.fileKey} />
                <p className="m-expires">만료: {new Date(result.expiresAt).toLocaleString()}</p>
                {peerDownloadProgress > 0 ? (
                    <>
                        <p className="m-wait-text">상대방 다운로드 중... {peerDownloadProgress}%</p>
                        <div className="m-progress-bar">
                            <div className="m-progress-fill" style={{ width: `${peerDownloadProgress}%` }} />
                        </div>
                    </>
                ) : (
                    <p className="m-wait-text">상대방의 다운로드를 기다리는 중...</p>
                )}
                {peerDownloadProgress === 0 && (
                    <button className="m-btn m-btn-danger" onClick={handleCancelShare}>공유 중단</button>
                )}
            </div>
        );
    };

    /*  결과 화면 (텍스트/URL)  */
    const TextUrlResultPanel = () => {
        if (!result) return null;
        if (peerDownloadComplete) {
            return (
                <div className="m-result">
                    <CheckIcon />
                    <p className="m-result-title">
                        {uploadType === 'text' ? '텍스트' : 'URL'} 다운로드 완료!
                    </p>
                </div>
            );
        }
        return (
            <div className="m-result">
                <p className="m-result-label">{keyCopied ? '복사됨 ✓' : '다운로드 키 (탭하여 복사)'}</p>
                <KeyDigits fileKey={result.fileKey} />
                <p className="m-expires">만료: {new Date(result.expiresAt).toLocaleString()}</p>
                <p className="m-wait-text">상대방의 다운로드를 기다리는 중...</p>
                <button className="m-btn m-btn-danger" onClick={handleCancelShare}>공유 중단</button>
            </div>
        );
    };

    /*  파일 선택 영역  */
    const FilePickArea = () => (
        <div className="m-file-area">
            <input
                id="m-file-input"
                type="file"
                onChange={handleFileChange}
                className="m-file-input-hidden"
                disabled={uploading}
            />
            <label
                htmlFor="m-file-input"
                className={`m-file-pick ${file ? 'file-selected' : ''}`}
            >
                <svg className="m-file-pick-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.944 11.112C18.507 7.67 15.56 5 12 5 9.244 5 6.85 6.611 5.757 9.15 3.609 9.792 2 11.82 2 14c0 2.757 2.243 5 5 5h11c2.206 0 4-1.794 4-4a4.01 4.01 0 0 0-3.056-3.888zM13 14v3h-2v-3H8l4-5 4 5h-3z" fill="currentColor"/>
                </svg>
                {file ? (
                    <>
                        <span className="m-file-name">{file.name}</span>
                        <span className="m-file-size">{formatFileSize(file.size)}</span>
                    </>
                ) : (
                    <>
                        <span className="m-file-hint-main">파일을 선택하세요</span>
                        <span className="m-file-hint-sub">탭하여 파일 선택</span>
                    </>
                )}
            </label>
        </div>
    );

    /*  업로드 중 상태  */
    const UploadingPanel = () => (
        <div className="m-uploading-panel">
            <div className="m-spinner" />
            <p className="m-uploading-text">
                {encryptProgress > 0 && encryptProgress < 100
                    ? `암호화 중... ${encryptProgress}%`
                    : uploadProgress > 0
                        ? `업로드 중... ${uploadProgress}%`
                        : '처리 중...'}
            </p>
            {(encryptProgress > 0 || uploadProgress > 0) && (
                <div className="m-progress-bar">
                    <div
                        className="m-progress-fill"
                        style={{ width: `${encryptProgress > 0 && encryptProgress < 100 ? encryptProgress : uploadProgress}%` }}
                    />
                </div>
            )}
        </div>
    );

    return (
        <div className="upload-mobile">
            {/*  타입 탭  */}
            <div className="m-type-tabs">
                <button
                    className={`m-type-tab ${uploadType === 'file' ? 'active' : ''}`}
                    onClick={() => setUploadType('file')}
                    disabled={uploading || (!!result && uploadType !== 'file')}
                    title="파일"
                >
                    <FileIcon className="m-type-tab-icon" />
                    <span>파일</span>
                </button>
                <button
                    className={`m-type-tab ${uploadType === 'text' ? 'active' : ''}`}
                    onClick={() => setUploadType('text')}
                    disabled={uploading || (!!result && uploadType !== 'text')}
                    title="텍스트"
                >
                    <TextIcon className="m-type-tab-icon" />
                    <span>텍스트</span>
                </button>
                <button
                    className={`m-type-tab ${uploadType === 'url' ? 'active' : ''}`}
                    onClick={() => setUploadType('url')}
                    disabled={uploading || (!!result && uploadType !== 'url')}
                    title="URL"
                >
                    <LinkIcon className="m-type-tab-icon" />
                    <span>URL</span>
                </button>
            </div>

            {/*  결과 화면 (텍스트, URL)  */}
            {result && uploadType !== 'file' ? (
                <TextUrlResultPanel />
            ) : (
                <form onSubmit={handleUpload} className="m-form">
                    {/* 파일 모드 */}
                    {uploadType === 'file' && (
                        result ? <FileResultPanel /> :
                        uploading ? <UploadingPanel /> :
                        <FilePickArea />
                    )}

                    {/* 텍스트 모드 */}
                    {uploadType === 'text' && (
                        <textarea
                            className="m-textarea"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            disabled={uploading}
                            rows={8}
                            placeholder="여기에 텍스트를 입력하세요."
                        />
                    )}

                    {/*  URL 모드  */}
                    {uploadType === 'url' && (
                        <input
                            className="m-input"
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={uploading}
                            placeholder="https://example.com"
                        />
                    )}

                    {/*  암호 설정  */}
                    {!result && (
                        <div className="m-password-group">
                            <label className="m-label" htmlFor="m-password-input">
                                암호 설정 <span className="m-optional">(선택사항)</span>
                            </label>
                            <input
                                id="m-password-input"
                                className="m-input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={uploading}
                                placeholder="다운로드할 때 사용할 암호"
                            />
                        </div>
                    )}

                    {/*  에러  */}
                    {error && <div className="m-error">{error}</div>}

                    {/*  비로그인 안내  */}
                    {!isAuthenticated && !result && (
                        <div className="m-info-badge">
                            최대 2GB까지 업로드 가능 · <a href="/auth" className="m-info-link">로그인</a>하면 100GB까지 가능해요
                        </div>
                    )}

                    {/*  액션 버튼 (그 화면 아래 sticky로 고정된 footer)  */}
                    {!result && (
                        <div className="m-action-bar">
                            {uploading ? (
                                <button
                                    type="button"
                                    className="m-btn m-btn-danger m-btn-full"
                                    onClick={handleCancelUpload}
                                >
                                    업로드 취소
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="m-btn m-btn-primary m-btn-full"
                                >
                                    {getButtonText()}
                                </button>
                            )}
                        </div>
                    )}
                </form>
            )}
        </div>
    );
}
