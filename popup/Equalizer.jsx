import React, { useState, useEffect } from 'react';

export default function Equalizer({ enabled, isPremium, currentPreset, presetGains, onUserAdjust }) {
  // FREE: 6 bands, PREMIUM: 15 bands
  const isFree = !isPremium;
  const bands = isFree 
    ? [60, 170, 350, 1000, 3500, 10000]
    : [20, 40, 60, 100, 170, 250, 350, 500, 1000, 2000, 3500, 5000, 7000, 10000, 16000];
  const displayLabels = isFree
    ? ['60', '170', '350', '1k', '3.5k', '10k']
    : ['20', '40', '60', '100', '170', '250', '350', '500', '1k', '2k', '3.5k', '5k', '7k', '10k', '16k'];
  
  // Local state to track slider values for UI, initialized with presetGains
  const [gains, setGains] = useState(presetGains || new Array(bands.length).fill(0));
  const [volume, setVolume] = useState(100);
  const [pendingChanges, setPendingChanges] = useState(false);

  // Update sliders when preset changes
  useEffect(() => {
      if (currentPreset === 'custom') {
           chrome.storage.local.get(['customGains', 'masterVolume'], (result) => {
               if (result.customGains) {
                   setGains(result.customGains);
               }
               if (result.masterVolume) {
                   setVolume(result.masterVolume);
               }
           });
      } else if (presetGains) {
          setGains(presetGains);
          // Keep current volume when switching presets
      }
  }, [currentPreset, presetGains]);

  const changeGain = (i, v) => {
    if (!enabled) return;
    
    const newVal = parseFloat(v);
    const newGains = [...gains];
    newGains[i] = newVal;
    setGains(newGains);
    setPendingChanges(true);
    
    // Enviar cambio al content script de forma inmediata
    chrome.runtime.sendMessage({ 
      type: "SET_BAND_GAIN", 
      bandIndex: i, 
      value: newVal 
    });
  };

  const changeVolume = (v) => {
      if (!enabled) return;
      const newVol = parseInt(v);
      setVolume(newVol);
      setPendingChanges(true);
      
      // Enviar volumen inmediatamente
      chrome.runtime.sendMessage({ 
        type: "SET_MASTER_VOLUME", 
        value: newVol / 100 
      });
  };

  const applyChanges = () => {
      // 1. Send Gain updates
      gains.forEach((val, i) => {
        chrome.runtime.sendMessage({ type: "SET_GAIN", index: i, value: val });
      });

      // 2. Send Volume update (normalize 0-200 to 0.0-2.0)
      chrome.runtime.sendMessage({ type: "SET_VOLUME", value: volume / 100 });
      
      // 3. Save to storage (Custom preset)
      // Notify parent about adjustment so it switches to 'custom' if needed
      if (onUserAdjust) {
          onUserAdjust(gains);
      }
      chrome.storage.local.set({ masterVolume: volume });

      // 4. Clear pending state
      setPendingChanges(false);

      // 5. Redirect to page (Requested feature: Throttled to every 30s)
      // Only redirect if NOT premium
      if (!isPremium) {
        chrome.storage.local.get(['lastRedirect'], (result) => {
            const now = Date.now();
            const last = result.lastRedirect || 0;
            
            if (now - last > 30000) { // 30 seconds
                // Get user email to pass to web for profile extraction
                chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
                    const emailParam = (userInfo && userInfo.email) ? `?email=${encodeURIComponent(userInfo.email)}` : '';
                    chrome.tabs.create({ url: `https://smart-audio-eq.pages.dev/${emailParam}` });
                    chrome.storage.local.set({ lastRedirect: now });
                });
            }
        });
      }
  };

  return (
    <div className="eq-container" style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none', flexDirection: 'column', height: 'auto' }}>
      
      {/* Volume Control */}
      <div style={{ marginBottom: '15px', background: '#222', padding: '10px', borderRadius: '5px' }}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.8rem', color: '#ccc'}}>
              <span>Volumen Master</span>
              <span style={{color: volume > 100 ? '#ffcc00' : '#fff'}}>{volume}%</span>
          </div>
          <input 
              type="range" 
              min="0" 
              max="200" 
              value={volume} 
              onChange={(e) => changeVolume(e.target.value)}
              style={{width: '100%', cursor: 'pointer'}}
          />
      </div>

      {/* EQ Bands */}
      <div style={{ display: 'flex', justifyContent: 'space-between', height: '160px', gap: '4px' }}>
        {bands.map((f, i) => (
            <div key={i} className="band">
            <div className="db-value">{gains[i] > 0 ? `+${gains[i]}` : gains[i]}</div>
            <input
                type="range"
                min="-12"
                max="12"
                value={gains[i]}
                step="1"
                onChange={(e) => changeGain(i, e.target.value)}
            />
            <span>{displayLabels[i]}</span>
            </div>
        ))}
      </div>

      {/* Apply Button */}
      <div style={{marginTop: '15px', textAlign: 'center'}}>
          <button 
            onClick={applyChanges}
            className={pendingChanges ? 'pulse-btn' : ''}
            style={{
                background: pendingChanges ? '#ffcc00' : '#444',
                color: pendingChanges ? '#000' : '#ccc',
                border: 'none',
                padding: '10px 0',
                width: '100%',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '0.9rem',
                transition: 'all 0.3s ease'
            }}
          >
            {pendingChanges ? '⚠️ Ecualizar (Aplicar)' : 'Ecualizado'}
          </button>
          {pendingChanges && <div style={{fontSize: '0.7rem', color: '#ffcc00', marginTop: '5px'}}>Cambios pendientes...</div>}
      </div>

    </div>
  );
}
