console.log("Smart Audio EQ: Content script loaded.");

// ===== AUDIO CONTROL =====
let audioContext = null;
let mediaSource = null;
let bands = []; // Array de filtros biquad
let compressor = null;
let gainNode = null;
let analyser = null;
let isEnabled = false;
const frequencies = [60, 170, 350, 1000, 3500, 10000]; // 6 bandas free

// Inicializar audio context
function initAudioContext() {
  if (audioContext) return;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log("Audio context creado:", audioContext.state);
  } catch (e) {
    console.error("No se pudo crear AudioContext:", e);
  }
}

// Activar ecualizador en la pestaña
function activateEQ() {
  if (isEnabled) return;
  
  initAudioContext();
  
  // Buscar elemento de audio/video
  let mediaElement = document.querySelector('video') || document.querySelector('audio');
  
  if (!mediaElement) {
    console.warn("No se encontró elemento audio/video en la página");
    return false;
  }
  
  console.log("Elemento encontrado:", mediaElement.tagName);
  
  try {
    // Crear source desde el elemento de media
    mediaSource = audioContext.createMediaElementAudioSource(mediaElement);
    
    // Crear filtros (6 bandas)
    bands = [];
    frequencies.forEach(freq => {
      const filter = audioContext.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      bands.push(filter);
    });
    
    // Crear analizador para espectro
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    // Crear compressor (limiter)
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 10;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.1;
    
    // Crear nodo de ganancia
    gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;
    
    // CONEXIÓN CLAVE: Asegurar que el audio llegue a los altavoces
    mediaSource.connect(bands[0]);
    
    // Conectar filtros en cadena
    for (let i = 0; i < bands.length - 1; i++) {
      bands[i].connect(bands[i + 1]);
    }
    
    // Último filtro → analizador y ganancia
    bands[bands.length - 1].connect(analyser);
    analyser.connect(gainNode);
    
    // IMPORTANTE: Conectar al destino (altavoces) para que no se silencie
    gainNode.connect(compressor);
    compressor.connect(audioContext.destination);
    
    isEnabled = true;
    console.log("✅ EQ activado sin silenciar audio");
    return true;
  } catch (e) {
    console.error("Error activando EQ:", e);
    return false;
  }
}

// Desactivar ecualizador
function deactivateEQ() {
  if (!isEnabled) return;
  
  try {
    if (mediaSource) {
      // Desconectar el chain de filtros
      mediaSource.disconnect();
      
      // Conectar directamente al destino
      mediaSource.connect(audioContext.destination);
    }
    isEnabled = false;
    console.log("✅ EQ desactivado");
    return true;
  } catch (e) {
    console.error("Error desactivando EQ:", e);
    return false;
  }
}

// Ajustar ganancia de una banda
function setBandGain(bandIndex, value) {
  if (bands[bandIndex]) {
    bands[bandIndex].gain.value = parseFloat(value);
  }
}

// Ajustar volumen maestro
function setMasterVolume(value) {
  if (gainNode) {
    gainNode.gain.value = parseFloat(value);
  }
}

// Obtener datos del analizador
function getAnalyserData() {
  if (!analyser) return null;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return Array.from(data);
}

// ===== ESCUCHAR MENSAJES DEL POPUP =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Content recibió:", msg.type);
  
  if (msg.type === "ENABLE_EQ") {
    const success = activateEQ();
    sendResponse({ success });
    return false;
  }
  
  if (msg.type === "DISABLE_EQ") {
    const success = deactivateEQ();
    sendResponse({ success });
    return false;
  }
  
  if (msg.type === "SET_BAND_GAIN") {
    setBandGain(msg.bandIndex, msg.value);
    sendResponse({ success: true });
    return false;
  }
  
  if (msg.type === "SET_MASTER_VOLUME") {
    setMasterVolume(msg.value);
    sendResponse({ success: true });
    return false;
  }
  
  if (msg.type === "GET_SPECTRUM_DATA") {
    const data = getAnalyserData();
    sendResponse({ success: true, data });
    return true;
  }
});

// ===== SYNC DE USUARIO (desde web) =====
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type && event.data.type === "LOGIN_EXITOSO") {
    console.log("Smart Audio EQ: Received login data from page:", event.data);
    
    try {
      chrome.runtime.sendMessage({
        type: "LOGIN_EXITOSO",
        uid: event.data.uid,
        email: event.data.email,
        isPremium: event.data.isPremium
      }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Smart Audio EQ: Runtime error:", chrome.runtime.lastError);
          } else {
            console.log("Smart Audio EQ: Background response:", response);
          }
      });
    } catch (e) {
      console.error("Smart Audio EQ: Error sending message:", e);
    }
  }
});

// ===== SESSION CHECK =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_WEB_SESSION") {
    console.log("Content: Asking web page for session...");
    window.postMessage({ type: "REQUEST_SESSION" }, "*");
    sendResponse({ status: "Request sent to web page" });
    return false;
  }

  if (msg.type === "PREGUNTAR_DATOS") {
     console.log("Content: Extension asking for data via localStorage...");
     const datos = localStorage.getItem('user_sync_data');
     console.log("Content: Found data:", datos);
     
     if (datos) {
         sendResponse(JSON.parse(datos));
         return false;
     } else {
         console.log("Content: localStorage empty, asking page via postMessage...");
         window.postMessage({ type: "REQUEST_SESSION" }, "*");
         
         const responseHandler = (event) => {
             if (event.source === window && event.data.type === "LOGIN_EXITOSO") {
                 console.log("Content: Got data from page fallback:", event.data);
                 try {
                   sendResponse({
                       uid: event.data.uid,
                       email: event.data.email,
                       isPremium: event.data.isPremium
                   });
                 } catch (e) {
                   console.log("Content: Response already sent", e);
                 }
                 window.removeEventListener("message", responseHandler);
             }
         };
         window.addEventListener("message", responseHandler);
         
         setTimeout(() => {
             window.removeEventListener("message", responseHandler);
             try {
               sendResponse({ uid: null, email: null, isPremium: false });
             } catch (e) {
               console.log("Content: Response already sent or connection closed");
             }
         }, 2000);
         return true; // Keep channel open for async response
     }
  }
  return false; // Default: synchronous
});