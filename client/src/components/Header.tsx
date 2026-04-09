import { Link } from 'react-router';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { logout } from '../store/authSlice';
import './Header.css';

export default function Header() {
    const dispatch = useAppDispatch();
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);

    const handleLogout = () => {
        dispatch(logout());
    };

    return (
        <header className="header">
            <div className="container">
                <Link to="/" className="logo">
                    <h1>Sendbox</h1>
                </Link>

                <nav className="nav">
                    <Link to="/" className="nav-home">홈</Link>
                    <Link to="/upload">업로드</Link>
                    <Link to="/download">다운로드</Link>

                    {isAuthenticated ? (
                        <>
                            <span className="user-email">{user?.email}</span>
                            <button onClick={handleLogout} className="btn-logout">
                                로그아웃
                            </button>
                        </>
                    ) : (
                        <Link to="/auth">로그인 / 회원가입</Link>
                    )}
                </nav>
            </div>
        </header>
    );
}
