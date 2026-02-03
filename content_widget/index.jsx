import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from '../popup/App'; // Reuse the existing App component logic
import css from '../popup/styles.css?inline'; // Import styles as string

// Create a container for the widget
const widgetContainerId = 'smart-audio-eq-widget-container';
let widgetContainer = document.getElementById(widgetContainerId);

if (!widgetContainer) {
  widgetContainer = document.createElement('div');
  widgetContainer.id = widgetContainerId;
  document.body.appendChild(widgetContainer);
}

// Ensure widget stays in DOM (YouTube SPA handling)
const observer = new MutationObserver(() => {
  if (!document.getElementById(widgetContainerId)) {
    console.log('Smart Audio Widget: Re-injecting widget container...');
    document.body.appendChild(widgetContainer);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Handle URL changes (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('Smart Audio Widget: URL changed to', url);
    // Optional: Send message to background to ensure audio connection is alive
    chrome.runtime.sendMessage({ type: 'PING' });
  }
}).observe(document, { subtree: true, childList: true });


// Create Shadow DOM
const shadowRoot = widgetContainer.attachShadow({ mode: 'open' });

// Inject styles into Shadow DOM
const style = document.createElement('style');
style.textContent = css;
shadowRoot.appendChild(style);

// Create a root div inside Shadow DOM
const rootDiv = document.createElement('div');
rootDiv.id = 'root';
shadowRoot.appendChild(rootDiv);

// Render the App
const root = ReactDOM.createRoot(rootDiv);

// Wrapper component to handle "Floating Button" vs "Panel" state
const WidgetWrapper = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. Check initial status
    chrome.runtime.sendMessage({ type: 'GET_TAB_STATUS' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.enabled) {
            setIsVisible(true);
        }
    });

    // 2. Listen for visibility updates from background
    const listener = (msg) => {
        if (msg.type === 'EQ_ENABLED') {
            setIsVisible(true);
            setIsOpen(false); // Show icon initially, not panel
        }
        if (msg.type === 'EQ_DISABLED') {
            setIsVisible(false);
            setIsOpen(false);
        }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="smart-audio-widget-wrapper">
      {/* Floating Button */}
      {!isOpen && (
        <div 
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: '#1a1a1a',
            border: '2px solid #00f3ff',
            boxShadow: '0 0 10px #00f3ff',
            cursor: 'pointer',
            zIndex: 2147483647,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}
        >
          🎵
        </div>
      )}

      {/* Main Panel */}
      <div 
        style={{
          display: isOpen ? 'block' : 'none',
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 2147483647,
          backgroundColor: '#1a1a1a',
          borderRadius: '10px',
          boxShadow: '0 0 20px rgba(0,0,0,0.5)',
          border: '1px solid #333'
        }}
      >
        <div style={{ position: 'relative' }}>
            <button 
                onClick={() => setIsOpen(false)}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '16px',
                    cursor: 'pointer',
                    zIndex: 10
                }}
            >
                ✕
            </button>
            <App />
        </div>
      </div>
    </div>
  );
};

root.render(
  <React.StrictMode>
    <WidgetWrapper />
  </React.StrictMode>
);

console.log("✅ Smart Audio EQ: Widget injected");
