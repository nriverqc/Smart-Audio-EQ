import React, { useState, useEffect } from 'react';
import Equalizer from './Equalizer';
import { PRESETS, IS_PREMIUM_PRESET } from './presets';

export default function App() {
  const [enabled, setEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [currentPreset, setCurrentPreset] = useState('flat');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check state from storage
    const checkState = () => {
        chrome.storage.local.get(['enabled', 'isPremium', 'currentPreset', 'email', 'uid'], (result) => {
            if (result.enabled) setEnabled(true);
            if (result.isPremium) setIsPremium(true);
            if (result.currentPreset) setCurrentPreset(result.currentPreset);
            if (result.email) setUserEmail(result.email);
        });
    };

    checkState();

    // Listen for storage changes (e.g. from background.js update)
    const handleStorageChange = (changes, area) => {
        if (area === 'local') {
            if (changes.isPremium) setIsPremium(changes.isPremium.newValue);
            if (changes.email) setUserEmail(changes.email.newValue);
            if (changes.currentPreset) setCurrentPreset(changes.currentPreset.newValue);
            if (changes.enabled) setEnabled(changes.enabled.newValue);
        }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const handleLogin = () => {
      // Open the web page to login, pass email if available
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
          const emailParam = (userInfo && userInfo.email) ? `?email=${encodeURIComponent(userInfo.email)}` : '';
          chrome.tabs.create({ url: `https://smart-audio-eq.pages.dev/${emailParam}` });
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

  const refreshStatus = async () => {
    setLoading(true);
    
    // Helper to get identity email
    const getIdentityEmail = () => {
        return new Promise((resolve) => {
            chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
                resolve(userInfo ? userInfo.email : null);
            });
        });
    };

    chrome.storage.local.get(['email', 'uid'], async (items) => {
        let email = items.email;
        let uid = items.uid;

        if (!email) {
            // Try to get from identity
            email = await getIdentityEmail();
            if (email) {
                chrome.storage.local.set({ email: email });
                setUserEmail(email);
            }
        }

        if (!email) {
            // Last resort: Check if the user has the web page open and ask it directly
            // This requires "host_permissions" for the URL in manifest (which we have <all_urls>)
            console.log("No email found. Searching for web tab...");
            
            const webUrlPattern = "smart-audio-eq.pages.dev";
            
            chrome.tabs.query({}, (tabs) => {
                const webTab = tabs.find(t => t.url && t.url.includes(webUrlPattern));
                
                if (webTab) {
                    console.log("Found web tab:", webTab.id);
                    
                    // NEW METHOD: Ask content script to read localStorage
                    chrome.tabs.sendMessage(webTab.id, { type: "PREGUNTAR_DATOS" }, (response) => {
                        console.log("Web tab response:", response);
                        if (response && response.email) {
                            chrome.storage.local.set({
                                email: response.email,
                                uid: response.uid,
                                isPremium: response.isPremium
                            }, () => {
                                setUserEmail(response.email);
                                if (response.isPremium) setIsPremium(true);
                                alert("Synced with open web tab! ✅");
                                setLoading(false);
                            });
                        } else {
                            // Fallback to old method if no response (maybe content script not reloaded)
                            chrome.tabs.sendMessage(webTab.id, { type: "CHECK_WEB_SESSION" });
                            alert("Found tab, asking for session... (Check if you are logged in)");
                            setLoading(false);
                        }
                    });
                } else {
                    alert("Please login first to sync status. Opening login page...");
                    setLoading(false);
                    handleLogin();
                }
            });
            return;
        }

        try {
            const response = await fetch(`https://smart-audio-eq-api.onrender.com/check-license?email=${encodeURIComponent(email)}&uid=${encodeURIComponent(uid || '')}`);
            const data = await response.json();

            if (data.premium) {
                setIsPremium(true);
                chrome.storage.local.set({ isPremium: true });
                alert("Premium status synced! 💎");
            } else {
                alert("Status: Free. If you bought Premium, please wait a minute.");
            }
        } catch (error) {
            console.error("Sync error:", error);
            alert("Network error checking status.");
        } finally {
            setLoading(false);
        }
    });
  };

  return (
    <div>
      <div className="controls">
        <h3>Smart Audio EQ</h3>
        {isPremium && <span className="premium-badge">PRO</span>}
      </div>

      {userEmail ? (
        <div style={{fontSize: '0.75rem', color: '#888', textAlign: 'center', marginBottom: '10px', background: '#222', padding: '5px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
            <span>👤 <span style={{color: '#fff'}}>{userEmail}</span></span>
            {isPremium ? (
                <span style={{color: '#ffd700', fontWeight: 'bold'}}>• PREMIUM 💎</span>
            ) : (
                <span style={{color: '#ccc'}}>• Free</span>
            )}
            <button 
                onClick={refreshStatus} 
                disabled={loading}
                title="Sync Status"
                style={{
                    background: 'transparent',
                    border: '1px solid #666',
                    color: '#fff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    padding: '2px 6px',
                    opacity: loading ? 0.5 : 1
                }}
            >
                {loading ? '...' : '↻'}
            </button>
        </div>
      ) : (
         <div style={{textAlign: 'center', marginBottom: '10px'}}>
             <p style={{fontSize: '0.8rem', color: '#aaa', marginBottom: '5px'}}>Sign in on our website to sync:</p>
             <button onClick={handleLogin} style={{background: '#4285F4', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem'}}>
                 Login / Sync
             </button>
             <div style={{marginTop: '6px'}}>
               <button 
                 onClick={refreshStatus}
                 disabled={loading}
                 title="Sync Status"
                 style={{
                   background: 'transparent',
                   border: '1px solid #666',
                   color: '#fff',
                   borderRadius: '4px',
                   cursor: 'pointer',
                   fontSize: '0.8rem',
                   padding: '4px 8px',
                   opacity: loading ? 0.5 : 1
                 }}
               >
                 {loading ? '...' : '↻ Sync'}
               </button>
             </div>
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
