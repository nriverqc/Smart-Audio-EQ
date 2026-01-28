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
  
  const [gains, setGains] = useState(presetGains || new Array(bands.length).fill(0));
  const [volume, setVolume] = useState(100); // 100% es volumen normal (1.0x)

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
    }
  }, [currentPreset, presetGains]);

  const changeGain = (i, v) => {
    if (!enabled) {
      console.warn(`⚠️  EQ no está activado, activando primero...`);
      // Intentar activar
      chrome.runtime.sendMessage({ type: 'ENABLE_EQ' }, (response) => {
        if (response?.success) {
          // Esperar un poco y luego enviar la banda
          setTimeout(() => {
            const newVal = parseFloat(v);
            chrome.runtime.sendMessage({ 
              type: "SET_BAND_GAIN", 
              bandIndex: i, 
              value: newVal 
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error("Error enviando banda:", chrome.runtime.lastError.message);
              } else {
                console.log(`✅ Banda ${i} aplicada: ${newVal}dB`);
              }
            });
          }, 100);
        }
      });
      return;
    }
    
    const newVal = parseFloat(v);
    const newGains = [...gains];
    newGains[i] = newVal;
    setGains(newGains);
    
    // Enviar inmediatamente al content script
    chrome.runtime.sendMessage({ 
      type: "SET_BAND_GAIN", 
      bandIndex: i, 
      value: newVal 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error enviando banda:", chrome.runtime.lastError.message);
      } else {
        console.log(`✅ Banda ${i} aplicada: ${newVal}dB`);
      }
    });

    // Guardar en custom
    if (onUserAdjust) {
      onUserAdjust(newGains);
    }
  };

  const changeVolume = (v) => {
    if (!enabled) {
      console.warn(`⚠️  EQ no está activado, activando primero...`);
      chrome.runtime.sendMessage({ type: 'ENABLE_EQ' }, (response) => {
        if (response?.success) {
          setTimeout(() => {
            const newVol = parseInt(v);
            const normalizedVol = newVol / 100;
            chrome.runtime.sendMessage({ 
              type: "SET_MASTER_VOLUME", 
              value: normalizedVol 
            });
          }, 100);
        }
      });
      return;
    }
    
    const newVol = parseInt(v);
    setVolume(newVol);
    
    // Enviar volumen normalizado (0 a 3, donde 1 es volumen normal)
    const normalizedVol = newVol / 100;
    console.log(`📊 Volumen UI: ${newVol}% → Normalizado: ${normalizedVol}`);
    
    chrome.runtime.sendMessage({ 
      type: "SET_MASTER_VOLUME", 
      value: normalizedVol 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error enviando volumen:", chrome.runtime.lastError.message);
      } else {
        console.log(`✅ Volumen aplicado: ${newVol}% (${normalizedVol.toFixed(2)}x)`);
      }
    });

    chrome.storage.local.set({ masterVolume: newVol });
  };

  return (
    <div className="eq-section">
      <div className="eq-title">⚙️ Ecualizador (6 Bandas)</div>
      
      {/* Master Volume */}
      <div className="master-volume">
        <div className="volume-label">
          <span>🔊 Volumen Maestro</span>
          <span className="volume-value">{volume}%</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="300" 
          value={volume} 
          onChange={(e) => changeVolume(e.target.value)}
          className="volume-slider"
          disabled={!enabled}
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
