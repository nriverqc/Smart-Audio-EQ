let audioCtx;
let source;
let filters = [];
let gainNode;
let analyser;
let isPremium = false;

export async function initAudio(stream, premium = false) {
  console.log("🎵 Inicializando Audio Context...");
  isPremium = premium;
  
  // Cerrar contexto anterior si existe
  if (audioCtx) {
    try {
      if (audioCtx.state !== 'closed') {
        await audioCtx.close();
      }
    } catch (e) {
      console.warn("⚠️ Error cerrando contexto anterior:", e.message);
    }
  }
  
  // Crear nuevo contexto
  try {
    audioCtx = new AudioContext({ latencyHint: "interactive" });
    console.log("✅ AudioContext creado:", audioCtx.state);
  } catch (e) {
    console.error("❌ Error creando AudioContext:", e);
    throw e;
  }
  
  // Reanudar si está suspendido
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
      console.log("✅ AudioContext reanudado");
    } catch (e) {
      console.error("❌ Error reanudando AudioContext:", e);
      throw e;
    }
  }

  // Crear fuente de audio
  try {
    source = audioCtx.createMediaStreamSource(stream);
    console.log("✅ MediaStreamSource creado");
  } catch (e) {
    console.error("❌ Error creando MediaStreamSource:", e);
    throw e;
  }

  // Configurar audio graph directamente
  try {
    console.log("📊 Premium status:", isPremium);
    setupAudioGraph();
    console.log("✅ Audio graph configurado correctamente");
    return Promise.resolve(true);
  } catch (e) {
    console.error("❌ Error configurando audio graph:", e);
    return Promise.reject(e);
  }
}

function setupAudioGraph() {
  // Validar que tenemos los elementos necesarios
  if (!audioCtx) {
    console.error("❌ AudioContext no está inicializado");
    return;
  }

  if (!source) {
    console.error("❌ MediaStreamSource no está inicializado");
    return;
  }

  // Limpiar conexiones anteriores
  try {
    if (filters && filters.length > 0) {
      filters.forEach(f => {
        try {
          f.disconnect();
        } catch (e) {
          console.warn("⚠️ Error desconectando filtro:", e.message);
        }
      });
    }
    if (gainNode) gainNode.disconnect();
    if (analyser) analyser.disconnect();
  } catch (e) {
    console.warn("⚠️ Error limpiando nodos previos:", e.message);
  }

  // Seleccionar frecuencias según estado premium
  const freqs = isPremium 
    ? [20, 40, 60, 100, 170, 250, 350, 500, 1000, 2000, 3500, 5000, 7000, 10000, 16000] // 15 bands
    : [60, 170, 350, 1000, 3500, 10000]; // 6 bands

  console.log(`📊 Configurando ${freqs.length} bandas de ecualización`);

  let lastNode = source;
  filters = []; // Resetear filtros

  // Crear filtros
  try {
    freqs.forEach((freq, idx) => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      lastNode.connect(filter);
      lastNode = filter;
      filters.push(filter);
      console.log(`  ✅ Filtro ${idx}: ${freq}Hz`);
    });
  } catch (e) {
    console.error("❌ Error creando filtros:", e);
    return;
  }

  // Analyser para visualización de espectro
  try {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    lastNode.connect(analyser);
    console.log("✅ Analyser creado");
  } catch (e) {
    console.error("❌ Error creando Analyser:", e);
    return;
  }

  // Master Gain
  try {
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 1.0;
    analyser.connect(gainNode);
    console.log("✅ GainNode creado");
  } catch (e) {
    console.error("❌ Error creando GainNode:", e);
    return;
  }

  // Compresor para prevenir saturación (Limitador)
  try {
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 10;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.1;
    gainNode.connect(compressor);
    compressor.connect(audioCtx.destination);
    console.log("✅ Compressor y destino conectados");
  } catch (e) {
    console.error("❌ Error conectando compressor:", e);
    return;
  }

  console.log("✅ Audio graph completamente configurado");
}

export function setGain(index, value) {
  console.log(`📊 setGain called: index=${index}, value=${value}`);
  
  if (!filters) {
    console.error(`❌ Filtros no inicializados`);
    return;
  }
  
  if (index < 0 || index >= filters.length) {
    console.error(`❌ Índice de banda fuera de rango: ${index} (total: ${filters.length})`);
    return;
  }

  if (!filters[index]) {
    console.error(`❌ Banda ${index} no existe`);
    return;
  }

  try {
    const gainValue = parseFloat(value);
    filters[index].gain.value = gainValue;
    console.log(`✅ Banda ${index} aplicada: ${gainValue}dB (frequency: ${filters[index].frequency.value}Hz)`);
  } catch (e) {
    console.error(`❌ Error configurando ganancia banda ${index}:`, e.message);
  }
}

export function setMasterVolume(value) {
  console.log(`🔊 setMasterVolume called: ${value}`);
  
  if (!gainNode) {
    console.error("❌ GainNode no inicializado");
    return;
  }

  try {
    const volValue = Math.min(3, parseFloat(value)); // Máximo 3x (300%)
    gainNode.gain.value = volValue;
    console.log(`✅ Volumen aplicado: ${volValue.toFixed(2)}x (${(volValue * 100).toFixed(0)}%)`);
  } catch (e) {
    console.error("❌ Error configurando volumen:", e.message);
  }
}

export function getAnalyserData() {
  if (!analyser) {
    // Silently return empty if just not ready yet to avoid console spam
    // console.warn("⚠️ Analyser no disponible");
    return null;
  }
  
  try {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    return Array.from(dataArray);
  } catch (e) {
    console.error("❌ Error obteniendo spectrum data:", e.message);
    return null;
  }
}
