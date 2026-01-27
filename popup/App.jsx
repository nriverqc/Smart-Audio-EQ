import React, { useState, useEffect } from 'react';
import Equalizer from './Equalizer';
import { PRESETS, IS_PREMIUM_PRESET } from './presets';
import { auth, db, googleProvider } from '../firebase';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [enabled, setEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [currentPreset, setCurrentPreset] = useState('flat');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    // Check state from storage
    chrome.storage.local.get(['enabled', 'isPremium', 'currentPreset'], (result) => {
      if (result.enabled) setEnabled(true);
      if (result.isPremium) setIsPremium(true);
      if (result.currentPreset) setCurrentPreset(result.currentPreset);
    });

    // Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email);
        
        // Listen to Firestore for Premium status changes in real-time
        const unsubDoc = onSnapshot(doc(db, "usuarios", user.uid), (docSnap) => {
          const data = docSnap.data();
          if (data && data.isPremium) {
            setIsPremium(true);
            chrome.storage.local.set({ isPremium: true });
          } else {
            setIsPremium(false);
            chrome.storage.local.set({ isPremium: false });
          }
        }, (error) => {
            console.error("Error listening to user doc:", error);
        });

        return () => unsubDoc();
      } else {
        setUserEmail('');
        // Optional: Keep isPremium true if offline? 
        // For now, let's not force false immediately to avoid flickering if checks fail, 
        // but strictly speaking, if not logged in, we can't verify.
        // Let's rely on storage for offline, but if we know we are logged out, maybe prompt login.
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
      signInWithPopup(auth, googleProvider).then((result) => {
          console.log("Logged in:", result.user.email);
      }).catch((error) => {
          console.error("Login failed:", error);
          alert("Login failed: " + error.message);
      });
  };


  const toggleEq = async () => {
    const newState = !enabled;
    setEnabled(newState);
    
    if (newState) {
      chrome.runtime.sendMessage({ type: 'ENABLE_EQ' }, (response) => {
          if (response && !response.success) {
              console.error(response.error);
              setEnabled(false); // Revert if failed
              alert("Failed to enable EQ: " + response.error);
          }
      });
    } else {
      chrome.runtime.sendMessage({ type: 'DISABLE_EQ' });
    }
  };

  const handleGoPremium = () => {
    // Open the REAL premium page
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
        const emailParam = (userInfo && userInfo.email) ? `?email=${encodeURIComponent(userInfo.email)}` : '';
        chrome.tabs.create({ url: `https://smart-audio-eq.pages.dev/premium${emailParam}` });
    });
  };

  const handlePresetChange = (e) => {
    const presetKey = e.target.value;
    
    if (IS_PREMIUM_PRESET(presetKey) && !isPremium) {
        alert("This is a Premium preset! Upgrade to unlock.");
        return;
    }

    setCurrentPreset(presetKey);
    chrome.storage.local.set({ currentPreset: presetKey });

    const gains = PRESETS[presetKey];
    if (gains) {
        // Apply gains
        gains.forEach((gain, i) => {
            chrome.runtime.sendMessage({ type: "SET_GAIN", index: i, value: gain });
        });
        // Force update equalizer UI by passing gains down? 
        // Better: Equalizer component should listen to preset changes or we pass key
    }
  };

  const onUserAdjust = (newGains) => {
    if (currentPreset !== 'custom') {
      setCurrentPreset('custom');
      chrome.storage.local.set({ currentPreset: 'custom' });
    }
    chrome.storage.local.set({ customGains: newGains });
  };

  return (
    <div>
      <div className="controls">
        <h3>Smart Audio EQ</h3>
        {isPremium && <span className="premium-badge">PRO</span>}
      </div>

      {userEmail ? (
        <div style={{fontSize: '0.75rem', color: '#888', textAlign: 'center', marginBottom: '10px', background: '#222', padding: '5px', borderRadius: '4px'}}>
            👤 <span style={{color: '#fff'}}>{userEmail}</span>
            {isPremium ? (
                <span style={{color: '#ffd700', marginLeft: '5px', fontWeight: 'bold'}}>• PREMIUM 💎</span>
            ) : (
                <span style={{color: '#ccc', marginLeft: '5px'}}>• Free</span>
            )}
        </div>
      ) : (
         <div style={{textAlign: 'center', marginBottom: '10px'}}>
             <button onClick={handleLogin} style={{background: '#4285F4', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem'}}>
                 Sign in with Google
             </button>
         </div>
      )}

      <div className="controls">
        <span>Power</span>
        <button 
          className={`toggle-btn ${enabled ? 'active' : ''}`}
          onClick={toggleEq}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="controls" style={{justifyContent: 'center', background: 'transparent'}}>
          <select 
            value={currentPreset} 
            onChange={handlePresetChange}
            style={{
                background: '#333', color: '#fff', border: '1px solid #555', 
                padding: '5px', borderRadius: '4px', width: '100%'
            }}
          >
              <optgroup label="Free Presets">
                  <option value="flat">Flat (Default)</option>
                  <option value="vocal">Vocal Boost</option>
                  <option value="guitar">Guitar Boost</option>
                  <option value="bass-light">Bass Light</option>
                  <option value="custom">Custom (Your settings)</option>
              </optgroup>
              <optgroup label="Premium Presets (PRO)">
                  <option value="studio" disabled={!isPremium}>Studio {isPremium ? '' : '🔒'}</option>
                  <option value="bass-pro" disabled={!isPremium}>Bass Pro {isPremium ? '' : '🔒'}</option>
                  <option value="gaming" disabled={!isPremium}>Gaming {isPremium ? '' : '🔒'}</option>
                  <option value="cinema" disabled={!isPremium}>Cinema {isPremium ? '' : '🔒'}</option>
                  <option value="edm" disabled={!isPremium}>EDM / Trap {isPremium ? '' : '🔒'}</option>
                  <option value="podcast" disabled={!isPremium}>Podcast {isPremium ? '' : '🔒'}</option>
              </optgroup>
          </select>
      </div>

      <Equalizer 
        enabled={enabled} 
        isPremium={isPremium} 
        currentPreset={currentPreset}
        presetGains={PRESETS[currentPreset]}
        onUserAdjust={onUserAdjust}
      />

      {!isPremium && (
        <div style={{marginTop: '1rem', textAlign: 'center'}}>
          <button onClick={handleGoPremium} style={{background: 'none', border: '1px solid #ffcc00', color: '#ffcc00', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px'}}>
            Get Premium 💎
          </button>
        </div>
      )}
    </div>
  );
}
