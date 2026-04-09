import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { register, login, clearError } from '../store/authSlice';
import './Auth.css';

export default function Auth() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { loading, error, isAuthenticated } = useAppSelector((state) => state.auth);

    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // 이미 인증되어 있으면 로그인 페이지에서 나오기
    if (isAuthenticated) {
        navigate('/');
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        dispatch(clearError());

        if (!email || !password) {
            alert('모든 입력란을 채워주세요!');
            return;
        }

        if (!isLogin && password !== confirmPassword) {
            alert('비밀번호가 일치하지 않아요.');
            return;
        }

        if (isLogin) {
            await dispatch(login({ email, password })).unwrap();
        } else {
            await dispatch(register({ email, password })).unwrap();
        }
        navigate('/');
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        dispatch(clearError());
        setEmail('');
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="page auth-page">
            <div className="auth-container">
                <h1>{isLogin ? '로그인' : '회원가입'}</h1>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email">이메일</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">비밀번호</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <label htmlFor="confirm-password">비밀번호 재입력</label>
                            <input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? '잠시만 기다려주세요...' : isLogin ? '로그인' : '회원가입'}
                    </button>
                </form>

                <div className="auth-toggle">
                    <p>
                        {isLogin ? "아직 계정이 없으신가요?" : '이미 계정이 있으신가요?'}
                        {' '}
                        <button type="button" onClick={toggleMode} className="link-button">
                            {isLogin ? '회원가입' : '로그인'}
                        </button>
                    </p>
                </div>

                {!isLogin && (
                    <div className="info-box">
                        <p>2GB 이상을 업로드하려면 로그인이 필요해요!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
