/**
 * Audio Manager - Handles multi-tab audio processing
 * FREE USERS: 1 active AudioContext at a time
 * PREMIUM USERS: Independent AudioContext per tab
 */

class AudioManager {
  constructor() {
    this.activeContexts = new Map(); // tabId -> {context, processor, streamId, settings}
    this.tabSettings = new Map(); // tabId -> {bands, volume, preset, isPremium}
    this.maxActiveContexts = 1; // Upgraded to infinity if premium
  }

  async initializeForTab(tabId, isPremium = false) {
    if (isPremium) {
      this.maxActiveContexts = Infinity;
    }

    if (this.activeContexts.has(tabId)) {
      return this.activeContexts.get(tabId);
    }

    // Check if we've hit the limit
    if (this.activeContexts.size >= this.maxActiveContexts) {
      const firstTabId = this.activeContexts.keys().next().value;
      await this.stopAudioForTab(firstTabId);
    }

    // Get audio stream for this tab
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId
    });

    if (!streamId) {
      throw new Error(`Failed to get stream for tab ${tabId}`);
    }

    // Create AudioContext and setup filters
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } });
    const source = audioContext.createMediaStreamSource(mediaStream);

    // Setup 6-band equalizer with compressor
    const bands = this.createEqualizerBands(audioContext);
    const compressor = audioContext.createDynamicsCompressor();
    const gainNode = audioContext.createGain();

    source.connect(bands[0]);
    bands.forEach((band, i) => {
      if (i < bands.length - 1) {
        band.connect(bands[i + 1]);
      }
    });
    bands[bands.length - 1].connect(compressor);
    compressor.connect(gainNode);
    gainNode.connect(audioContext.destination);

    this.activeContexts.set(tabId, {
      audioContext,
      source,
      bands,
      compressor,
      gainNode,
      mediaStream,
      streamId
    });

    return this.activeContexts.get(tabId);
  }

  createEqualizerBands(audioContext) {
    const frequencies = [60, 170, 350, 1000, 3500, 10000];
    const bands = [];

    frequencies.forEach(freq => {
      const biquad = audioContext.createBiquadFilter();
      biquad.type = 'peaking';
      biquad.frequency.value = freq;
      biquad.Q.value = 1;
      biquad.gain.value = 0;
      bands.push(biquad);
    });

    return bands;
  }

  setGainForTab(tabId, bandIndex, gainValue) {
    const context = this.activeContexts.get(tabId);
    if (context && context.bands[bandIndex]) {
      context.bands[bandIndex].gain.value = gainValue;
    }
  }

  setMasterVolumeForTab(tabId, volume) {
    const context = this.activeContexts.get(tabId);
    if (context) {
      context.gainNode.gain.value = volume;
    }
  }

  async stopAudioForTab(tabId) {
    const context = this.activeContexts.get(tabId);
    if (context) {
      context.mediaStream.getTracks().forEach(track => track.stop());
      context.audioContext.close();
      this.activeContexts.delete(tabId);
      this.tabSettings.delete(tabId);
    }
  }

  getActiveTabIds() {
    return Array.from(this.activeContexts.keys());
  }

  getSettingsForTab(tabId) {
    return this.tabSettings.get(tabId) || {};
  }

  setSettingsForTab(tabId, settings) {
    this.tabSettings.set(tabId, { ...this.getSettingsForTab(tabId), ...settings });
  }
}

// Export for use in offscreen document
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioManager;
}
