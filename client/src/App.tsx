import { useEffect } from 'react';
import { Routes, Route } from 'react-router';
import { useAppDispatch } from './hooks/useRedux';
import { checkAuth } from './store/authSlice';
import Header from './components/Header';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Download from './pages/Download';
import Auth from './pages/Auth';
import './styles/global.css';
import './styles/common.css';


function App() {
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(checkAuth());
    }, [dispatch]);

    return (
        <div className="app">
            <Header />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/upload" element={<Upload />} />
                    <Route path="/download" element={<Download />} />
                    <Route path="/auth" element={<Auth />} />
                </Routes>
            </main>
            <footer className="footer">
                <p>© 2026 이준영 - 웹 포트폴리오</p>
            </footer>
        </div>
    );
}

export default App;
