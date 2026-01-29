import { initAudio, setGain, setMasterVolume, getAnalyserData } from './audio/processor.js';

let port = null;

// Escuchar conexiones del background
chrome.runtime.onConnect.addListener((p) => {
  if (p.name === 'offscreen-port') {
    port = p;
    console.log("✅ Offscreen conectado al background");
    
    port.onMessage.addListener(async (msg) => {
      console.log("Offscreen recibió:", msg.type);
      
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
          await initAudio(stream, isPremium);
          console.log("✅ Audio capture iniciado");
          port.postMessage({ type: 'AUDIO_CAPTURE_STARTED', success: true });
        } catch (err) {
          console.error('Error capturing audio in offscreen:', err);
          port.postMessage({ type: 'AUDIO_CAPTURE_STARTED', success: false, error: err.message });
        }
      }
      
      if (msg.type === 'SET_GAIN') {
        setGain(msg.index, msg.value);
      }
      
      if (msg.type === 'SET_VOLUME') {
        setMasterVolume(msg.value);
      }
      
      if (msg.type === 'GET_ANALYSER_DATA') {
        try {
          const data = getAnalyserData();
          port.postMessage({ type: 'ANALYSER_DATA', success: true, data });
        } catch (err) {
          port.postMessage({ type: 'ANALYSER_DATA', success: false, error: err.message });
        }
      }
      
      if (msg.type === 'STOP_AUDIO_CAPTURE') {
        port.postMessage({ type: 'AUDIO_CAPTURE_STOPPED', success: true });
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
    port.postMessage({ type: 'PING' }).catch(() => {});
  }
}, 20000);
