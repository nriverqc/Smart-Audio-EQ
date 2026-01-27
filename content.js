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

// Listen for messages from the extension (popup) asking for session
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_WEB_SESSION") {
    console.log("Content: Asking web page for session...");
    window.postMessage({ type: "REQUEST_SESSION" }, "*");
    sendResponse({ status: "Request sent to web page" });
  }

  if (msg.type === "PREGUNTAR_DATOS") {
     console.log("Content: Extension asking for data via localStorage...");
     const datos = localStorage.getItem('user_sync_data');
     console.log("Content: Found data:", datos);
     
     if (datos) {
         sendResponse(JSON.parse(datos));
     } else {
         // Fallback: Ask the page directly if localStorage is empty
         console.log("Content: localStorage empty, asking page via postMessage...");
         window.postMessage({ type: "REQUEST_SESSION" }, "*");
         
         // Wait for response
         const responseHandler = (event) => {
             if (event.source === window && event.data.type === "LOGIN_EXITOSO") {
                 console.log("Content: Got data from page fallback:", event.data);
                 sendResponse({
                     uid: event.data.uid,
                     email: event.data.email,
                     isPremium: event.data.isPremium
                 });
                 window.removeEventListener("message", responseHandler);
             }
         };
         window.addEventListener("message", responseHandler);
         
         // Timeout after 2 seconds
         setTimeout(() => {
             window.removeEventListener("message", responseHandler);
             // If we haven't responded yet (we can't check easily, but sendResponse can be called once)
             // We rely on the popup timeout if this fails
         }, 2000);
     }
     return true; // Keep channel open
  }
});
