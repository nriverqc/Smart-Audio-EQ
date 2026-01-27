let offscreenCreating = null;

async function setupOffscreenDocument(path) {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [path]
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (offscreenCreating) {
    await offscreenCreating;
  } else {
    offscreenCreating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['USER_MEDIA'],
      justification: 'Audio equalization requires capturing tab audio.'
    });
    await offscreenCreating;
    offscreenCreating = null;
  }
}

async function closeOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (existingContexts.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

// Ensure state is synced on startup
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['enabled'], async (result) => {
        if (result.enabled) {
            // We can't automatically restart audio capture without user gesture in some cases,
            // but for MV3 tab capture usually requires a click. 
            // However, we can at least ensure the UI reflects state.
            // If the user wants persistent audio across browser restarts, that's harder in MV3.
            // For now, let's assume "turns off automatically" refers to closing the popup.
        } else {
            closeOffscreenDocument();
        }
    });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ENABLE_EQ') {
    (async () => {
      try {
        await setupOffscreenDocument('offscreen.html');
        
        // Get the active tab (or the tab user clicked on)
        // If triggered from Popup, we need the active tab of the current window
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            sendResponse({ success: false, error: "No active tab" });
            return;
        }

        const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: tab.id
        });

        chrome.runtime.sendMessage({
          type: 'START_AUDIO_CAPTURE',
          streamId: streamId
        });
        
        // Save state
        await chrome.storage.local.set({ enabled: true });
        
        sendResponse({ success: true });
      } catch (err) {
        console.error('Failed to enable EQ:', err);
        // Reset state if failed
        await chrome.storage.local.set({ enabled: false });
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === 'DISABLE_EQ') {
    (async () => {
        await closeOffscreenDocument();
        await chrome.storage.local.set({ enabled: false });
        sendResponse({ success: true });
    })();
    return true;
  }

  if (msg.type === 'LOGIN_EXITOSO') {
      // Guardamos los datos en el almacenamiento de la extensión (Internal Message)
      chrome.storage.local.set({
        uid: msg.uid,
        email: msg.email,
        isPremium: msg.isPremium
      }, function() {
        console.log("Datos sincronizados internamente");
        sendResponse({status: "OK - Extensión actualizada"});
      });
      return true;
  }
});

// Escuchar mensajes externos (desde la web directamente, si externally_connectable está configurado)
chrome.runtime.onMessageExternal.addListener(
  function(request, sender, sendResponse) {
    if (request.type === "LOGIN_EXITOSO" || request.accion === "SYNC_USER") {
      console.log("Datos recibidos externamente desde:", sender.url);
      
      chrome.storage.local.set({
        uid: request.uid,
        email: request.email,
        isPremium: request.isPremium
      }, function() {
        console.log("Datos sincronizados desde la web (External)");
        sendResponse({status: "OK - Extensión actualizada"});
      });
      // Importante: return true para respuesta asíncrona si fuera necesario, 
      // aunque aquí el set es callback.
      return true;
    }
});
