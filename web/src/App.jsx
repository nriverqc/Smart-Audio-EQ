import { createContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Premium from './pages/Premium';
import Privacy from './pages/Privacy';
import SupportWidget from './components/SupportWidget';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import AdBlockNotice from './components/AdBlockNotice';

export const UserContext = createContext(null);

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

function AppContent() {
  const [lang, setLang] = useState('es');
  const [user, setUser] = useState({ 
    email: '', 
    uid: '', 
    displayName: '', 
    photoURL: '', 
    isPremium: false, 
    loading: true 
  });

  // Automatic Language Detection
  useEffect(() => {
    const browserLang = navigator.language.split('-')[0];
    const supportedLangs = ['es', 'en', 'pt', 'de'];
    if (supportedLangs.includes(browserLang)) {
      setLang(browserLang);
    } else {
      setLang('en'); // Default to English if not supported
    }
  }, []);

  // REPLACE THIS WITH YOUR ACTUAL EXTENSION ID from chrome://extensions
  // e.g. "abcdefghijklmnop..."
  const EXTENSION_ID = "aohaefkkofgkbneodjflnacpipdnfeng"; 

  const syncWithExtension = (userData) => {
    console.log("Web: Syncing with extension...", userData.email, "Premium:", userData.isPremium);
    
    // 1. Update localStorage (for Content Script initial check)
    try {
        localStorage.setItem('user_sync_data', JSON.stringify({
            uid: userData.uid,
            email: userData.email,
            isPremium: userData.isPremium,
            nombre: userData.displayName,
            foto: userData.photoURL
        }));
    } catch (e) {
        console.error("Error saving to localStorage:", e);
    }

    // 2. Relay via Window Message (for Content Script bridge)
    window.postMessage({
        type: "LOGIN_EXITOSO",
        uid: userData.uid,
        email: userData.email,
        isPremium: userData.isPremium
    }, "*");

    // 3. Direct Runtime Message (if ID matches)
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
        try {
            window.chrome.runtime.sendMessage(EXTENSION_ID, {
                type: "LOGIN_EXITOSO",
                accion: "SYNC_USER",
                uid: userData.uid,
                email: userData.email,
                isPremium: userData.isPremium,
                user: userData
            }, (response) => {
                 if (window.chrome.runtime.lastError) {
                     console.log("Extension direct sync failed (expected in dev mode if ID differs)");
                 } else {
                     console.log("Extension direct sync success:", response);
                 }
            });
        } catch (e) {
            console.log("Could not send direct message:", e);
        }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log("Sesión activa:", firebaseUser.email);
        // Check license in backend
        fetch(`${API_BASE}/check-license?email=${firebaseUser.email}&uid=${firebaseUser.uid}`)
          .then(res => res.json())
          .then(data => {
            const updatedUser = { 
              email: firebaseUser.email, 
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              isPremium: data.premium, 
              loading: false 
            };
            setUser(updatedUser);
            // Sync with extension
            syncWithExtension(updatedUser);

            // Sync user to Firestore to ensure document exists
            fetch(`${API_BASE}/sync-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL
                })
            }).catch(e => console.error("Sync error:", e));
          })
          .catch(err => {
            console.error("Error checking license:", err);
            const fallbackUser = { 
              email: firebaseUser.email, 
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              isPremium: false, 
              loading: false 
            };
            setUser(fallbackUser);
            syncWithExtension(fallbackUser);
          });
      } else {
        console.log("No hay sesión.");
        setUser({ email: '', uid: '', displayName: '', photoURL: '', isPremium: false, loading: false });
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for requests from the extension to resend session data
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== window) return;
      if (event.data.type === "REQUEST_SESSION") {
        console.log("Web: Received session request from extension");
        if (user.email) {
           console.log("Web: Resending session data...", user);
           syncWithExtension(user);
        } else {
           console.log("Web: No user session to send.");
        }
      }
      if (event.data.type === "PREMIUM_ACTIVADO_EXT") {
        console.log("Web: Extension reported Premium activation! Refreshing...");
        refreshUser();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [user]);

  // Ensure data is synced whenever user state changes
  useEffect(() => {
    if (user.email && user.uid) {
        syncWithExtension(user);
    }
  }, [user.isPremium, user.email, user.uid]);

  const loginWithGoogle = () => {
    signInWithPopup(auth, googleProvider)
      .then(() => {
        // User info handled by onAuthStateChanged
      })
      .catch((error) => {
        console.error("Login Error:", error.message);
        alert("Login Error: " + error.message);
      });
  };

  const logout = () => {
    signOut(auth);
  };

  const refreshUser = () => {
     if (user.email) {
        fetch(`${API_BASE}/check-license?email=${user.email}&uid=${user.uid}`)
        .then(res => res.json())
        .then(data => {
          setUser(prev => ({ ...prev, isPremium: data.premium }));
        });
     }
  };

  const requestExtensionAppPassCheck = () => {
      window.postMessage({ type: "CHECK_APP_PASS_REQUEST" }, "*");
  };

  const langLabels = {
    es: { label: 'Español', flag: '/flags/es.svg', premium: 'PREMIUM 💎', free: 'GRATIS', home: 'Inicio', goPremium: 'Ir a Premium', footer: 'Todos los derechos reservados.', privacy: 'Política de Privacidad', login: 'Iniciar Sesión' },
    en: { label: 'English', flag: '/flags/en.svg', premium: 'PREMIUM 💎', free: 'FREE', home: 'Home', goPremium: 'Go Premium', footer: 'All rights reserved.', privacy: 'Privacy Policy', login: 'Login' },
    pt: { label: 'Português', flag: '/flags/pt.svg', premium: 'PREMIUM 💎', free: 'GRÁTIS', home: 'Início', goPremium: 'Ir para Premium', footer: 'Todos os direitos reservados.', privacy: 'Política de Privacidade', login: 'Entrar' },
    de: { label: 'Deutsch', flag: '/flags/de.svg', premium: 'PREMIUM 💎', free: 'KOSTENLOS', home: 'Startseite', goPremium: 'Zu Premium wechseln', footer: 'Alle Rechte vorbehalten.', privacy: 'Datenschutz', login: 'Anmelden' }
  };

  const [showLangMenu, setShowLangMenu] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLangMenu && !event.target.closest('.lang-switcher-container')) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLangMenu]);

  return (
    <UserContext.Provider value={{ user, setUser, lang, refreshUser, loginWithGoogle, logout, requestExtensionAppPassCheck }}>
      <AdBlockNotice />
      <div className="app-root">
        <div className="floating-icons-container">
            {/* Random floating music notes */}
            <div className="floating-icon" style={{ left: '5%', animationDelay: '0s', fontSize: '3rem' }}>🎵</div>
            <div className="floating-icon" style={{ left: '15%', animationDelay: '5s', fontSize: '2rem' }}>🎼</div>
            <div className="floating-icon" style={{ left: '25%', animationDelay: '2s', fontSize: '4rem' }}>🎶</div>
            <div className="floating-icon" style={{ left: '35%', animationDelay: '7s', fontSize: '2.5rem' }}>🎹</div>
            <div className="floating-icon" style={{ left: '45%', animationDelay: '1s', fontSize: '3rem' }}>🎧</div>
            <div className="floating-icon" style={{ left: '55%', animationDelay: '6s', fontSize: '3.5rem' }}>🎷</div>
            <div className="floating-icon" style={{ left: '65%', animationDelay: '3s', fontSize: '2.8rem' }}>🎸</div>
            <div className="floating-icon" style={{ left: '75%', animationDelay: '8s', fontSize: '4.2rem' }}>🎻</div>
            <div className="floating-icon" style={{ left: '85%', animationDelay: '4s', fontSize: '3.2rem' }}>🥁</div>
            <div className="floating-icon" style={{ left: '95%', animationDelay: '9s', fontSize: '2.5rem' }}>🎵</div>
            <div className="floating-icon" style={{ left: '10%', animationDelay: '11s', fontSize: '3.5rem' }}>📻</div>
            <div className="floating-icon" style={{ left: '30%', animationDelay: '13s', fontSize: '2.2rem' }}>🎤</div>
            <div className="floating-icon" style={{ left: '60%', animationDelay: '10s', fontSize: '4rem' }}>🎺</div>
            <div className="floating-icon" style={{ left: '80%', animationDelay: '12s', fontSize: '3rem' }}>🎼</div>
        </div>
        <div className="eq-background">
          {Array.from({ length: 120 }).map((_, i) => (
            <div key={i} className="eq-bar" />
          ))}
        </div>
        <div className="container">
          <nav>
            <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00d2ff', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              Smart Audio EQ
              <span className="beta-badge" style={{fontSize: '0.5em', marginLeft: '10px'}}>BETA</span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               
               {/* Profile Section */}
               {user.email ? (
                   <div style={{display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '20px'}}>
                       <div style={{fontSize: '0.8rem', textAlign: 'right'}}>
                           <div style={{color: '#ccc'}}>{user.displayName || user.email.split('@')[0]}</div>
                           <div style={{color: user.isPremium ? '#ffd700' : '#aaa', fontWeight: 'bold', fontSize: '0.7rem'}}>
                               {user.isPremium ? currentLang.premium : currentLang.free}
                           </div>
                       </div>
                       {user.photoURL ? (
                         <img src={user.photoURL} alt="Profile" style={{width: '30px', height: '30px', borderRadius: '50%'}} />
                       ) : (
                         <div style={{width: '30px', height: '30px', borderRadius: '50%', background: user.isPremium ? '#ffd700' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold'}}>
                             {user.email[0].toUpperCase()}
                         </div>
                       )}
                       <button onClick={logout} style={{background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '5px'}}>
                         ✕
                       </button>
                   </div>
               ) : (
                 <button onClick={loginWithGoogle} className="btn-premium" style={{padding: '5px 10px', fontSize: '0.9rem'}}>
                    {currentLang.login}
                 </button>
               )}

              {/* Language Switcher with Dropdown/Flags */}
              <div 
                className="lang-switcher-container" 
                style={{ position: 'relative' }}
              >
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    minWidth: '120px'
                  }}
                >
                  <img src={currentLang.flag} alt={currentLang.label} style={{ width: '20px', height: 'auto', borderRadius: '2px' }} />
                  {currentLang.label}
                  <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', transform: showLangMenu ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                </button>
                
                {showLangMenu && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    right: 0,
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    zIndex: 1000,
                    minWidth: '160px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                  }}>
                    {Object.keys(langLabels).map((l) => (
                      <button
                        key={l}
                        onClick={() => { setLang(l); setShowLangMenu(false); }}
                        style={{
                          width: '100%',
                          background: lang === l ? 'rgba(0, 210, 255, 0.1)' : 'transparent',
                          border: 'none',
                          color: lang === l ? '#00d2ff' : '#fff',
                          padding: '10px 15px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          textAlign: 'left',
                          transition: 'background 0.2s'
                        }}
                      >
                        <img src={langLabels[l].flag} alt={langLabels[l].label} style={{ width: '18px', height: 'auto', borderRadius: '1px' }} />
                        {langLabels[l].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Link to="/" style={{ marginRight: '20px', color: '#fff', textDecoration: 'none' }}>
                  {currentLang.home}
                </Link>
                {!user.isPremium && (
                    <Link to="/premium" className="btn-premium">
                    {currentLang.goPremium}
                    </Link>
                )}
              </div>
            </div>
          </nav>

          <Routes>
            <Route path="/" element={<Home lang={lang} />} />
            <Route path="/premium" element={<Premium lang={lang} />} />
            <Route path="/privacy" element={<Privacy lang={lang} />} />
          </Routes>

          <footer>
            <p>© 2026 Smart Audio EQ. {currentLang.footer} <span style={{opacity: 0.3, fontSize: '0.8em'}}>v1.2 (20k)</span></p>
            <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>
              <Link to="/privacy" style={{ color: '#aaa', textDecoration: 'none' }}>
                {currentLang.privacy}
              </Link>
            </p>
          </footer>
          
          {/* Support Widget */}
          <SupportWidget user={user} lang={lang} />
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
