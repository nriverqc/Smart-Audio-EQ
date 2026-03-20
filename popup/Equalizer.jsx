import React, { useState, useEffect } from 'react';
 
export default function Equalizer({ enabled, isPremium, currentPreset, presetGains, onUserAdjust, targetTabId, volumeLimitWarning, openPremiumModal, openGuideModal }) {
  // FREE: 6 bands, PREMIUM: 15 bands
  const isFree = !isPremium;
  const bands = isFree 
    ? [60, 170, 350, 1000, 3500, 10000]
    : [20, 40, 60, 100, 170, 250, 350, 500, 1000, 2000, 3500, 5000, 7000, 10000, 16000];
  const displayLabels = isFree
    ? ['60', '170', '350', '1k', '3.5k', '10k']
    : ['20', '40', '60', '100', '170', '250', '350', '500', '1k', '2k', '3.5k', '5k', '7k', '10k', '16k'];
  
  const [gains, setGains] = useState(presetGains || new Array(bands.length).fill(0));
  const [volume, setVolume] = useState(100); // 100% es volumen normal (1.0x)

  useEffect(() => {
    const loadState = () => {
      chrome.storage.local.get(['activeTabs', 'masterVolume'], (result) => {
        if (targetTabId && result.activeTabs && result.activeTabs[targetTabId]) {
            const tabData = result.activeTabs[targetTabId];
            
            // Priority: Per-tab volume
            if (typeof tabData.masterVolume !== 'undefined') {
                setVolume(Math.round(tabData.masterVolume * 100));
            } else if (result.masterVolume) {
                setVolume(result.masterVolume);
            }
            
            // Priority: Current Preset Gains from props (if changing preset)
            // or Per-tab gains from storage (if switching tabs)
            if (currentPreset !== 'custom' && presetGains) {
                setGains(presetGains);
            } else if (tabData.gains && tabData.gains.length > 0) {
                setGains(tabData.gains);
            } else if (presetGains) {
                setGains(presetGains);
            }
        } else {
            // Fallback for non-active or free tabs
            if (result.masterVolume) {
                setVolume(result.masterVolume);
            }
            if (presetGains) {
                setGains(presetGains);
            }
        }
      });
    };

    loadState();
  }, [targetTabId, currentPreset, presetGains]);

  const changeGain = (i, v) => {
    const newVal = parseFloat(v);
    const newGains = [...gains];
    newGains[i] = newVal;
    setGains(newGains);
    
    // Enviar todo el preset para que el background calcule compensación de volumen
    chrome.runtime.sendMessage({ 
      type: "APPLY_PRESET", 
      preset: 'custom',
      gains: newGains,
      tabId: targetTabId
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error enviando preset:", chrome.runtime.lastError.message);
      } else {
        console.log(`✅ Banda ${i} aplicada via APPLY_PRESET`);
      }
    });

    // Guardar en custom
    if (onUserAdjust) {
      onUserAdjust(newGains);
    }
  };

  const changeVolume = (v) => {
    const newVol = parseInt(v);
    
    // LIMIT FREE USERS TO 120%
    if (isFree && newVol > 120) {
        if (openPremiumModal) {
            openPremiumModal(volumeLimitWarning || "¡Pruébalo! Con Premium puedes subir hasta el 300%.");
        }
        setVolume(120);
        return;
    }

    setVolume(newVol);
    
    // Enviar volumen normalizado (0 a 3, donde 1 es volumen normal)
    const normalizedVol = newVol / 100;
    console.log(`📊 Volumen UI: ${newVol}% → Normalizado: ${normalizedVol}`);
    
    chrome.runtime.sendMessage({ 
      type: "SET_MASTER_VOLUME", 
      value: normalizedVol,
      tabId: targetTabId
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error enviando volumen:", chrome.runtime.lastError.message);
      } else {
        console.log(`✅ Volumen aplicado: ${newVol}% (${normalizedVol.toFixed(2)}x)`);
      }
    });

    // Update global for free users and backup
    chrome.storage.local.set({ masterVolume: newVol });
  };

  return (
    <div className="eq-section">
      <div className="eq-title">⚙️ {isPremium ? 'Ecualizador Pro (15 Bandas)' : 'Ecualizador (6 Bandas)'}</div>
      
      {/* Master Volume */}
      <div className="master-volume" 
        onClick={() => {
            if (!enabled && openGuideModal) {
                openGuideModal();
            }
        }}
        style={{ cursor: !enabled ? 'pointer' : 'default' }}
      >
        <div className="volume-label">
          <span>🔊 Volumen Maestro</span>
          <span className="volume-value">{volume}%</span>
        </div>
          <input 
            key={`volume-${targetTabId}`}
            type="range" 
            min="0" 
            max="300" 
            value={volume} 
            onChange={(e) => changeVolume(e.target.value)}
            className="volume-slider"
            disabled={!enabled}
            style={{ pointerEvents: !enabled ? 'none' : 'auto' }}
          />
      </div>

      {/* EQ Bands */}
      <div className="eq-container" style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
        {bands.map((f, i) => (
          <div key={i} className="band">
            <div className="db-value">
              {gains[i] > 0 ? `+${gains[i]}` : gains[i]}dB
            </div>
            <input
              key={`band-${targetTabId}-${i}`}
              type="range"
              min="-12"
              max="12"
              value={gains[i]}
              step="0.5"
              onChange={(e) => changeGain(i, e.target.value)}
              disabled={!enabled}
            />
            <div className="band-label">{displayLabels[i]}Hz</div>
          </div>
        ))}
      </div>
    </div>
  );
}
