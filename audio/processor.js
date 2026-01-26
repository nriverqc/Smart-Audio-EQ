let audioCtx;
let source;
let filters = [];
let gainNode;

export function initAudio(stream) {
  if (audioCtx) audioCtx.close();
  
  audioCtx = new AudioContext({ latencyHint: "interactive" });
  source = audioCtx.createMediaStreamSource(stream);

  const freqs = [60, 170, 350, 1000, 3500, 10000]; // Basic 6 bands
  // Premium bands could be added here dynamically

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

  // Master Gain
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 1.0;
  last.connect(gainNode);

  // Output to speakers
  gainNode.connect(audioCtx.destination);
  
  return true;
}

export function setGain(index, value) {
  if (filters[index]) {
    filters[index].gain.value = parseFloat(value);
  }
}

export function setMasterVolume(value) {
  if (gainNode) {
    gainNode.gain.value = parseFloat(value);
  }
}

export function getBands() {
    return [60, 170, 350, 1000, 3500, 10000];
}
