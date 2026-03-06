let audioCtx;
let tabs = {}; // { [tabId]: { source, filters: [], gainNode, analyser, isPremium } }

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export async function initAudio(tabId, stream, premium = false) {
  console.log(`🎵 Inicializando Audio para tab ${tabId}...`);
  const ctx = getAudioCtx();
  
  // Clean up previous tab state if exists
  if (tabs[tabId]) {
    try {
      tabs[tabId].source.disconnect();
      tabs[tabId].filters.forEach(f => f.disconnect());
      tabs[tabId].gainNode.disconnect();
      tabs[tabId].analyser.disconnect();
    } catch (e) {
      console.warn(`⚠️ Error limpiando tab ${tabId}:`, e.message);
    }
  }

  const tabState = {
    isPremium: premium,
    filters: [],
    stream: stream, // Store stream to stop it later
    source: ctx.createMediaStreamSource(stream)
  };

  const freqs = premium 
    ? [20, 40, 60, 100, 170, 250, 350, 500, 1000, 2000, 3500, 5000, 7000, 10000, 16000] // 15 bands
    : [60, 170, 350, 1000, 3500, 10000]; // 6 bands

  let lastNode = tabState.source;

  // Create filters
  freqs.forEach((freq) => {
    const filter = ctx.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = freq;
    filter.Q.value = 1;
    filter.gain.value = 0;
    lastNode.connect(filter);
    lastNode = filter;
    tabState.filters.push(filter);
  });

  // Analyser
  tabState.analyser = ctx.createAnalyser();
  tabState.analyser.fftSize = 256;
  lastNode.connect(tabState.analyser);

  // Master Gain
  tabState.gainNode = ctx.createGain();
  tabState.gainNode.gain.value = 1.0;
  tabState.analyser.connect(tabState.gainNode);

  // Compressor (Global limiter per tab)
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -10;
  compressor.knee.value = 10;
  compressor.ratio.value = 20;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.1;
  
  tabState.gainNode.connect(compressor);
  compressor.connect(ctx.destination);

  tabs[tabId] = tabState;
  console.log(`✅ Audio graph configurado para tab ${tabId}`);
  return true;
}

export function setGain(tabId, index, value) {
  const tab = tabs[tabId];
  if (!tab || !tab.filters[index]) return;
  tab.filters[index].gain.value = parseFloat(value);
}

export function setMasterVolume(tabId, value) {
  const tab = tabs[tabId];
  if (!tab || !tab.gainNode) return;
  tab.gainNode.gain.value = Math.min(3, parseFloat(value));
}

export function getAnalyserData(tabId) {
  const tab = tabs[tabId];
  if (!tab || !tab.analyser) return null;
  const dataArray = new Uint8Array(tab.analyser.frequencyBinCount);
  tab.analyser.getByteFrequencyData(dataArray);
  return Array.from(dataArray);
}

export function stopAudio(tabId) {
    if (tabs[tabId]) {
        try {
            // Stop the media tracks to release capture
            if (tabs[tabId].stream) {
                tabs[tabId].stream.getTracks().forEach(track => track.stop());
                console.log(`✅ Tracks stopped for tab ${tabId}`);
            }
            
            tabs[tabId].source.disconnect();
            tabs[tabId].filters.forEach(f => f.disconnect());
            tabs[tabId].gainNode.disconnect();
            tabs[tabId].analyser.disconnect();
            delete tabs[tabId];
            console.log(`🛑 Audio detenido para tab ${tabId}`);
        } catch (e) {
            console.warn(`Error deteniendo audio para tab ${tabId}:`, e.message);
        }
    }
}
