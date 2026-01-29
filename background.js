// Service Worker con gestión de Offscreen Document
// Migrado para cumplir con Manifest V3 y evitar problemas de CSP/Autoplay

console.log("Smart Audio EQ: Background Service Worker iniciado");

// ===== GESTIÓN DE OFFSCREEN DOCUMENT =====
let creating; // Promesa para evitar condiciones de carrera
let offscreenPort = null; // Puerto persistente para comunicación con offscreen

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
    
    try {
        await creating;
    } catch(err) {
        // Ignorar si ya existe (condición de carrera)
        if (!err.message.includes('Only a single offscreen document may be created')) {
            throw err;
        }
    }
    
    creating = null;
  }
}

async function closeOffscreenDocument() {
    try {
        if (creating) {
            await creating;
        }
        await chrome.offscreen.closeDocument();
    } catch(err) {
        // Ignorar errores al cerrar
        console.log("Error cerrando offscreen (puede que no exista):", err.message);
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
        // Si ya hay audio sonando, podría ser buena idea reiniciarlo para la nueva pestaña
        await closeOffscreenDocument(); 
        await setupOffscreenDocument('offscreen.html');

        // 2. Obtener Stream ID
        const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: tab.id
        });
        
        console.log("✅ StreamId obtenido:", streamId);

        // 3. Enviar mensaje al offscreen
        try {
          // Obtener estado premium antes de enviar
          const storage = await chrome.storage.local.get(['isPremium']);
          const isPremium = storage.isPremium || false;
          
          // El offscreen document debe tener su listener listo
          await new Promise(r => setTimeout(r, 300));
          
          // Conectar con el offscreen para comunicación persistente
          if (offscreenPort) {
            offscreenPort.disconnect();
          }
          offscreenPort = chrome.runtime.connect({ name: 'offscreen-port' });
          
          // Escuchar desconexiones
          offscreenPort.onDisconnect.addListener(() => {
            console.log("❌ Offscreen desconectado");
            offscreenPort = null;
          });
          
          // Enviar comando de inicio
          offscreenPort.postMessage({
            type: 'START_AUDIO_CAPTURE',
            streamId: streamId,
            isPremium: isPremium
          });
          
          // Esperar confirmación
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Timeout - offscreen no respondió"));
            }, 3000);
            
            const listener = (msg) => {
              if (msg.type === 'AUDIO_CAPTURE_STARTED') {
                clearTimeout(timeout);
                offscreenPort.onMessage.removeListener(listener);
                resolve(msg);
              }
            };
            
            offscreenPort.onMessage.addListener(listener);
          });
          
          const response = { success: true };

          if (response && response.success) {
            console.log("✅ Audio capture iniciado correctamente");
            chrome.storage.local.set({ enabled: true });
            sendResponse({ success: true });
          } else {
            console.error("❌ Respuesta inválida del offscreen:", response);
            sendResponse({ success: false, error: "Audio initialization failed: " + (response?.error || "Invalid response") });
          }
        } catch (e) {
          console.error("❌ Error comunicando con offscreen:", e.message);
          sendResponse({ success: false, error: "Offscreen communication error: " + e.message });
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
        chrome.storage.local.set({ enabled: false });
        
        // Notificar parada
        try {
            await chrome.runtime.sendMessage({ type: 'STOP_AUDIO_CAPTURE' });
        } catch(e) {}
        
        // Cerrar el documento para liberar recursos y permitir nueva captura limpia después
        await closeOffscreenDocument();

        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "SET_BAND_GAIN") {
    if (offscreenPort) {
      offscreenPort.postMessage({
        type: 'SET_GAIN',
        index: msg.bandIndex,
        value: msg.value
      });
    }
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "SET_MASTER_VOLUME") {
    if (offscreenPort) {
      offscreenPort.postMessage({
        type: 'SET_VOLUME',
        value: msg.value
      });
    }
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "GET_ANALYSER_DATA") {
    if (offscreenPort) {
      offscreenPort.postMessage({ type: 'GET_ANALYSER_DATA' });
    }
    sendResponse({ success: false, data: [] });
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
