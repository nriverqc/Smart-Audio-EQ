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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log("Sesión activa:", firebaseUser.email);
        // Check license in backend
        fetch(`${API_BASE}/check-license?email=${firebaseUser.email}&uid=${firebaseUser.uid}`)
          .then(res => res.json())
          .then(data => {
            setUser({ 
              email: firebaseUser.email, 
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              isPremium: data.premium, 
              loading: false 
            });
          })
          .catch(err => {
            console.error("Error checking license:", err);
            setUser({ 
              email: firebaseUser.email, 
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              isPremium: false, 
              loading: false 
            });
          });
      } else {
        console.log("No hay sesión.");
        setUser({ email: '', uid: '', displayName: '', photoURL: '', isPremium: false, loading: false });
      }
    });

    return () => unsubscribe();
  }, []);

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
