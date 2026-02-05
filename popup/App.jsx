import React, { useState, useEffect } from 'react';
import Equalizer from './Equalizer';
import TabMixer from './TabMixer';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import { PRESETS, IS_PREMIUM_PRESET } from './presets';

export default function App() {
  const [enabled, setEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [currentPreset, setCurrentPreset] = useState('flat');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check state from storage and active tab status
    const checkState = () => {
        // 1. Get global settings
        chrome.storage.local.get(['isPremium', 'email', 'uid'], (result) => {
            if (result.isPremium) setIsPremium(true);
            if (result.email) setUserEmail(result.email);
        });

        // 2. Ask background for TAB SPECIFIC status
        chrome.runtime.sendMessage({ type: 'GET_TAB_STATUS' }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("Could not get tab status:", chrome.runtime.lastError.message);
                return;
            }
            
            if (response && response.enabled) {
                console.log("✅ Tab is already active. Syncing UI...", response);
                setEnabled(true);
                if (response.preset) setCurrentPreset(response.preset);
                // Note: Gains are passed to Equalizer via PRESETS[currentPreset] or we need a way to pass custom gains
                if (response.gains) {
                    // Store in local storage so Equalizer component can pick it up if it's 'custom'
                    chrome.storage.local.set({ customGains: response.gains });
                    if (response.preset === 'custom') {
                        setCurrentPreset('custom');
                    }
                }
            } else {
                console.log("Tab is not active.");
                setEnabled(false);
            }
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
      // Open the web page to login via background script
      chrome.runtime.sendMessage({ type: 'OPEN_LOGIN_PAGE' });
  };


  const toggleEq = async () => {
    const newState = !enabled;
    
    // Redirect FREE users to the ad-supported page when turning ON
    if (newState && !isPremium) {
        chrome.tabs.create({ url: 'https://smart-audio-eq.pages.dev/' });
    }

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
    // Open the REAL premium page via background
    chrome.runtime.sendMessage({ type: 'OPEN_PREMIUM_PAGE' });
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
      // Apply preset in one message so background can route to per-tab or offscreen
      chrome.runtime.sendMessage({ type: 'APPLY_PRESET', preset: presetKey, gains });
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
    chrome.runtime.sendMessage({ type: 'SYNC_STATUS' }, (response) => {
        setLoading(false);
        if (response && response.success) {
            alert(response.message);
        } else {
            if (response && response.error && response.error.includes("login")) {
                 alert(response.error);
                 handleLogin();
            } else {
                 alert(response ? response.error : "Sync failed");
            }
        }
    });
  };

  return (
    <div>
      <div className="controls">
        <h3 style={{display: 'flex', alignItems: 'center'}}>
            Smart Audio EQ 
            <span className="beta-badge" style={{fontSize: '0.6em', marginLeft: '8px', verticalAlign: 'middle'}}>BETA</span>
        </h3>
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
                  <option value="night-cinema" disabled={!isPremium}>Night Cinema {isPremium ? '' : '🔒'}</option>
                  <option value="warm-vintage" disabled={!isPremium}>Warm Vintage {isPremium ? '' : '🔒'}</option>
                  <option value="crystal-clear" disabled={!isPremium}>Crystal Clear {isPremium ? '' : '🔒'}</option>
                  <option value="deep-focus" disabled={!isPremium}>Deep Focus {isPremium ? '' : '🔒'}</option>
                  <option value="rock-metal" disabled={!isPremium}>Rock / Metal {isPremium ? '' : '🔒'}</option>
                  <option value="acoustic-live" disabled={!isPremium}>Acoustic / Live {isPremium ? '' : '🔒'}</option>
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

      {enabled && (
        <SpectrumAnalyzer />
      )}

      {isPremium && enabled && (
        <TabMixer />
      )}

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
