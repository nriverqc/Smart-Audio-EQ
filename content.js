// content.js - Per-tab utilities ONLY (no audio processing)
// Audio EQ processing is handled by offscreen.js
// This script is kept for future per-tab spectrum analysis if needed

if (window.__SMART_AUDIO_EQ_LOADED) {
  // Already loaded
} else {
  window.__SMART_AUDIO_EQ_LOADED = true;
  console.log("✅ Smart Audio EQ: Content script loaded (disabled per-tab audio processing)");

  // Content script messaging listener (if needed for future per-tab spectrum)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (msg.type === 'PING') {
        sendResponse({ pong: true });
        return;
      }
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  });
}
