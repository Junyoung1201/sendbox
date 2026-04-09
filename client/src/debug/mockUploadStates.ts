/**
 * 디자인 테스트용 모의 업로드 상태 디버그 도구
 * 
 * 이 파일을 삭제하고 Upload.tsx에서 import를 제거하면
 * 모든 디버그 기능이 제거됩니다.
 * 
 * 사용법:
 * - F1: 가짜 업로드 중 상태 시작
 * - F2: 가짜 다운로드 진행 상태 시작
 * - F3: 모든 모의 상태 초기화
 */

export interface MockUploadCallbacks {
    setUploading: (value: boolean) => void;
    setEncryptProgress: (value: number) => void;
    setUploadProgress: (value: number) => void;
    setResult: (value: any | null) => void;
    setPeerDownloadProgress: (value: number) => void;
    setPeerDownloadComplete: (value: boolean) => void;
    setFile: (value: File | null) => void;
}

let activeIntervals: number[] = [];

const clearAllIntervals = () => {
    activeIntervals.forEach(id => clearInterval(id));
    activeIntervals = [];
};

// F1: 가짜 업로드 시뮬레이션
const mockUploadProcess = (callbacks: MockUploadCallbacks) => {
    clearAllIntervals();
    
    const {
        setUploading,
        setEncryptProgress,
        setUploadProgress,
        setResult,
        setFile
    } = callbacks;

    // 가짜 파일 생성
    const mockFile = new File([''], 'test-video.mp4', { type: 'video/mp4' });
    Object.defineProperty(mockFile, 'size', { value: 5368709120 }); // 5GB
    setFile(mockFile);

    console.log('🎬 [Mock] 업로드 시뮬레이션 시작 (F1)');
    setUploading(true);
    setEncryptProgress(0);
    setUploadProgress(0);

    // 암호화 진행
    let encryptPercent = 0;
    const encryptInterval = window.setInterval(() => {
        encryptPercent += Math.random() * 15;
        if (encryptPercent >= 100) {
            encryptPercent = 100;
            setEncryptProgress(100);
            clearInterval(encryptInterval);

            // 암호화 완료 후 업로드 시작
            setTimeout(() => {
                let uploadPercent = 0;
                const uploadInterval = window.setInterval(() => {
                    uploadPercent += Math.random() * 10;
                    if (uploadPercent >= 100) {
                        uploadPercent = 100;
                        setUploadProgress(100);
                        clearInterval(uploadInterval);

                        // 업로드 완료
                        setTimeout(() => {
                            setUploading(false);
                            setEncryptProgress(0);
                            setUploadProgress(0);
                            setResult({
                                fileKey: '123456',
                                fileName: 'test-video.mp4',
                                fileSize: 5368709120,
                                expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
                            });
                            console.log('✅ [Mock] 업로드 완료 - 결과 표시');
                        }, 500);
                    } else {
                        setUploadProgress(Math.round(uploadPercent));
                    }
                }, 200);
                activeIntervals.push(uploadInterval);
            }, 300);
        } else {
            setEncryptProgress(Math.round(encryptPercent));
        }
    }, 300);
    activeIntervals.push(encryptInterval);
};

// F2: 가짜 다운로드 진행 시뮬레이션
const mockDownloadProcess = (callbacks: MockUploadCallbacks) => {
    clearAllIntervals();
    
    const {
        setPeerDownloadProgress,
        setPeerDownloadComplete,
        setResult,
        setFile
    } = callbacks;

    // 업로드 완료 상태가 아니면 먼저 설정
    setFile(new File([''], 'test-document.pdf', { type: 'application/pdf' }));
    setResult({
        fileKey: '789012',
        fileName: 'test-document.pdf',
        fileSize: 2147483648,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    });

    console.log('📥 [Mock] 다운로드 시뮬레이션 시작 (F2)');
    setPeerDownloadProgress(0);
    setPeerDownloadComplete(false);

    let downloadPercent = 0;
    const downloadInterval = window.setInterval(() => {
        downloadPercent += Math.random() * 8;
        if (downloadPercent >= 100) {
            downloadPercent = 100;
            setPeerDownloadProgress(100);
            clearInterval(downloadInterval);

            // 다운로드 완료
            setTimeout(() => {
                setPeerDownloadComplete(true);
                console.log('✅ [Mock] 다운로드 완료 - 완료 화면 표시');
            }, 500);
        } else {
            setPeerDownloadProgress(Math.round(downloadPercent));
        }
    }, 400);
    activeIntervals.push(downloadInterval);
};

// F3: 모든 상태 초기화
const resetMockStates = (callbacks: MockUploadCallbacks) => {
    clearAllIntervals();
    
    const {
        setUploading,
        setEncryptProgress,
        setUploadProgress,
        setResult,
        setPeerDownloadProgress,
        setPeerDownloadComplete,
        setFile
    } = callbacks;

    console.log('🔄 [Mock] 모든 상태 초기화 (F3)');
    setUploading(false);
    setEncryptProgress(0);
    setUploadProgress(0);
    setResult(null);
    setPeerDownloadProgress(0);
    setPeerDownloadComplete(false);
    setFile(null);
};

/**
 * 키보드 이벤트 리스너 등록
 * Upload 컴포넌트의 useEffect에서 호출
 */
export const registerMockUploadHandlers = (callbacks: MockUploadCallbacks) => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // F1: 업로드 시뮬레이션
        if (e.key === 'F1') {
            e.preventDefault();
            mockUploadProcess(callbacks);
        }
        // F2: 다운로드 시뮬레이션
        else if (e.key === 'F2') {
            e.preventDefault();
            mockDownloadProcess(callbacks);
        }
        // F3: 초기화
        else if (e.key === 'F3') {
            e.preventDefault();
            resetMockStates(callbacks);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    console.log('🔧 [Mock] 디버그 모드 활성화: F1(업로드), F2(다운로드), F3(초기화)');

    // cleanup 함수 반환
    return () => {
        clearAllIntervals();
        window.removeEventListener('keydown', handleKeyDown);
        console.log('🔧 [Mock] 디버그 모드 비활성화');
    };
};
