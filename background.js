// Service Worker con gestión de Offscreen Document
// Migrado para cumplir con Manifest V3 y evitar problemas de CSP/Autoplay

console.log("Smart Audio EQ: Background Service Worker iniciado");

// ===== GESTIÓN DE OFFSCREEN DOCUMENT =====
let creating; // Promesa para evitar condiciones de carrera

async function setupOffscreenDocument(path) {
  // Verificar si ya existe un contexto offscreen
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [path]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Crear el documento si no existe
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['AUDIO_PLAYBACK', 'USER_MEDIA'],
      justification: 'Procesamiento de audio y ecualización en tiempo real',
    });
    await creating;
    creating = null;
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

        // 1. Asegurar Offscreen Document
        await setupOffscreenDocument('offscreen.html');

        // 2. Obtener Stream ID
        const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: tab.id
        });
        
        console.log("✅ StreamId obtenido:", streamId);

        // 3. Enviar al Offscreen
        const response = await chrome.runtime.sendMessage({
          type: 'START_AUDIO_CAPTURE',
          streamId: streamId,
          data: msg.data // Pasar datos extra si es necesario (ej: configuración inicial)
        });

        if (response && response.success) {
          chrome.storage.local.set({ enabled: true });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: response?.error || "Error iniciando audio en offscreen" });
        }

      } catch (err) {
        console.error("Error habilitando EQ:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Respuesta asíncrona
  }

  if (msg.type === "DISABLE_EQ") {
    (async () => {
      try {
        // Enviar mensaje de parada al offscreen si es necesario, 
        // o simplemente actualizar estado. 
        // Nota: TabCapture se detiene si se cierra el stream en offscreen.
        chrome.storage.local.set({ enabled: false });
        
        // Opcional: Cerrar offscreen para ahorrar recursos si no se usa
        // chrome.offscreen.closeDocument(); 
        
        // Por ahora solo notificamos
        chrome.runtime.sendMessage({ type: 'STOP_AUDIO_CAPTURE' }).catch(() => {});
        
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Reenvío de comandos de control al Offscreen
  if (msg.type === "SET_BAND_GAIN") {
    chrome.runtime.sendMessage({
      type: 'SET_GAIN',
      index: msg.bandIndex,
      value: msg.value
    }).catch(err => console.log("Error reenviando SET_GAIN:", err));
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "SET_MASTER_VOLUME") {
    chrome.runtime.sendMessage({
      type: 'SET_VOLUME',
      value: msg.value
    }).catch(err => console.log("Error reenviando SET_VOLUME:", err));
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "GET_ANALYSER_DATA") {
    (async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_ANALYSER_DATA' });
        sendResponse(response);
      } catch (err) {
        sendResponse({ success: false, data: [] });
      }
    })();
    return true;
  }

  // ===== GESTIÓN DE USUARIOS / LOGIN =====
  if (msg.type === "LOGIN_EXITOSO") {
    chrome.storage.local.set({
      email: msg.email,
      uid: msg.uid,
      isPremium: msg.isPremium
    }, () => {
      console.log("Background: Usuario sincronizado");
      sendResponse({ success: true });
    });
    return true;
  }
});

// ===== MENSAJES EXTERNOS (WEB) =====
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
  }
);
