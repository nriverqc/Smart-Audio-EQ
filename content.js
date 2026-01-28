console.log("✅ Smart Audio EQ: Content script loaded");

// ========== ESTADO GLOBAL ==========
let audioContext = null;
let mediaSource = null;
let bands = [];
let compressor = null;
let gainNode = null;
let analyser = null;
let isEnabled = false;
let mediaStream = null;
const frequencies = [60, 170, 350, 1000, 3500, 10000];

// ========== FUNCIONES DE AUDIO ==========
function initAudioContext() {
  if (audioContext) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log("🎵 AudioContext creado:", audioContext.state);
  } catch (e) {
    console.error("❌ Error creando AudioContext:", e);
  }
}

function activateEQ(streamId) {
  if (isEnabled) {
    console.log("⚠️  EQ ya está activado");
    return true;
  }

  initAudioContext();

  // Si no hay streamId, intentar con elemento media tradicional
  if (!streamId) {
    console.log("📋 Intentando con elemento media tradicional...");
    let mediaElement = document.querySelector('video') || document.querySelector('audio');

    if (!mediaElement) {
      console.warn("❌ No se encontró elemento audio/video y no hay streamId");
      return false;
    }

    return activateEQWithMediaElement(mediaElement);
  }

  // Usar tabCapture si hay streamId
  return activateEQWithTabCapture(streamId);
}

function activateEQWithMediaElement(mediaElement) {
  try {
    console.log("📺 Usando MediaElementAudioSource");

    mediaSource = audioContext.createMediaElementAudioSource(mediaElement);

    // Crear filtros
    bands = [];
    frequencies.forEach(freq => {
      const filter = audioContext.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      bands.push(filter);
    });

    // Analizador
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    // Compressor
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 10;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.1;

    // Ganancia
    gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;

    // ===== CONEXIÓN CLAVE =====
    mediaSource.connect(bands[0]);

    for (let i = 0; i < bands.length - 1; i++) {
      bands[i].connect(bands[i + 1]);
    }

    bands[bands.length - 1].connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(audioContext.destination);

    isEnabled = true;
    console.log("✅ EQ activado (MediaElement)");
    return true;
  } catch (e) {
    console.error("❌ Error con MediaElement:", e);
    return false;
  }
}

async function activateEQWithTabCapture(streamId) {
  try {
    console.log("🔊 Usando tabCapture con streamId:", streamId);

    // Obtener el MediaStream desde el streamId
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    mediaStream = stream;
    mediaSource = audioContext.createMediaStreamSource(stream);

    // Crear filtros
    bands = [];
    frequencies.forEach(freq => {
      const filter = audioContext.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      bands.push(filter);
    });

    // Analizador
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    // Compressor
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 10;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.1;

    // Ganancia
    gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;

    // ===== CONEXIÓN =====
    mediaSource.connect(bands[0]);

    for (let i = 0; i < bands.length - 1; i++) {
      bands[i].connect(bands[i + 1]);
    }

    bands[bands.length - 1].connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(audioContext.destination);

    isEnabled = true;
    console.log("✅ EQ activado (TabCapture)");
    return true;
  } catch (e) {
    console.error("❌ Error con tabCapture:", e);
    return false;
  }
}

function deactivateEQ() {
  if (!isEnabled) return true;

  try {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (mediaSource) {
      mediaSource.disconnect();
    }
    isEnabled = false;
    console.log("✅ EQ desactivado");
    return true;
  } catch (e) {
    console.error("❌ Error desactivando EQ:", e);
    return false;
  }
}

function setBandGain(bandIndex, value) {
  if (bands[bandIndex]) {
    bands[bandIndex].gain.value = parseFloat(value);
    console.log(`🎚️  Banda ${bandIndex} = ${value}dB`);
  }
}

function setMasterVolume(value) {
  if (gainNode) {
    gainNode.gain.value = parseFloat(value);
    console.log(`🔊 Volumen maestro = ${value}`);
  }
}

function getAnalyserData() {
  if (!analyser) return null;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return Array.from(data);
}

// ========== ESCUCHAR MENSAJES ==========
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📨 Content recibió mensaje:", msg.type);

  if (msg.type === "ENABLE_EQ") {
    const success = activateEQ(msg.streamId);
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

  if (msg.type === "PREGUNTAR_DATOS") {
    const datos = localStorage.getItem('user_sync_data');
    if (datos) {
      sendResponse(JSON.parse(datos));
    } else {
      sendResponse({ uid: null, email: null, isPremium: false });
    }
    return false;
  }

  return false;
});

// ========== ESCUCHAR DESDE LA WEB ==========
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type === "LOGIN_EXITOSO") {
    console.log("🔐 Login recibido desde web:", event.data);

    try {
      chrome.runtime.sendMessage({
        type: "LOGIN_EXITOSO",
        uid: event.data.uid,
        email: event.data.email,
        isPremium: event.data.isPremium
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log("⚠️  Error de runtime:", chrome.runtime.lastError.message);
        } else {
          console.log("✅ Background confirmó login");
        }
      });
    } catch (e) {
      console.error("❌ Error enviando login al background:", e);
    }
  }
});

console.log("✅ Content script listo para recibir mensajes");
