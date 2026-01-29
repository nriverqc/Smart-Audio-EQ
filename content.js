// content.js
// Simplificado: Ya no gestiona audio. Solo comunicación básica si es necesaria.

// GUARD: Evitar ejecución doble
if (window.__SMART_AUDIO_EQ_LOADED) {
  // Ya cargado
} else {
  window.__SMART_AUDIO_EQ_LOADED = true;
  console.log("✅ Smart Audio EQ: Content script loaded (per-tab audio processing)");

  // Per-tab audio processing state
  let audioCtx = null;
  let sources = []; // one source per media element
  let filters = [];
  let analyser = null;
  let gainNode = null;
  let compressor = null;
  let isProcessing = false;

  function createFilters(ctx, bandFreqs) {
    const f = [];
    bandFreqs.forEach((freq) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      f.push(filter);
    });
    return f;
  }

  async function startTabProcessing(isPremium) {
    try {
      // Find audio/video elements on the page
      const els = Array.from(document.querySelectorAll('audio,video'));
      if (els.length === 0) {
        return { success: false, error: 'no_audio_elements' };
      }

      // Create AudioContext if needed
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      }

      // Select band frequencies: premium -> 10-band, free -> 6-band
      const bandFreqs = isPremium
        ? [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
        : [60, 170, 350, 1000, 3500, 10000];

      // Create shared filters chain
      filters = createFilters(audioCtx, bandFreqs);

      // Create analyser
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      // Master gain
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0;

      // Compressor
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -10;
      compressor.knee.value = 10;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.1;

      // Connect chain: filters[0] <- filters[1] <- ... <- analyser <- gain -> compressor -> destination
      // We'll connect sources into filters[0]
      let last = filters.length > 0 ? filters[0] : null;
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }

      if (last) {
        last.connect(analyser);
      }
      analyser.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(audioCtx.destination);

      // For each media element, create source and connect to filter chain
      sources = [];
      els.forEach((el) => {
        try {
          const src = audioCtx.createMediaElementSource(el);
          // connect to first filter or directly to analyser
          if (filters.length > 0) {
            src.connect(filters[0]);
          } else {
            src.connect(analyser);
          }
          sources.push({ el, src });
        } catch (e) {
          // createMediaElementSource can throw if element is already used by another context
          console.warn('Could not create MediaElementSource for element', e.message);
        }
      });

      isProcessing = true;
      return { success: true };
    } catch (e) {
      console.error('startTabProcessing error:', e.message);
      return { success: false, error: e.message };
    }
  }

  function stopTabProcessing() {
    try {
      sources.forEach(({ src }) => { try { src.disconnect(); } catch (e) {} });
      sources = [];

      if (filters) filters.forEach(f => { try { f.disconnect(); } catch (e) {} });
      filters = [];

      try { if (analyser) analyser.disconnect(); } catch (e) {}
      try { if (gainNode) gainNode.disconnect(); } catch (e) {}
      try { if (compressor) compressor.disconnect(); } catch (e) {}

      // Note: do not close audioCtx to allow smooth resume; but if desired, close it
      isProcessing = false;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function setBandGain(index, value) {
    try {
      const v = parseFloat(value);
      if (!filters || index < 0 || index >= filters.length) return { success: false, error: 'invalid_index' };
      // Smooth ramp 50ms
      const now = audioCtx.currentTime;
      filters[index].gain.cancelScheduledValues(now);
      filters[index].gain.linearRampToValueAtTime(v, now + 0.05);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  }

  function setMasterVolume(value) {
    try {
      const v = Math.min(3, parseFloat(value));
      const now = audioCtx.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.linearRampToValueAtTime(v, now + 0.05);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  }

  function getAnalyserData() {
    try {
      if (!analyser) return { success: false, data: [] };
      const arr = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(arr);
      return { success: true, data: Array.from(arr) };
    } catch (e) { return { success: false, error: e.message }; }
  }

  function setTabElementVolume(v) {
    try {
      const val = parseFloat(v);
      const els = Array.from(document.querySelectorAll('audio,video'));
      if (els.length === 0) return { success: false, reason: 'no_elements' };
      els.forEach(e => { try { e.volume = val; } catch (e) {} });
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  }

  // Listeners from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      try {
        if (msg.type === 'START_TAB_EQ') {
          const res = await startTabProcessing(msg.isPremium || false);
          sendResponse(res);
          return;
        }

        if (msg.type === 'STOP_TAB_EQ') {
          const res = stopTabProcessing();
          sendResponse(res);
          return;
        }

        if (msg.type === 'SET_GAIN') {
          sendResponse(setBandGain(msg.index, msg.value));
          return;
        }

          if (msg.type === 'APPLY_PRESET') {
            // msg.gains: array of gain values matching filters length
            try {
              const gains = Array.isArray(msg.gains) ? msg.gains : [];
              // Apply each band smoothly
              for (let i = 0; i < gains.length; i++) {
                setBandGain(i, gains[i]);
              }

              // Auto master-volume compensation based on peak positive gain
              const posGains = gains.filter(g => typeof g === 'number' && g > 0);
              const maxPos = posGains.length ? Math.max(...posGains) : 0;
              let masterFactor = 1.0;
              if (maxPos >= 15) masterFactor = 0.5;
              else if (maxPos >= 10) masterFactor = 0.6;
              else if (maxPos >= 6) masterFactor = 0.75;

              setMasterVolume(masterFactor);
              sendResponse({ success: true });
            } catch (e) {
              sendResponse({ success: false, error: e.message });
            }
            return;
          }

        if (msg.type === 'SET_VOLUME') {
          sendResponse(setMasterVolume(msg.value));
          return;
        }

        if (msg.type === 'GET_ANALYSER_DATA') {
          sendResponse(getAnalyserData());
          return;
        }

        if (msg.type === 'SET_TAB_ELEMENT_VOLUME') {
          sendResponse(setTabElementVolume(msg.value));
          return;
        }
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  });
}
