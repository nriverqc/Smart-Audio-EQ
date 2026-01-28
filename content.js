// content.js
// Simplificado: Ya no gestiona audio. Solo comunicación básica si es necesaria.

// GUARD: Evitar ejecución doble
if (window.__SMART_AUDIO_EQ_LOADED) {
  // Ya cargado
} else {
  window.__SMART_AUDIO_EQ_LOADED = true;
  console.log("✅ Smart Audio EQ: Content script loaded (UI only)");

  // Escuchar mensajes por si se necesita mostrar UI en el futuro
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "PING") {
      sendResponse({ success: true });
    }
    // Ya no procesamos ENABLE_EQ aquí, lo hace el background con offscreen
  });
}
