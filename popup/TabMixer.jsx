import React, { useState, useEffect } from 'react';

export default function TabMixer() {
  const [audibleTabs, setAudibleTabs] = useState([]);
  const [tabVolumes, setTabVolumes] = useState({});
  const [isChanging, setIsChanging] = useState(null); // Track which tab is being manually changed

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

    // Sync current element volumes but only if user is NOT manually changing one
    const readVolumes = () => {
      if (isChanging) return; // Don't read while user is adjusting
      
      chrome.tabs.query({ audible: true }, (tabs) => {
        tabs.forEach(tab => {
          try {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const els = Array.from(document.querySelectorAll('audio,video'));
                if (els.length === 0) return null;
                // return average volume across elements
                const vols = els.map(e => (typeof e.volume === 'number' ? e.volume : 1));
                const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
                return avg;
              }
            }).then(results => {
              if (results && results[0] && typeof results[0].result === 'number') {
                setTabVolumes(prev => ({ ...prev, [tab.id]: results[0].result }));
              }
            }).catch(() => {});
          } catch (e) {}
        });
      });
    };

    // Read once on mount and then each interval tick
    readVolumes();
    const readInterval = setInterval(readVolumes, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(readInterval);
    };
  }, [isChanging]);

  const handleVolumeChange = (tabId, volume) => {
    setIsChanging(tabId); // Mark as changing
    const normalizedVolume = parseFloat(volume);
    
    setTabVolumes(prev => {
      const next = { ...prev, [tabId]: normalizedVolume };
      // Save to storage
      chrome.storage.local.set({ tabVolumes: next });
      // Send to background script to update element volume (0 to 1)
      chrome.runtime.sendMessage({ type: 'SET_TAB_VOLUME', tabId, volume: normalizedVolume });
      return next;
    });

    // Clear isChanging flag after slider release (300ms debounce)
    setTimeout(() => setIsChanging(null), 300);
  };

  return (
    <div style={{ padding: '10px', fontSize: '12px' }}>
      <h3>🎚️ Tab Mixer (Premium)</h3>
      <p style={{ fontSize: '10px', color: '#aaa' }}>Control volumen de cada pestaña (0-100%)</p>
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
