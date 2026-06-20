import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Gallery from './pages/Gallery';
import Explore from './pages/Explore';
import GuardianDashboard from './pages/GuardianDashboard';
import AuthPage from './pages/AuthPage';
import './App.css';

function NavBar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <span className="brand-icon">🌍</span> TravelGuardian
      </Link>
      <div className="nav-links">
        <Link to="/">Explore</Link>
        <Link to="/guardian">Guardian</Link>
        {user ? (
          <button onClick={onLogout} className="nav-btn">{user.email} · Logout</button>
        ) : (
          <Link to="/auth" className="nav-btn-primary">Sign In</Link>
        )}
      </div>
    </nav>
  );
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const handleAuth = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <>
      <NavBar user={user} onLogout={handleLogout} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/explore/:id" element={<Explore token={token} user={user} />} />
          <Route path="/guardian" element={<GuardianDashboard token={token} user={user} />} />
          <Route path="/auth" element={<AuthPage onAuth={handleAuth} />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
