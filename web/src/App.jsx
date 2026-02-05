import { createContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Premium from './pages/Premium';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

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
  const location = useLocation();

  // REPLACE THIS WITH YOUR ACTUAL EXTENSION ID from chrome://extensions
  // e.g. "abcdefghijklmnop..."
  const EXTENSION_ID = "edblkdnmdjodkbolefojlgdfkmbkplpf"; 

  const syncWithExtension = (userData) => {
    // Save to localStorage for Content Script to read
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

    // 1. Send via Window Message (for Content Script)
    window.postMessage({
        type: "LOGIN_EXITOSO",
        uid: userData.uid,
        email: userData.email,
        isPremium: userData.isPremium
    }, "*");

    // 2. Send via Runtime Message (Directly to Extension Background if allowed)
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
        try {
            // Using "LOGIN_SUCCESS" to match user request, but keeping "LOGIN_EXITOSO" structure support in background
            window.chrome.runtime.sendMessage(EXTENSION_ID, {
                type: "LOGIN_SUCCESS", // User preferred name
                accion: "SYNC_USER",   // Fallback name
                uid: userData.uid,
                email: userData.email,
                isPremium: userData.isPremium,
                user: { // Nesting user object as per user example
                    uid: userData.uid,
                    email: userData.email,
                    isPremium: userData.isPremium
                },
                nombre: userData.displayName || '',
                foto: userData.photoURL || ''
            }, (response) => {
                 if (window.chrome.runtime.lastError) {
                     console.log("Extension not found or not installed.");
                 } else {
                     console.log("Extension response:", response);
                 }
            });
        } catch (e) {
            console.log("Could not sync with extension directly:", e);
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
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [user]);

  // Ensure data is always in localStorage when user is logged in
  useEffect(() => {
    if (user.email && user.uid) {
        try {
            localStorage.setItem('user_sync_data', JSON.stringify({
                uid: user.uid,
                email: user.email,
                isPremium: user.isPremium,
                nombre: user.displayName,
                foto: user.photoURL
            }));
        } catch (e) {
            console.error("Error saving to localStorage:", e);
        }
    }
  }, [user]);

  const loginWithGoogle = () => {
    signInWithPopup(auth, googleProvider)
      .then((result) => {
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

  return (
    <UserContext.Provider value={{ user, setUser, lang, refreshUser, loginWithGoogle, logout }}>
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
                               {user.isPremium ? (lang === 'es' ? 'PREMIUM 💎' : 'PREMIUM 💎') : (lang === 'es' ? 'GRATIS' : 'FREE')}
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
                    {lang === 'es' ? 'Iniciar Sesión' : 'Login'}
                 </button>
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
