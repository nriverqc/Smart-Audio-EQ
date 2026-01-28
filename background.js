// Service Worker simplificado
// El audio se maneja directamente en cada pestaña con content scripts
// Este archivo solo gestiona mensajes entre popup y content scripts

console.log("Smart Audio EQ: Service Worker iniciado");

// ===== FUNCIÓN AUXILIAR: INYECTAR CONTENT SCRIPT SI NO EXISTE =====
async function ensureContentScriptLoaded(tabId) {
  try {
    // Verificar si el content script está cargado intentando enviar ping
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "PING" }, (response) => {
        if (chrome.runtime.lastError) {
          console.log("Content script no está cargado, inyectando...");
          // Inyectar el content script
          chrome.scripting.executeScript({
            target: { tabId },
            files: ["content.js"]
          }, () => {
            resolve(true);
          });
        } else {
          resolve(true);
        }
      });
    });
  } catch (err) {
    console.error("Error verificando content script:", err);
    return false;
  }
}

// ===== ESCUCHAR MENSAJES DEL POPUP =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Background recibió:", msg.type);

  if (msg.type === "ENABLE_EQ") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
          sendResponse({ success: false, error: "No active tab" });
          return;
        }

        // Obtener streamId para tabCapture (funciona para SoundCloud, YouTube, etc.)
        let streamId = null;
        try {
          streamId = await chrome.tabCapture.getMediaStreamId({
            targetTabId: tab.id
          });
          console.log("✅ streamId obtenido:", streamId);
        } catch (e) {
          console.log("⚠️  TabCapture no disponible, usando MediaElement fallback");
        }

        // Asegurar que el content script existe
        await ensureContentScriptLoaded(tab.id);

        // Enviar mensaje con streamId
        const timeoutId = setTimeout(() => {
          sendResponse({ success: false, error: "Content script timeout" });
        }, 2000);

        chrome.tabs.sendMessage(tab.id, { type: "ENABLE_EQ", streamId: streamId }, (response) => {
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            console.error("Content script error:", chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else if (response) {
            chrome.storage.local.set({ enabled: true });
            sendResponse({ success: response.success });
          } else {
            sendResponse({ success: false, error: "No response from content script" });
          }
        });
      } catch (err) {
        console.error("Failed to enable EQ:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "DISABLE_EQ") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
          sendResponse({ success: false, error: "No active tab" });
          return;
        }

        const timeoutId = setTimeout(() => {
          sendResponse({ success: false, error: "Content script timeout" });
        }, 2000);

        chrome.tabs.sendMessage(tab.id, { type: "DISABLE_EQ" }, (response) => {
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            console.error("Content script error:", chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            chrome.storage.local.set({ enabled: false });
            sendResponse({ success: response?.success || true });
          }
        });
      } catch (err) {
        console.error("Failed to disable EQ:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "SET_BAND_GAIN") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            type: "SET_BAND_GAIN",
            bandIndex: msg.bandIndex,
            value: msg.value
          }).catch(err => {
            console.log("SET_BAND_GAIN error (ignorado):", err.message);
          });
        }
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "SET_MASTER_VOLUME") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            type: "SET_MASTER_VOLUME",
            value: msg.value
          }).catch(err => {
            console.log("SET_MASTER_VOLUME error (ignorado):", err.message);
          });
        }
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "LOGIN_EXITOSO") {
    try {
      chrome.storage.local.set({
        email: msg.email,
        uid: msg.uid,
        isPremium: msg.isPremium
      }, () => {
        console.log("Background: Usuario sincronizado");
        sendResponse({ success: true });
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }
});

// ===== MENSAJES EXTERNOS (desde la web) =====
chrome.runtime.onMessageExternal.addListener(
  function(request, sender, sendResponse) {
    if (request.type === "LOGIN_EXITOSO" || request.accion === "SYNC_USER") {
      console.log("Background (External): Sync desde:", sender.url);

      const uid = request.uid || (request.user && request.user.uid);
      const email = request.email || (request.user && request.user.email);
      const isPremium = request.isPremium || (request.user && request.user.isPremium);

      chrome.storage.local.set({
        uid: uid,
        email: email,
        isPremium: isPremium
      }, () => {
        console.log("Background (External): Datos sincronizados");
        sendResponse({ status: "OK" });
      });
      return true;
    }
    return false;
  }
);
