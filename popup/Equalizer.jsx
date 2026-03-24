import React, { useState, useEffect } from 'react';
 
export default function Equalizer({ enabled, isPremium, currentPreset, presetGains, onUserAdjust, targetTabId, initialOffsets, volumeLimitWarning, openPremiumModal, openGuideModal, t }) {
  // FREE: 6 bands, PREMIUM: 15 bands
  const isFree = !isPremium;
  const bands = isFree 
    ? [60, 170, 350, 1000, 3500, 10000]
    : [20, 40, 60, 100, 170, 250, 350, 500, 1000, 2000, 3500, 5000, 7000, 10000, 16000];
  const displayLabels = isFree
    ? ['60', '170', '350', '1k', '3.5k', '10k']
    : ['20', '40', '60', '100', '170', '250', '350', '500', '1k', '2k', '3.5k', '5k', '7k', '10k', '16k'];
  
  const [gains, setGains] = useState(presetGains || new Array(bands.length).fill(0));
  const [volume, setVolume] = useState(100); 
  
  // Quick EQ Offsets (Master Sliders)
  const [bassOffset, setBassOffset] = useState(0);
  const [midOffset, setMidOffset] = useState(0);
  const [trebleOffset, setTrebleOffset] = useState(0);

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
                // Reset offsets if switching to a known preset
                setBassOffset(0);
                setMidOffset(0);
                setTrebleOffset(0);
            } else if (tabData.gains && tabData.gains.length > 0) {
                setGains(tabData.gains);
                // Load offsets from tabData
                const offsets = tabData.offsets || { bass: 0, mid: 0, treble: 0 };
                setBassOffset(offsets.bass || 0);
                setMidOffset(offsets.mid || 0);
                setTrebleOffset(offsets.treble || 0);
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

    // Update corresponding Quick EQ offset if a band in its range changes
    if (isPremium) {
      let currentOffsets = { bass: bassOffset, mid: midOffset, treble: trebleOffset };
      if (i >= 0 && i <= 4) {
        setBassOffset(newVal);
        currentOffsets.bass = newVal;
      }
      else if (i >= 5 && i <= 10) {
        setMidOffset(newVal);
        currentOffsets.mid = newVal;
      }
      else if (i >= 11 && i <= 14) {
        setTrebleOffset(newVal);
        currentOffsets.treble = newVal;
      }
      
      // Save everything together via onUserAdjust
      if (onUserAdjust) {
        onUserAdjust(newGains, currentOffsets);
      }

      // Sync with background
      chrome.runtime.sendMessage({ 
        type: "APPLY_PRESET", 
        preset: 'custom',
        gains: newGains,
        offsets: currentOffsets,
        tabId: targetTabId
      });
    } 
  };

  const handleQuickAdjust = (range, value) => {
    const newVal = parseFloat(value);
    let rangeIndices = [];
    let oldOffset = 0;
    let setOffset;

    if (range === 'bass') {
      rangeIndices = [0, 1, 2, 3, 4];
      oldOffset = bassOffset;
      setOffset = setBassOffset;
    } else if (range === 'mid') {
      rangeIndices = [5, 6, 7, 8, 9, 10];
      oldOffset = midOffset;
      setOffset = setMidOffset;
    } else if (range === 'treble') {
      rangeIndices = [11, 12, 13, 14];
      oldOffset = trebleOffset;
      setOffset = setTrebleOffset;
    }

    setOffset(newVal);
    
    // Calculate new gains
    const newGains = [...gains];
    rangeIndices.forEach(idx => {
      newGains[idx] = newVal;
    });
    setGains(newGains);

    // Persist via onUserAdjust
    const newOffsets = { 
        bass: range === 'bass' ? newVal : bassOffset, 
        mid: range === 'mid' ? newVal : midOffset, 
        treble: range === 'treble' ? newVal : trebleOffset 
    };

    // Persist via onUserAdjust
    if (onUserAdjust) {
        onUserAdjust(newGains, newOffsets);
    }
    
    // Sync with background
    chrome.runtime.sendMessage({ 
      type: "APPLY_PRESET", 
      preset: 'custom',
      gains: newGains,
      offsets: newOffsets, // CRITICAL: Unified offset sync
      tabId: targetTabId
    });
  };

  const changeVolume = (v) => {
    const newVol = parseInt(v);
    
    // LIMIT FREE USERS TO 150%
    if (isFree && newVol > 150) {
        if (openPremiumModal) {
            openPremiumModal(volumeLimitWarning || "¡Pruébalo! Con Premium puedes subir hasta el 300%.");
        }
        setVolume(150);
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

      {/* Quick EQ Master Sliders (Premium Only) */}
      {isPremium && (
        <div className="quick-eq-section" style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
           <div className="eq-title" style={{ width: '100%', marginBottom: '10px' }}>⚡ Quick Tuning (Direct Control)</div>
           
           <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
             {/* Bass Slider */}
             <div className="quick-slider-container">
               <div className="quick-slider-label">{t ? t("quickEqBass") : 'Graves'}</div>
               <div className="quick-slider-wrapper">
                 <input 
                   type="range" min="-12" max="12" step="0.5"
                   value={bassOffset}
                   onChange={(e) => handleQuickAdjust('bass', e.target.value)}
                   className="quick-slider"
                   disabled={!enabled}
                   style={{ 
                     background: `linear-gradient(to right, #00d2ff 0%, #00d2ff ${((parseFloat(bassOffset) + 12) / 24) * 100}%, #222 ${((parseFloat(bassOffset) + 12) / 24) * 100}%, #222 100%)` 
                   }}
                 />
               </div>
               <div className="quick-slider-db">{bassOffset > 0 ? `+${bassOffset}` : bassOffset} dB</div>
             </div>

             {/* Mid Slider */}
             <div className="quick-slider-container">
               <div className="quick-slider-label">{t ? t("quickEqMid") : 'Mids'}</div>
               <div className="quick-slider-wrapper">
                 <input 
                   type="range" min="-12" max="12" step="0.5"
                   value={midOffset}
                   onChange={(e) => handleQuickAdjust('mid', e.target.value)}
                   className="quick-slider"
                   disabled={!enabled}
                   style={{ 
                     background: `linear-gradient(to right, #00d2ff 0%, #00d2ff ${((parseFloat(midOffset) + 12) / 24) * 100}%, #222 ${((parseFloat(midOffset) + 12) / 24) * 100}%, #222 100%)` 
                   }}
                 />
               </div>
               <div className="quick-slider-db">{midOffset > 0 ? `+${midOffset}` : midOffset} dB</div>
             </div>

             {/* Treble Slider */}
             <div className="quick-slider-container">
               <div className="quick-slider-label">{t ? t("quickEqTreble") : 'Highs'}</div>
               <div className="quick-slider-wrapper">
                 <input 
                   type="range" min="-12" max="12" step="0.5"
                   value={trebleOffset}
                   onChange={(e) => handleQuickAdjust('treble', e.target.value)}
                   className="quick-slider"
                   disabled={!enabled}
                   style={{ 
                     background: `linear-gradient(to right, #00d2ff 0%, #00d2ff ${((parseFloat(trebleOffset) + 12) / 24) * 100}%, #222 ${((parseFloat(trebleOffset) + 12) / 24) * 100}%, #222 100%)` 
                   }}
                 />
               </div>
               <div className="quick-slider-db">{trebleOffset > 0 ? `+${trebleOffset}` : trebleOffset} dB</div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
