// Service Worker con gestión de Offscreen Document
// Migrado para cumplir con Manifest V3 y evitar problemas de CSP/Autoplay

console.log("Smart Audio EQ: Background Service Worker iniciado");

// ===== GESTIÓN DE OFFSCREEN DOCUMENT =====
let creating; // Promesa para evitar condiciones de carrera
let offscreenPort = null; // Puerto persistente para comunicación con offscreen
let pendingPortMessages = []; 
// Track per-tab EQ state
let activeTabs = {}; // { [tabId]: { enabled: bool, preset: string, isPremium: bool, masterVolume: number, gains: [] } }

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
          
          // Esperar un breve momento para que el offscreen document esté listo
          await new Promise(r => setTimeout(r, 300));

          // Conectar con el offscreen para comunicación persistente
          if (offscreenPort) {
            try { offscreenPort.disconnect(); } catch(e) {}
          }
          offscreenPort = chrome.runtime.connect({ name: 'offscreen-port' });

          // Escuchar mensajes y desconexiones
          offscreenPort.onMessage.addListener((m) => {
            console.log('Background <- offscreen:', m && m.type);
          });

          offscreenPort.onDisconnect.addListener(() => {
            console.log('❌ Offscreen desconectado');
            offscreenPort = null;
          });

          // Enviar comando de inicio
          const startMsg = { type: 'START_AUDIO_CAPTURE', streamId: streamId, isPremium: isPremium };
          // Si hay mensajes pendientes, los enviamos primero para que el offscreen tenga el contexto
          if (pendingPortMessages.length > 0) {
            pendingPortMessages.forEach(pm => {
              try { offscreenPort.postMessage(pm); } catch (err) { console.warn('Flush msg failed', err); }
            });
            pendingPortMessages = [];
          }
          offscreenPort.postMessage(startMsg);

          // Esperar confirmación del offscreen (AUDIO_CAPTURE_STARTED)
          const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout - offscreen no respondió'));
            }, 5000);

            const listener = (msg) => {
              if (!msg || !msg.type) return;
              if (msg.type === 'AUDIO_CAPTURE_STARTED') {
                clearTimeout(timeout);
                offscreenPort.onMessage.removeListener(listener);
                resolve({ success: true, detail: msg });
              } else if (msg.type === 'AUDIO_CAPTURE_FAILED') {
                clearTimeout(timeout);
                offscreenPort.onMessage.removeListener(listener);
                resolve({ success: false, error: msg.error || 'Audio capture failed' });
              }
            };

            offscreenPort.onMessage.addListener(listener);
          });
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
            if (offscreenPort) {
              offscreenPort.postMessage({ type: 'STOP_AUDIO_CAPTURE' });
            } else {
              await chrome.runtime.sendMessage({ type: 'STOP_AUDIO_CAPTURE' });
            }
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
      offscreenPort.postMessage({ type: 'SET_GAIN', index: msg.bandIndex, value: msg.value });
    } else {
      pendingPortMessages.push({ type: 'SET_GAIN', index: msg.bandIndex, value: msg.value });
    }
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "SET_MASTER_VOLUME") {
    if (offscreenPort) {
      offscreenPort.postMessage({ type: 'SET_VOLUME', value: msg.value });
    } else {
      pendingPortMessages.push({ type: 'SET_VOLUME', value: msg.value });
    }
    sendResponse({ success: true });
    return true;
  }

  // Accept legacy/setter variants from popup
  if (msg.type === "SET_GAIN") {
    if (offscreenPort) {
      offscreenPort.postMessage({ type: 'SET_GAIN', index: msg.index, value: msg.value });
    } else {
      pendingPortMessages.push({ type: 'SET_GAIN', index: msg.index, value: msg.value });
    }
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "GET_ANALYSER_DATA") {
    if (!offscreenPort) {
      sendResponse({ success: false, data: [] });
      return true;
    }

    // Send request and wait for one-time ANALYSER_DATA response
    (async () => {
      try {
        const data = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting analyser')), 2000);
          const listener = (m) => {
            if (m && m.type === 'ANALYSER_DATA') {
              clearTimeout(timeout);
              offscreenPort.onMessage.removeListener(listener);
              resolve(m);
            }
          };
          offscreenPort.onMessage.addListener(listener);
          try {
            offscreenPort.postMessage({ type: 'GET_ANALYSER_DATA' });
          } catch (e) {
            clearTimeout(timeout);
            offscreenPort.onMessage.removeListener(listener);
            reject(e);
          }
        });

        sendResponse({ success: !!data.success, data: data.data || [] });
      } catch (err) {
        console.warn('Error getting analyser data:', err.message);
        sendResponse({ success: false, data: [] });
      }
    })();
    return true;
  }

  if (msg.type === 'SET_TAB_VOLUME') {
    // Attempt to set volume inside the target tab by injecting code that sets <audio>/<video> elements volume
    const tabId = msg.tabId;
    const vol = msg.volume;
    if (typeof tabId === 'number') {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (v) => {
          try {
            const els = Array.from(document.querySelectorAll('audio,video'));
            if (els.length === 0) return { ok: false, reason: 'no_elements' };
            els.forEach(e => { try { e.volume = v; } catch {} });
            return { ok: true };
          } catch (e) { return { ok: false, reason: e.message }; }
        },
        args: [vol]
      }).then(() => sendResponse({ success: true })).catch(err => { console.error('SET_TAB_VOLUME error:', err); sendResponse({ success: false, error: err.message }); });
      return true;
    }
    sendResponse({ success: false, error: 'missing tabId' });
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
