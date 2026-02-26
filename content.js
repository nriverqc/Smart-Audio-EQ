// content.js - Per-tab utilities ONLY (no audio processing)
// Audio EQ processing is handled by offscreen.js
// This script is kept for future per-tab spectrum analysis if needed

if (window.__SMART_AUDIO_EQ_LOADED) {
  // Already loaded
} else {
  window.__SMART_AUDIO_EQ_LOADED = true;
  console.log("✅ Smart Audio EQ: Content script loaded (disabled per-tab audio processing)");

  // Content script messaging listener
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (msg.type === 'PING') {
        sendResponse({ pong: true });
        return;
      }
      if (msg.type === "PREGUNTAR_DATOS") {
          // Extension is asking for data from the web page
          const data = localStorage.getItem('user_sync_data');
          if (data) {
              sendResponse(JSON.parse(data));
          } else {
              sendResponse(null);
          }
          return true;
      }
      if (msg.type === "PREMIUM_ACTIVADO_EXT") {
          // Extension just activated premium, tell the web page to refresh user
          window.postMessage({ type: "PREMIUM_ACTIVADO_EXT" }, "*");
          return;
      }
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  });

  // Listen for messages FROM the web page (App.jsx)
  window.addEventListener("message", (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data.type && event.data.type === "LOGIN_EXITOSO") {
        console.log("Content Script: Relaying login data to background...");
        chrome.runtime.sendMessage({
            type: "LOGIN_EXITOSO",
            uid: event.data.uid,
            email: event.data.email,
            isPremium: event.data.isPremium
        });
    }
  });

  // Notify web page that extension is ready
  window.postMessage({ type: "EXTENSION_READY" }, "*");
}
