import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Premium from './pages/Premium';

export const UserContext = createContext(null);

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

function AppContent() {
  const [lang, setLang] = useState('es');
  const [user, setUser] = useState({ email: '', isPremium: false, loading: true });
  const location = useLocation();

  useEffect(() => {
    // 1. Check URL params for email (from extension)
    const params = new URLSearchParams(location.search);
    const emailFromUrl = params.get('email');
    
    // 2. Check localStorage
    const savedEmail = localStorage.getItem('saeq_email');
    
    const finalEmail = emailFromUrl || savedEmail;

    if (finalEmail) {
      if (emailFromUrl) {
        localStorage.setItem('saeq_email', emailFromUrl);
        // Clean URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Check license
      fetch(`${API_BASE}/check-license?email=${finalEmail}`)
        .then(res => res.json())
        .then(data => {
          setUser({ 
            email: finalEmail, 
            isPremium: data.premium, 
            loading: false 
          });
        })
        .catch(err => {
          console.error("Error checking license:", err);
          setUser({ email: finalEmail, isPremium: false, loading: false });
        });
    } else {
      setUser(prev => ({ ...prev, loading: false }));
    }
  }, [location]);

  const refreshUser = () => {
     if (user.email) {
        fetch(`${API_BASE}/check-license?email=${user.email}`)
        .then(res => res.json())
        .then(data => {
          setUser(prev => ({ ...prev, isPremium: data.premium }));
        });
     }
  };

  return (
    <UserContext.Provider value={{ user, setUser, lang, refreshUser }}>
      <div className="app-root">
        <div className="eq-background">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="eq-bar" />
          ))}
        </div>
        <div className="container">
          <nav>
            <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00d2ff', textDecoration: 'none' }}>
              Smart Audio EQ
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              
              {/* Profile Section */}
              {user.email && (
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '20px'}}>
                      <div style={{fontSize: '0.8rem', textAlign: 'right'}}>
                          <div style={{color: '#ccc'}}>{user.email.split('@')[0]}</div>
                          <div style={{color: user.isPremium ? '#ffd700' : '#aaa', fontWeight: 'bold', fontSize: '0.7rem'}}>
                              {user.isPremium ? (lang === 'es' ? 'PREMIUM 💎' : 'PREMIUM 💎') : (lang === 'es' ? 'GRATIS' : 'FREE')}
                          </div>
                      </div>
                      <div style={{width: '30px', height: '30px', borderRadius: '50%', background: user.isPremium ? '#ffd700' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold'}}>
                          {user.email[0].toUpperCase()}
                      </div>
                  </div>
              )}

              <div className="lang-switch">
                <button
                  className={lang === 'es' ? 'lang-btn active' : 'lang-btn'}
                  onClick={() => setLang('es')}
                >
                  ES
                </button>
                <span className="lang-separator">/</span>
                <button
                  className={lang === 'en' ? 'lang-btn active' : 'lang-btn'}
                  onClick={() => setLang('en')}
                >
                  EN
                </button>
              </div>
              <div>
                <Link to="/" style={{ marginRight: '20px', color: '#fff', textDecoration: 'none' }}>
                  {lang === 'es' ? 'Inicio' : 'Home'}
                </Link>
                {!user.isPremium && (
                    <Link to="/premium" className="btn-premium">
                    {lang === 'es' ? 'Ir a Premium' : 'Go Premium'}
                    </Link>
                )}
              </div>
            </div>
          </nav>

          <Routes>
            <Route path="/" element={<Home lang={lang} />} />
            <Route path="/premium" element={<Premium lang={lang} />} />
          </Routes>

          <footer>
            <p>© 2026 Smart Audio EQ. {lang === 'es' ? 'Todos los derechos reservados.' : 'All rights reserved.'} <span style={{opacity: 0.3, fontSize: '0.8em'}}>v1.2 (20k)</span></p>
          </footer>
        </div>
      </div>
    </UserContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
