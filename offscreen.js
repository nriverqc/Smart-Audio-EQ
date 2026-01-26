import { initAudio, setGain } from './audio/processor.js';

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
      
      initAudio(stream);
      sendResponse({ success: true });
    } catch (err) {
      console.error('Error capturing audio in offscreen:', err);
      sendResponse({ success: false, error: err.message });
    }
    return true; // async response
  }
  
  if (msg.type === 'SET_GAIN') {
    setGain(msg.index, msg.value);
  }
});
