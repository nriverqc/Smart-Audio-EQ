console.log("Smart Audio EQ: Content script loaded.");

// Listen for messages from the web page (smart-audio-eq.pages.dev)
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) return;

  if (event.data.type && event.data.type === "LOGIN_EXITOSO") {
    console.log("Smart Audio EQ: Received login data from page:", event.data);
    
    // Relay to background script
    chrome.runtime.sendMessage({
      type: "LOGIN_EXITOSO",
      uid: event.data.uid,
      email: event.data.email,
      isPremium: event.data.isPremium
    }, (response) => {
        console.log("Smart Audio EQ: Background response:", response);
    });
  }
});
