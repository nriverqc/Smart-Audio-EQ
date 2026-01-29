import React, { useState, useEffect } from 'react';

export default function TabMixer() {
  const [audibleTabs, setAudibleTabs] = useState([]);
  const [tabVolumes, setTabVolumes] = useState({});

  useEffect(() => {
    // Get all tabs with audio
    chrome.tabs.query({ audible: true }, (tabs) => {
      setAudibleTabs(tabs);
      
      // Initialize volumes from storage
      chrome.storage.local.get('tabVolumes', (result) => {
        setTabVolumes(result.tabVolumes || {});
      });
    });

    // Poll for audio tabs every 1 second
    const interval = setInterval(() => {
      chrome.tabs.query({ audible: true }, (tabs) => {
        setAudibleTabs(tabs);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleVolumeChange = (tabId, volume) => {
    setTabVolumes(prev => {
      const next = { ...prev, [tabId]: volume };
      // Save to storage
      chrome.storage.local.set({ tabVolumes: next });
      // Send to background script
      chrome.runtime.sendMessage({ type: 'SET_TAB_VOLUME', tabId, volume });
      return next;
    });
  };

  return (
    <div style={{ padding: '10px', fontSize: '12px' }}>
      <h3>🎚️ Tab Mixer (Premium)</h3>
      {audibleTabs.length === 0 ? (
        <p style={{ color: '#999' }}>No audio tabs detected</p>
      ) : (
        audibleTabs.map(tab => (
          <div key={tab.id} style={{ marginBottom: '10px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              {tab.title?.substring(0, 30)}...
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={tabVolumes[tab.id] || 1}
                onChange={(e) => handleVolumeChange(tab.id, parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ width: '40px', textAlign: 'right' }}>
                {Math.round((tabVolumes[tab.id] || 1) * 100)}%
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
