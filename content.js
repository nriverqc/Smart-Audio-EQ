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
    
    // Reanudar contexto si está suspendido
    if (audioContext.state === 'suspended') {
      console.log("⏸️  AudioContext suspendido, intentando reanudar...");
      audioContext.resume().then(() => {
        console.log("✅ AudioContext reanudado");
      }).catch(e => {
        console.error("❌ No se pudo reanudar AudioContext:", e);
      });
    }
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

  // Verificación crítica
  if (!audioContext) {
    console.error("❌ Falló crear AudioContext");
    return false;
  }

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

    // Crear source
    if (mediaSource) {
      mediaSource.disconnect();
    }
    mediaSource = audioContext.createMediaElementAudioSource(mediaElement);
    console.log(`✅ MediaElementAudioSource creado`);

    // Crear filtros
    bands = [];
    frequencies.forEach((freq, idx) => {
      const filter = audioContext.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      bands.push(filter);
      console.log(`  ✓ Filtro ${idx} creado: ${freq}Hz`);
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
    console.log("🔗 Conectando cadena de audio...");
    mediaSource.connect(bands[0]);
    console.log("  ✓ Conectado: mediaSource → banda[0]");

    for (let i = 0; i < bands.length - 1; i++) {
      bands[i].connect(bands[i + 1]);
      console.log(`  ✓ Conectado: banda[${i}] → banda[${i + 1}]`);
    }

    bands[bands.length - 1].connect(analyser);
    console.log(`  ✓ Conectado: banda[${bands.length - 1}] → analyser`);
    
    analyser.connect(gainNode);
    console.log("  ✓ Conectado: analyser → gainNode");
    
    gainNode.connect(compressor);
    console.log("  ✓ Conectado: gainNode → compressor");
    
    compressor.connect(audioContext.destination);
    console.log("  ✓ Conectado: compressor → destination");

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
    if (mediaSource) {
      mediaSource.disconnect();
    }
    mediaSource = audioContext.createMediaStreamSource(stream);
    console.log(`✅ MediaStreamSource creado desde tabCapture`);

    // Crear filtros
    bands = [];
    frequencies.forEach((freq, idx) => {
      const filter = audioContext.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      bands.push(filter);
      console.log(`  ✓ Filtro ${idx} creado: ${freq}Hz`);
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
    console.log("🔗 Conectando cadena de audio...");
    mediaSource.connect(bands[0]);
    console.log("  ✓ Conectado: mediaSource → banda[0]");

    for (let i = 0; i < bands.length - 1; i++) {
      bands[i].connect(bands[i + 1]);
      console.log(`  ✓ Conectado: banda[${i}] → banda[${i + 1}]`);
    }

    bands[bands.length - 1].connect(analyser);
    console.log(`  ✓ Conectado: banda[${bands.length - 1}] → analyser`);
    
    analyser.connect(gainNode);
    console.log("  ✓ Conectado: analyser → gainNode");
    
    gainNode.connect(compressor);
    console.log("  ✓ Conectado: gainNode → compressor");
    
    compressor.connect(audioContext.destination);
    console.log("  ✓ Conectado: compressor → destination");

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
  console.log(`📝 setBandGain llamado: bandIndex=${bandIndex}, value=${value}`);
  console.log(`   Estado: bands existe=${!!bands}, length=${bands?.length}, isEnabled=${isEnabled}`);
  
  if (!bands || !bands[bandIndex]) {
    console.error(`❌ Banda ${bandIndex} no existe. Arrays:`, {
      bandsLength: bands?.length,
      bandIndex,
      isEnabled,
      audioContextState: audioContext?.state
    });
    return;
  }

  try {
    const gainValue = parseFloat(value);
    const oldValue = bands[bandIndex].gain.value;
    bands[bandIndex].gain.value = gainValue;
    
    console.log(`✅ Banda ${bandIndex} (${frequencies[bandIndex]}Hz): ${oldValue}dB → ${gainValue}dB`);
  } catch (e) {
    console.error(`❌ Error al setear banda ${bandIndex}:`, e);
  }
}

function setMasterVolume(value) {
  console.log(`📝 setMasterVolume llamado: value=${value}`);
  
  if (!gainNode) {
    console.error(`❌ GainNode no existe. Estado:`, {
      audioContextState: audioContext?.state,
      isEnabled,
      mediaSourceConnected: !!mediaSource
    });
    return;
  }

  try {
    const volumeValue = parseFloat(value);
    const clampedValue = Math.max(0, Math.min(2, volumeValue));
    const oldValue = gainNode.gain.value;
    gainNode.gain.value = clampedValue;
    
    console.log(`✅ Volumen maestro: ${oldValue.toFixed(2)} → ${clampedValue.toFixed(2)} (${(clampedValue * 100).toFixed(0)}%)`);
  } catch (e) {
    console.error(`❌ Error al setear volumen:`, e);
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
