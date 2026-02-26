import React, { useState, useEffect } from 'react';
import Equalizer from './Equalizer';
import TabMixer from './TabMixer';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import { PRESETS, IS_PREMIUM_PRESET } from './presets';
import logo from './Logo ecualizador 2.png';

export default function App() {
  const [enabled, setEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [currentPreset, setCurrentPreset] = useState('flat');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [appPassCode, setAppPassCode] = useState('');
  const [lang, setLang] = useState('en');

  const langLabels = {
    es: { label: 'ES', flag: '🇪🇸' },
    en: { label: 'EN', flag: '🇺🇸' },
    pt: { label: 'PT', flag: '🇧🇷' },
    de: { label: 'DE', flag: '🇩🇪' }
  };

  const extensionTexts = {
    es: {
      visitWebsite: 'Visitar sitio web',
      extName: 'Smart Audio EQ',
      premiumBadge: 'PRO',
      premiumStatus: '• PREMIUM 💎',
      freeStatus: '• Gratis',
      syncStatus: 'Sincronizar estado',
      signInText: 'Inicia sesión en la web para sincronizar:',
      loginSync: 'Iniciar Sesión',
      appPassLabel: '¿Tienes un App Pass?',
      appPassPlaceholder: 'CÓDIGO-APP-PASS',
      appPassBtn: 'Activar',
      power: 'Encendido',
      getPremium: 'Obtener Premium 💎',
      manageAppPass: 'Gestionar App Pass'
    },
    en: {
      visitWebsite: 'Visit Website',
      extName: 'Smart Audio EQ',
      premiumBadge: 'PRO',
      premiumStatus: '• PREMIUM 💎',
      freeStatus: '• Free',
      syncStatus: 'Sync Status',
      signInText: 'Sign in on our website to sync:',
      loginSync: 'Login / Sync',
      appPassLabel: 'Have an App Pass?',
      appPassPlaceholder: 'APP-PASS-CODE',
      appPassBtn: 'Activate',
      power: 'Power',
      getPremium: 'Get Premium 💎',
      manageAppPass: 'Manage App Pass'
    },
    pt: {
      visitWebsite: 'Visite o site',
      extName: 'Smart Audio EQ',
      premiumBadge: 'PRO',
      premiumStatus: '• PREMIUM 💎',
      freeStatus: '• Grátis',
      syncStatus: 'Status de sincronização',
      signInText: 'Faça login no site para sincronizar:',
      loginSync: 'Entrar / Sincronizar',
      appPassLabel: 'Tem um App Pass?',
      appPassPlaceholder: 'CÓDIGO-APP-PASS',
      appPassBtn: 'Ativar',
      power: 'Energia',
      getPremium: 'Obter Premium 💎',
      manageAppPass: 'Gerenciar App Pass'
    },
    de: {
      visitWebsite: 'Website besuchen',
      extName: 'Smart Audio EQ',
      premiumBadge: 'PRO',
      premiumStatus: '• PREMIUM 💎',
      freeStatus: '• Kostenlos',
      syncStatus: 'Sync-Status',
      signInText: 'Anmelden zum Synchronisieren:',
      loginSync: 'Anmelden / Sync',
      appPassLabel: 'Hast du einen App Pass?',
      appPassPlaceholder: 'APP-PASS-CODE',
      appPassBtn: 'Aktivieren',
      power: 'Strom',
      getPremium: 'Premium erhalten 💎',
      manageAppPass: 'App Pass verwalten'
    }
  };

  const t = (key) => {
    return extensionTexts[lang][key] || extensionTexts['en'][key];
  };

  useEffect(() => {
    // Detect language
    const uiLang = chrome.i18n.getUILanguage().split('-')[0];
    if (langLabels[uiLang]) {
      setLang(uiLang);
    } else {
      setLang('en');
    }

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

  const openMainPage = () => {
      chrome.tabs.create({ url: 'https://smart-audio-eq.pages.dev/' });
  };


  const toggleEq = async () => {
    const newState = !enabled;
    
    // Redirect FREE users to the ad-supported page when turning ON
    if (newState && !isPremium) {
        chrome.tabs.create({ url: 'https://smart-audio-eq.pages.dev/', active: false });
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

  const handleActivateOfficialAppPass = () => {
      chrome.runtime.sendMessage({ type: 'ACTIVATE_OFFICIAL_APP_PASS' });
  };

  const handleManageOfficialAppPass = () => {
      chrome.runtime.sendMessage({ type: 'MANAGE_OFFICIAL_APP_PASS' });
  };

  const handleAppPassVerify = () => {
      if (!appPassCode.trim()) return;
      setLoading(true);
      chrome.runtime.sendMessage({ type: 'VERIFY_APP_PASS', code: appPassCode.trim() }, (response) => {
          setLoading(false);
          if (response && response.success) {
              alert(response.message);
              setIsPremium(true);
              setAppPassCode('');
          } else {
              alert(response ? response.error : "Verification failed");
          }
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

    if (presetKey === 'custom') {
        // Retrieve stored custom gains and apply them
        chrome.storage.local.get(['customGains'], (result) => {
            const savedGains = result.customGains || new Array(6).fill(0); // Default to flat if no custom gains
            chrome.runtime.sendMessage({ type: 'APPLY_PRESET', preset: 'custom', gains: savedGains });
        });
    } else {
        const gains = PRESETS[presetKey];
        if (gains) {
            // Apply preset in one message so background can route to per-tab or offscreen
            chrome.runtime.sendMessage({ type: 'APPLY_PRESET', preset: presetKey, gains });
        }
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
      <div className="controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div 
            onClick={openMainPage} 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title={t("visitWebsite")}
        >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{t("extName")}</h3>
            <span className="beta-badge" style={{fontSize: '0.6em', marginLeft: '8px', verticalAlign: 'middle'}}>BETA</span>
        </div>
        
        {/* Language Switcher in Extension */}
        <div style={{display: 'flex', gap: '5px'}}>
            {Object.keys(langLabels).map(l => (
                <span 
                    key={l} 
                    onClick={() => setLang(l)}
                    style={{
                        cursor: 'pointer', 
                        fontSize: '1rem', 
                        opacity: lang === l ? 1 : 0.3,
                        filter: lang === l ? 'none' : 'grayscale(100%)',
                        transition: 'all 0.2s'
                    }}
                    title={langLabels[l].label}
                >
                    {langLabels[l].flag}
                </span>
            ))}
        </div>

        {isPremium && <span className="premium-badge">{t("premiumBadge")}</span>}
      </div>

      {userEmail ? (
        <div style={{fontSize: '0.75rem', color: '#888', textAlign: 'center', marginBottom: '10px', background: '#222', padding: '5px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
            <span>👤 <span style={{color: '#fff'}}>{userEmail}</span></span>
            {isPremium ? (
                <span style={{color: '#ffd700', fontWeight: 'bold'}}>{t("premiumStatus")}</span>
            ) : (
                <span style={{color: '#ccc'}}>{t("freeStatus")}</span>
            )}
            <button 
                onClick={refreshStatus} 
                disabled={loading}
                title={t("syncStatus")}
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
             <p style={{fontSize: '0.8rem', color: '#aaa', marginBottom: '5px'}}>{t("signInText")}</p>
             <button onClick={handleLogin} style={{background: '#4285F4', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem'}}>
                 {t("loginSync")}
             </button>
             <div style={{marginTop: '6px'}}>
               <button 
                 onClick={refreshStatus}
                 disabled={loading}
                 title={t("syncStatus")}
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
        <span>{t("power")}</span>
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
        <div style={{marginTop: '1rem', textAlign: 'center', borderTop: '1px solid #333', paddingTop: '15px'}}>
          <button onClick={handleGoPremium} style={{background: '#ffcc00', border: 'none', color: '#000', cursor: 'pointer', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', width: '100%', marginBottom: '10px'}}>
            {t("getPremium")}
          </button>
          
          <div style={{marginTop: '10px', background: '#222', padding: '10px', borderRadius: '6px', border: '1px solid #444'}}>
            <p style={{fontSize: '0.75rem', color: '#aaa', margin: '0 0 8px 0'}}>{t("appPassLabel")}</p>
            
            {/* Manual Code Input */}
            <div style={{display: 'flex', gap: '5px', marginBottom: '10px'}}>
              <input 
                type="text" 
                placeholder={t("appPassPlaceholder")}
                value={appPassCode}
                onChange={(e) => setAppPassCode(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  background: '#111',
                  border: '1px solid #555',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '5px',
                  borderRadius: '4px'
                }}
              />
              <button 
                onClick={handleAppPassVerify}
                disabled={loading || !appPassCode.trim()}
                style={{
                  background: '#444',
                  color: '#fff',
                  border: '1px solid #666',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                {t("appPassBtn")}
              </button>
            </div>

            {/* Official App Pass SDK Button */}
            <button 
              onClick={handleActivateOfficialAppPass}
              style={{
                width: '100%',
                background: 'linear-gradient(45deg, #00d2ff, #00a8cc)',
                color: '#000',
                border: 'none',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginBottom: '5px'
              }}
            >
              🚀 {t("getPremium")} (App Pass)
            </button>
            <p style={{fontSize: '9px', color: '#888', margin: 0}}>
              One pass for many extensions
            </p>
          </div>
        </div>
      )}
      
      {isPremium && (
          <div style={{marginTop: '10px', textAlign: 'center'}}>
              <button 
                onClick={handleManageOfficialAppPass}
                style={{
                    background: 'transparent',
                    border: '1px solid #444',
                    color: '#888',
                    fontSize: '10px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
              >
                  {t("manageAppPass")}
              </button>
          </div>
      )}
    </div>
  );
}
