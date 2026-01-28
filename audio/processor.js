let audioCtx;
let source;
let filters = [];
let gainNode;
let analyser;
let isPremium = false;

export async function initAudio(stream, premium = false) {
  if (audioCtx) {
    try {
      await audioCtx.close();
    } catch (e) {
      console.log("Error cerrando contexto anterior:", e);
    }
  }
  
  audioCtx = new AudioContext({ latencyHint: "interactive" });
  
  // Asegurar que el contexto esté corriendo
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  source = audioCtx.createMediaStreamSource(stream);

  // Get premium status from storage
  chrome.storage.local.get(['isPremium'], (result) => {
    isPremium = result.isPremium || false;
    setupAudioGraph(); // Reconfigurar grafo con el estado premium correcto
  });

  setupAudioGraph();
  
  return true;
}

function setupAudioGraph() {
  // Limpiar conexiones anteriores si existen
  try {
    if (source) source.disconnect();
    if (filters) filters.forEach(f => f.disconnect());
    if (gainNode) gainNode.disconnect();
    if (analyser) analyser.disconnect();
  } catch (e) {
    console.log("Error desconectando nodos:", e);
  }

  // Select frequencies based on premium status
  const freqs = isPremium 
    ? [20, 40, 60, 100, 170, 250, 350, 500, 1000, 2000, 3500, 5000, 7000, 10000, 16000] // 15 bands
    : [60, 170, 350, 1000, 3500, 10000]; // 6 bands

  let last = source;
  filters = []; // Reset filters

  // Create filters
  freqs.forEach(freq => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = freq;
    filter.Q.value = 1;
    filter.gain.value = 0;
    last.connect(filter);
    last = filter;
    filters.push(filter);
  });

  // Analyser for spectrum visualization
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  last.connect(analyser);

  // Master Gain
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 1.0;
  analyser.connect(gainNode);

  // Compressor to prevent saturation (Limiter)
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -10; // Start compressing at -10dB
  compressor.knee.value = 10; // Smooth transition
  compressor.ratio.value = 20; // High ratio (limiter style)
  compressor.attack.value = 0.005; // Fast attack
  compressor.release.value = 0.1; // Fast release
  gainNode.connect(compressor);

  // Output to speakers
  compressor.connect(audioCtx.destination);
}

export function setGain(index, value) {
  if (filters && filters[index]) {
    try {
        filters[index].gain.value = parseFloat(value);
    } catch(e) {
        console.error("Error setting gain:", e);
    }
  }
}

export function setMasterVolume(value) {
  if (gainNode) {
    try {
        gainNode.gain.value = parseFloat(value);
    } catch(e) {
        console.error("Error setting volume:", e);
    }
  }
}

export function getAnalyserData() {
  if (!analyser) return null;
  
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  
  return Array.from(dataArray);
}

export function getBands() {
  return isPremium
    ? [20, 40, 60, 100, 170, 250, 350, 500, 1000, 2000, 3500, 5000, 7000, 10000, 16000]
    : [60, 170, 350, 1000, 3500, 10000];
}
