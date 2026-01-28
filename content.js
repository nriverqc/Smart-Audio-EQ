console.log("Smart Audio EQ: Content script loaded.");

// Listen for messages from the web page (smart-audio-eq.pages.dev)
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) return;

  if (event.data.type && event.data.type === "LOGIN_EXITOSO") {
    console.log("Smart Audio EQ: Received login data from page:", event.data);
    
    // Relay to background script
    try {
      chrome.runtime.sendMessage({
        type: "LOGIN_EXITOSO",
        uid: event.data.uid,
        email: event.data.email,
        isPremium: event.data.isPremium
      }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Smart Audio EQ: Runtime error (extension might not be installed):", chrome.runtime.lastError);
          } else {
            console.log("Smart Audio EQ: Background response:", response);
          }
      });
    } catch (e) {
      console.error("Smart Audio EQ: Error sending message:", e);
    }
  }
});

// Listen for messages from the extension (popup) asking for session
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_WEB_SESSION") {
    console.log("Content: Asking web page for session...");
    window.postMessage({ type: "REQUEST_SESSION" }, "*");
    sendResponse({ status: "Request sent to web page" });
    return false; // Synchronous response
  }

  if (msg.type === "PREGUNTAR_DATOS") {
     console.log("Content: Extension asking for data via localStorage...");
     const datos = localStorage.getItem('user_sync_data');
     console.log("Content: Found data:", datos);
     
     if (datos) {
         sendResponse(JSON.parse(datos));
         return false; // Synchronous response
     } else {
         // Fallback: Ask the page directly if localStorage is empty
         console.log("Content: localStorage empty, asking page via postMessage...");
         window.postMessage({ type: "REQUEST_SESSION" }, "*");
         
         // Wait for response asynchronously
         const responseHandler = (event) => {
             if (event.source === window && event.data.type === "LOGIN_EXITOSO") {
                 console.log("Content: Got data from page fallback:", event.data);
                 try {
                   sendResponse({
                       uid: event.data.uid,
                       email: event.data.email,
                       isPremium: event.data.isPremium
                   });
                 } catch (e) {
                   console.log("Content: Response already sent", e);
                 }
                 window.removeEventListener("message", responseHandler);
             }
         };
         window.addEventListener("message", responseHandler);
         
         // Timeout after 2 seconds
         setTimeout(() => {
             window.removeEventListener("message", responseHandler);
             // Try to respond with empty data if timeout
             try {
               sendResponse({ uid: null, email: null, isPremium: false });
             } catch (e) {
               console.log("Content: Response already sent or connection closed");
             }
         }, 2000);
         return true; // Keep channel open for async response
     }
  }
  return false; // Default: synchronous
});
