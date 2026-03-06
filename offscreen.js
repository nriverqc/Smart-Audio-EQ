import { initAudio, setGain, setMasterVolume, getAnalyserData, stopAudio } from './audio/processor.js';

let port = null;

// Escuchar conexiones del background
chrome.runtime.onConnect.addListener((p) => {
  if (p.name === 'offscreen-port') {
    port = p;
    console.log("✅ Offscreen conectado al background");
    
    port.onMessage.addListener(async (msg) => {
      // console.log("Offscreen recibió:", msg.type, "Tab:", msg.tabId);
      
      if (msg.type === 'START_AUDIO_CAPTURE') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: msg.streamId
              }
            },
            video: false
          });
          
          const isPremium = msg.isPremium || false;
          const tabId = msg.tabId;
          await initAudio(tabId, stream, isPremium);
          
          port.postMessage({ type: 'AUDIO_CAPTURE_STARTED', success: true, tabId });
        } catch (err) {
          console.error('Error capturing audio in offscreen:', err);
          port.postMessage({ type: 'AUDIO_CAPTURE_FAILED', success: false, error: err.message, tabId: msg.tabId });
        }
      }
      
      if (msg.type === 'SET_GAIN') {
        setGain(msg.tabId, msg.index, msg.value);
      }
      
      if (msg.type === 'SET_VOLUME') {
        setMasterVolume(msg.tabId, msg.value);
      }
      
      if (msg.type === 'GET_ANALYSER_DATA') {
        try {
          const data = getAnalyserData(msg.tabId);
          port.postMessage({ type: 'ANALYSER_DATA', success: !!data, data, tabId: msg.tabId });
        } catch (err) {
          port.postMessage({ type: 'ANALYSER_DATA', success: false, error: err.message, tabId: msg.tabId });
        }
      }
      
      if (msg.type === 'STOP_AUDIO_CAPTURE') {
        stopAudio(msg.tabId);
        port.postMessage({ type: 'AUDIO_CAPTURE_STOPPED', success: true, tabId: msg.tabId });
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log("❌ Desconectado del background");
      port = null;
    });
  }
});

// Keep-alive mechanism
setInterval(() => {
  if (port) {
    try {
      port.postMessage({ type: 'PING' });
    } catch (err) {
      // console.warn('Error sending PING:', err.message);
    }
  }
}, 20000);
