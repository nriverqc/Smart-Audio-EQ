import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Premium from './pages/Premium';

export default function App() {
  const [lang, setLang] = useState('es');

  return (
    <BrowserRouter>
      <div className="app-root">
        <div className="eq-background">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="eq-bar" />
          ))}
        </div>
        <div className="container">
          <nav>
            <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00d2ff' }}>
              Smart Audio EQ
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                <Link to="/" style={{ marginRight: '20px' }}>
                  {lang === 'es' ? 'Inicio' : 'Home'}
                </Link>
                <Link to="/premium" className="btn-premium">
                  {lang === 'es' ? 'Ir a Premium' : 'Go Premium'}
                </Link>
              </div>
            </div>
          </nav>

          <Routes>
            <Route path="/" element={<Home lang={lang} />} />
            <Route path="/premium" element={<Premium lang={lang} />} />
          </Routes>

          <footer>
            <p>© 2026 Smart Audio EQ. {lang === 'es' ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}
