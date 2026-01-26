import React, { useState, useEffect } from 'react';

export default function Equalizer({ enabled, isPremium, currentPreset, presetGains, onUserAdjust }) {
  const bands = [60, 170, 350, 1000, 3500, 10000];
  const displayLabels = ['60', '170', '350', '1k', '3.5k', '10k'];
  
  // Local state to track slider values for UI, initialized with presetGains
  const [gains, setGains] = useState(presetGains || [0,0,0,0,0,0]);

  // Update sliders when preset changes
  useEffect(() => {
      if (currentPreset === 'custom') {
           chrome.storage.local.get(['customGains'], (result) => {
               if (result.customGains) {
                   setGains(result.customGains);
               }
           });
      } else if (presetGains) {
          setGains(presetGains);
      }
  }, [currentPreset, presetGains]);

  const change = (i, v) => {
    if (!enabled) return;
    
    const newVal = parseFloat(v);
    const newGains = [...gains];
    newGains[i] = newVal;
    setGains(newGains);

    chrome.runtime.sendMessage({ type: "SET_GAIN", index: i, value: newVal });
    
    // Notify parent about adjustment
    if (onUserAdjust) {
        onUserAdjust(newGains);
    }
  };

  return (
    <div className="eq-container" style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
      {bands.map((f, i) => (
        <div key={i} className="band">
          <div className="db-value">{gains[i] > 0 ? `+${gains[i]}` : gains[i]}</div>
          <input
            type="range"
            min="-12"
            max="12"
            value={gains[i]}
            step="1"
            onChange={(e) => change(i, e.target.value)}
          />
          <span>{displayLabels[i]}</span>
        </div>
      ))}
    </div>
  );
}
