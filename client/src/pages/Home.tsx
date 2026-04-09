import { Link } from 'react-router';
import './Home.css';
import { ShieldCheckIcon, CloudUploadIcon, LightningIcon, ClockIcon, InfoIcon, CopyIcon } from '../components/icons';

export default function Home() {
    return (
        <div className="page home-page">
            <div className="hero">
                <h1>SendBox에 오신것을 환영해요.</h1>
                <p className="subtitle">
                    안전하게 단대단 암호화 파일 및 텍스트, URL를 공유하세요.
                </p>

                <div className="cta-buttons">
                    <Link to="/upload" className="btn btn-primary">
                        업로드
                    </Link>
                    <Link to="/download" className="btn btn-secondary">
                        다운로드
                    </Link>
                </div>
            </div>

            <div className="info-section">
                <h2>주요 기능 및 특징</h2>
                
                <div className="features">
                    <div className="feature">
                        <ShieldCheckIcon className="feature-icon" />
                        <h3>보안</h3>
                        <p>단대단 파일 암호화를 통해 서버는 복호화된 파일이 저장되지 않습니다.</p>
                    </div>

                    <div className="feature">
                        <CloudUploadIcon className="feature-icon" />
                        <h3>대용량 파일 업로드</h3>
                        <p>로그인 시 최대 100GB까지 대용량 파일을 안전하게 업로드할 수 있습니다.</p>
                    </div>

                    <div className="feature">
                        <LightningIcon className="feature-icon" />
                        <h3>빠른 속도</h3>
                        <p>빠르게 업로드하고 6자리 숫자 키로 편리하게 다운로드할 수 있습니다.</p>
                    </div>

                    <div className="feature">
                        <ClockIcon className="feature-icon" />
                        <h3>자동 삭제</h3>
                        <p>파일은 다운로드 후 삭제되며, 다운로드되지 않을 시 12시간 후 만료됩니다.</p>
                    </div>

                    <div className="feature">
                        <InfoIcon className="feature-icon" />
                        <h3>실시간 진행률</h3>
                        <p>업로드 및 다운로드 진행 상황을 실시간으로 확인할 수 있습니다.</p>
                    </div>

                    <div className="feature">
                        <CopyIcon className="feature-icon" />
                        <h3>등록 불필요</h3>
                        <p>회원가입 없이도 파일을 공유할 수 있으며, 로그인하면 업로드 가능한 용량이 증가합니다.</p>
                    </div>
                </div>

                <div className="tech-stack">
                    <h2>기술 스택</h2>
                    <div className="tech-categories">
                        <div className="tech-category">
                            <h3>Frontend</h3>
                            <div className="tech-tags">
                                <span className="tech-tag">React</span>
                                <span className="tech-tag">TypeScript</span>
                                <span className="tech-tag">Vite</span>
                                <span className="tech-tag">Redux Toolkit</span>
                                <span className="tech-tag">React Router</span>
                            </div>
                        </div>
                        <div className="tech-category">
                            <h3>Backend</h3>
                            <div className="tech-tags">
                                <span className="tech-tag">Node.js</span>
                                <span className="tech-tag">Express</span>
                                <span className="tech-tag">PostgreSQL</span>
                                <span className="tech-tag">WebSocket</span>
                                <span className="tech-tag">AES-256</span>
                                <span className="tech-tag">JWT</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="limits">
                    <h3>업로드 제한</h3>
                    <ul>
                        <li>무료 사용자: 파일당 최대 2GB</li>
                        <li>로그인 사용자: 파일당 최대 100GB</li>
                        <li>IP 주소당 최대 100GB 총 저장 용량</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
