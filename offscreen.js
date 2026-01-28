import { initAudio, setGain, setMasterVolume, getAnalyserData } from './audio/processor.js';

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
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
      
      await initAudio(stream);
      sendResponse({ success: true });
    } catch (err) {
      console.error('Error capturing audio in offscreen:', err);
      sendResponse({ success: false, error: err.message });
    }
    return true; // async response
  }
  
  if (msg.type === 'STOP_AUDIO_CAPTURE') {
      // Opcional: limpiar recursos aquí si no se cierra el documento
      // window.close(); // También se puede cerrar desde aquí
      sendResponse({ success: true });
      return true;
  }

  if (msg.type === 'SET_GAIN') {
    setGain(msg.index, msg.value);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === 'SET_VOLUME') {
    setMasterVolume(msg.value);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === 'GET_ANALYSER_DATA') {
    try {
      const data = getAnalyserData();
      sendResponse({ success: true, data });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (msg.type === 'SET_TAB_VOLUME') {
    // Handle per-tab volume
    setMasterVolume(msg.volume);
    sendResponse({ success: true });
    return true;
  }
});

// Keep-alive mechanism
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'PING' }).catch(() => {});
}, 20000);
