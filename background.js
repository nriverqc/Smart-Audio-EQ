import { checkAppPass, activateAppPass, manageAppPass } from '@chrome-stats/app-pass-sdk';

// Service Worker con gestión de Offscreen Document
// Migrado para cumplir con Manifest V3 y evitar problemas de CSP/Autoplay

console.log("Smart Audio EQ: Background Service Worker iniciado");

// ===== AUTOMATIC APP PASS CHECK (SDK) =====
async function notifyWebTabsOfPremium() {
    try {
        const tabs = await chrome.tabs.query({ url: "*://smart-audio-eq.pages.dev/*" });
        tabs.forEach(t => {
            chrome.tabs.sendMessage(t.id, { type: "PREMIUM_ACTIVADO_EXT" });
        });
    } catch (e) { console.log("Error notifying tabs", e); }
}

async function performAutomaticAppPassCheck() {
  try {
    const response = await checkAppPass();
    if (response.status === 'ok' && response.appPassToken) {
      console.log('✅ Background: Official App Pass detected!');
      
      const storage = await chrome.storage.local.get(['email', 'uid']);
      isPremium = true; // Update global variable
      await chrome.storage.local.set({ isPremium: true });
      
      // Notify open web tabs immediately
      notifyWebTabsOfPremium();
      
      if (storage.email && storage.uid) {
        // Verify token with backend to persist in DB
        fetch("https://smart-audio-eq-1.onrender.com/verify-official-app-pass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: storage.email,
            uid: storage.uid,
            token: response.appPassToken
          })
        }).catch(e => console.log("Backend sync failed, but local premium is active"));
      }
      return true;
    } else {
      console.log('ℹ️ Background: No official App Pass detected:', response.message);
      // We DO NOT set isPremium to false here, because they might have PayPal premium
      return false;
    }
  } catch (e) {
    console.warn('❌ Background: App Pass SDK Check failed:', e.message);
    return false;
  }
}

// Check on startup
chrome.runtime.onStartup.addListener(() => {
    console.log("Background: Browser startup. Re-verifying status...");
    performAutomaticAppPassCheck();
    // Also try to sync license if we have credentials
    chrome.storage.local.get(['email', 'uid', 'isPremium'], (res) => {
        if (res.isPremium) isPremium = true; // Trust local storage first
        
        if (res.email && res.uid) {
            fetch(`https://smart-audio-eq-1.onrender.com/check-license?email=${encodeURIComponent(res.email)}&uid=${encodeURIComponent(res.uid)}`)
            .then(r => r.json())
            .then(data => {
                // ONLY update if the server actually responds with a boolean
                if (typeof data.premium === 'boolean') {
                    isPremium = data.premium;
                    chrome.storage.local.set({ isPremium: data.premium });
                }
            }).catch(e => console.log("Startup license check failed (offline?) - keeping local status"));
        }
    });
});

performAutomaticAppPassCheck();
// Check every 6 hours
chrome.alarms.create('check-app-pass', { periodInMinutes: 360 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-app-pass') performAutomaticAppPassCheck();
});

// ===== GESTIÓN DE OFFSCREEN DOCUMENT =====
let creating; // Promesa para evitar condiciones de carrera
let offscreenPort = null; // Puerto persistente para comunicación con offscreen
let pendingPortMessages = []; 
let isPremium = false; // Estado global de premium

// Cargar estado inicial
chrome.storage.local.get(['isPremium'], (res) => {
  isPremium = res.isPremium || false;
  console.log('Background: Initial isPremium state:', isPremium);
});

// Track per-tab EQ state
let activeTabs = {}; // { [tabId]: { enabled: bool, preset: string, isPremium: bool, masterVolume: number, gains: [] } }

// Cargar estado persistido de activeTabs al iniciar el service worker
chrome.storage.local.get(['activeTabs'], (res) => {
  if (res && res.activeTabs) {
    try {
      activeTabs = res.activeTabs || {};
      console.log('Background: activeTabs cargadas desde storage', Object.keys(activeTabs));
    } catch (e) {
      console.warn('Error parsing activeTabs from storage', e.message);
    }
  }
});

// Helper para enviar mensajes a una pestaña con retry si no existe listener
async function sendMessageToTab(tabId, message, tryInject = true) {
  try {
    return await new Promise(async (resolve) => {
      chrome.tabs.sendMessage(tabId, message, async (res) => {
        if (chrome.runtime.lastError) {
          console.warn('sendMessageToTab lastError:', chrome.runtime.lastError.message, 'msg:', message.type);
          if (!tryInject) return resolve({ success: false, error: chrome.runtime.lastError.message });

          // Intentar inyectar el content script y reintentar
          try {
            console.log('Intentando inyectar content script en tab', tabId);
            await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
          } catch (injErr) {
            console.error('Injection failed:', injErr && injErr.message ? injErr.message : injErr);
            return resolve({ success: false, error: injErr && injErr.message ? injErr.message : String(injErr) });
          }

          // pequeña espera y reintento
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, message, (res2) => {
              if (chrome.runtime.lastError) {
                console.error('sendMessageToTab retry failed:', chrome.runtime.lastError.message, 'msg:', message.type);
                return resolve({ success: false, error: chrome.runtime.lastError.message });
              }
              return resolve(res2);
            });
          }, 200);
        } else {
          return resolve(res);
        }
      });
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function setupOffscreenDocument(path) {
  // Verificar si ya existe un contexto offscreen
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [path]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Crear el documento si no existe
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['AUDIO_PLAYBACK', 'USER_MEDIA'],
      justification: 'Procesamiento de audio y ecualización en tiempo real',
    });
    
    try {
        await creating;
    } catch(err) {
        // Ignorar si ya existe (condición de carrera)
        if (!err.message.includes('Only a single offscreen document may be created')) {
            throw err;
        }
    }
    
    creating = null;
  }
}

// Limpiar activeTabs cuando una pestaña se cierra
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (activeTabs[tabId]) {
    delete activeTabs[tabId];
    try { chrome.storage.local.set({ activeTabs }); } catch (e) {}
    console.log('Background: activeTabs entry cleaned for closed tab', tabId);
  }
});

async function closeOffscreenDocument() {
    try {
        if (creating) {
            await creating;
        }
        await chrome.offscreen.closeDocument();
    } catch(err) {
        // Ignorar errores al cerrar
        console.log("Error cerrando offscreen (puede que no exista):", err.message);
    }
}

// ===== ESCUCHAR MENSAJES DEL POPUP =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Background recibió:", msg.type);

  if (msg.type === "ENABLE_EQ") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
          sendResponse({ success: false, error: "No active tab" });
          return;
        }
        // ... (rest of logic)
        if (activeTabs[tab.id] && activeTabs[tab.id].enabled) {
           console.log("⚠️ EQ already active for tab", tab.id);

           // CASE 1: Everything is perfect (offscreenPort alive)
           if (offscreenPort) {
             sendResponse({ success: true, alreadyActive: true });
             return;
           }

           // CASE 2: Service Worker Restarted (Lost port, but offscreen document might be alive)
           console.log("♻️ Service Worker restarted. Reconnecting to offscreen...");
           const existingContexts = await chrome.runtime.getContexts({
              contextTypes: ['OFFSCREEN_DOCUMENT'],
              documentUrls: ['offscreen.html']
           });

           if (existingContexts.length > 0) {
             try {
                offscreenPort = chrome.runtime.connect({ name: 'offscreen-port' });
                
                // Re-attach listeners
                offscreenPort.onMessage.addListener((m) => {
                  console.log('Background <- offscreen (reconnected):', m && m.type);
                });
                offscreenPort.onDisconnect.addListener(() => {
                  console.log('❌ Offscreen desconectado (reconnected)');
                  offscreenPort = null;
                });

                // Send PING or just assume it's working?
                // The offscreen keeps running, so audio should be flowing.
                sendResponse({ success: true, reconnected: true });
                
                // Notify widget to show itself
                sendMessageToTab(tab.id, { type: 'EQ_ENABLED' });
                return;
             } catch (e) {
                console.warn("Failed to reconnect:", e);
                // Fallthrough to recreate
             }
           }
        }

        // Setup Offscreen Document for audio processing
        await closeOffscreenDocument();
        await setupOffscreenDocument('offscreen.html');

        // Get Stream ID from tab
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
        console.log('✅ StreamId obtenido:', streamId);

        // 3. Enviar mensaje al offscreen
        try {
          // Esperar un breve momento para que el offscreen document esté listo
          await new Promise(r => setTimeout(r, 300));

          // Conectar con el offscreen para comunicación persistente
          if (offscreenPort) {
            try { offscreenPort.disconnect(); } catch(e) {}
          }
          offscreenPort = chrome.runtime.connect({ name: 'offscreen-port' });

          // Escuchar mensajes y desconexiones
          offscreenPort.onMessage.addListener((m) => {
            console.log('Background <- offscreen:', m && m.type);
          });

          offscreenPort.onDisconnect.addListener(() => {
            console.log('❌ Offscreen desconectado');
            offscreenPort = null;
          });

          // Enviar comando de inicio
          const startMsg = { type: 'START_AUDIO_CAPTURE', streamId: streamId, isPremium: isPremium };
          // Si hay mensajes pendientes, los enviamos primero para que el offscreen tenga el contexto
          if (pendingPortMessages.length > 0) {
            pendingPortMessages.forEach(pm => {
              try { offscreenPort.postMessage(pm); } catch (err) { console.warn('Flush msg failed', err); }
            });
            pendingPortMessages = [];
          }
          offscreenPort.postMessage(startMsg);

          // Esperar confirmación del offscreen (AUDIO_CAPTURE_STARTED)
          const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout - offscreen no respondió'));
            }, 5000);

            const listener = (msg) => {
              if (!msg || !msg.type) return;
              if (msg.type === 'AUDIO_CAPTURE_STARTED') {
                clearTimeout(timeout);
                offscreenPort.onMessage.removeListener(listener);
                resolve({ success: true, detail: msg });
              } else if (msg.type === 'AUDIO_CAPTURE_FAILED') {
                clearTimeout(timeout);
                offscreenPort.onMessage.removeListener(listener);
                resolve({ success: false, error: msg.error || 'Audio capture failed' });
              }
            };

            offscreenPort.onMessage.addListener(listener);
          });

          // Update state
          const savedVolume = (await chrome.storage.local.get('masterVolume')).masterVolume;
          // Normalized volume for audio processor (0.0 - 3.0)
          const normalizedVolume = savedVolume ? savedVolume / 100 : 1.0;

          activeTabs[tab.id] = { 
              enabled: true, 
              preset: 'flat', 
              isPremium: isPremium,
              masterVolume: normalizedVolume
          };
          try { chrome.storage.local.set({ activeTabs }); } catch (e) {}

          // Apply saved volume immediately
          if (normalizedVolume !== 1.0) {
              offscreenPort.postMessage({ type: 'SET_VOLUME', value: normalizedVolume });
          }

          console.log("✅ EQ Enabled for tab", tab.id, "Volume:", normalizedVolume);

          // Notify widget to show itself
          sendMessageToTab(tab.id, { type: 'EQ_ENABLED' });

          sendResponse(response);

        } catch (e) {
          console.error("❌ Error comunicando con offscreen:", e.message);
          sendResponse({ success: false, error: "Offscreen communication error: " + e.message });
        }

      } catch (err) {
        console.error("Error habilitando EQ:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Respuesta asíncrona
  }

  if (msg.type === "DISABLE_EQ") {
    (async () => {
      try {
        // Disable EQ for current active tab if it's a per-tab session (free or premium)
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id;

        // Stop per-tab processing if active (regardless of premium status)
        if (tabId && activeTabs[tabId] && activeTabs[tabId].enabled) {
          try {
            await sendMessageToTab(tabId, { type: 'STOP_TAB_EQ' });
            // Also tell widget to hide
            await sendMessageToTab(tabId, { type: 'EQ_DISABLED' });
          } catch (e) { console.warn('STOP_TAB_EQ send error', e && e.message); }
          delete activeTabs[tabId];
          // Persist changes
          try { chrome.storage.local.set({ activeTabs }); } catch (e) {}
          chrome.storage.local.set({ enabled: false });
          sendResponse({ success: true, method: 'tab' });
          return;
        }

        // Fallback: stop offscreen processing
        chrome.storage.local.set({ enabled: false });
        try {
          if (offscreenPort) {
            offscreenPort.postMessage({ type: 'STOP_AUDIO_CAPTURE' });
          } else {
            await chrome.runtime.sendMessage({ type: 'STOP_AUDIO_CAPTURE' });
          }
        } catch(e) {}

        // Close document to free resources and allow clean new capture later
        await closeOffscreenDocument();

        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "SET_BAND_GAIN") {
    if (offscreenPort) {
      offscreenPort.postMessage({ type: 'SET_GAIN', index: msg.bandIndex, value: msg.value });
    } else {
      pendingPortMessages.push({ type: 'SET_GAIN', index: msg.bandIndex, value: msg.value });
    }
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "SET_MASTER_VOLUME") {
    if (offscreenPort) {
      offscreenPort.postMessage({ type: 'SET_VOLUME', value: msg.value });
    } else {
      pendingPortMessages.push({ type: 'SET_VOLUME', value: msg.value });
    }
    
    // Persist volume
    (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && activeTabs[tab.id]) {
            activeTabs[tab.id].masterVolume = msg.value;
            chrome.storage.local.set({ activeTabs });
        }
        // Also update global preference
        chrome.storage.local.set({ masterVolume: Math.round(msg.value * 100) });
    })();

    sendResponse({ success: true });
    return true;
  }

  // Accept legacy/setter variants from popup
  if (msg.type === "SET_GAIN") {
    if (offscreenPort) {
      offscreenPort.postMessage({ type: 'SET_GAIN', index: msg.index, value: msg.value });
    } else {
      pendingPortMessages.push({ type: 'SET_GAIN', index: msg.index, value: msg.value });
    }
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "GET_ANALYSER_DATA") {
    if (!offscreenPort) {
      sendResponse({ success: false, data: [] });
      return true;
    }

    // Send request and wait for one-time ANALYSER_DATA response
    (async () => {
      try {
        const data = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting analyser')), 2000);
          const listener = (m) => {
            if (m && m.type === 'ANALYSER_DATA') {
              clearTimeout(timeout);
              offscreenPort.onMessage.removeListener(listener);
              resolve(m);
            }
          };
          offscreenPort.onMessage.addListener(listener);
          try {
            offscreenPort.postMessage({ type: 'GET_ANALYSER_DATA' });
          } catch (e) {
            clearTimeout(timeout);
            offscreenPort.onMessage.removeListener(listener);
            reject(e);
          }
        });

        sendResponse({ success: !!data.success, data: data.data || [] });
      } catch (err) {
        console.warn('Error getting analyser data:', err.message);
        sendResponse({ success: false, data: [] });
      }
    })();
    return true;
  }

  if (msg.type === 'SET_TAB_VOLUME') {
    // Attempt to set volume inside the target tab by injecting code that sets <audio>/<video> elements volume
    const tabId = msg.tabId;
    const vol = msg.volume;
    if (typeof tabId === 'number') {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (v) => {
          try {
            const els = Array.from(document.querySelectorAll('audio,video'));
            if (els.length === 0) return { ok: false, reason: 'no_elements' };
            els.forEach(e => { try { e.volume = v; } catch {} });
            return { ok: true };
          } catch (e) { return { ok: false, reason: e.message }; }
        },
        args: [vol]
      }).then(() => sendResponse({ success: true })).catch(err => { console.error('SET_TAB_VOLUME error:', err); sendResponse({ success: false, error: err.message }); });
      return true;
    }
    sendResponse({ success: false, error: 'missing tabId' });
    return true;
  }

  if (msg.type === 'APPLY_PRESET') {
    try {
      const gains = Array.isArray(msg.gains) ? msg.gains : [];
      
      // Update active tab state if possible
      (async () => {
         const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
         if (tab && activeTabs[tab.id]) {
            activeTabs[tab.id].gains = gains;
            activeTabs[tab.id].preset = msg.preset || 'custom';
            chrome.storage.local.set({ activeTabs });
         }
      })();

      // compute master compensation
      // const pos = gains.filter(g => typeof g === 'number' && g > 0);
      // const maxPos = pos.length ? Math.max(...pos) : 0;
      // let masterFactor = 1.0;
      // if (maxPos >= 15) masterFactor = 0.5;
      // else if (maxPos >= 10) masterFactor = 0.6;
      // else if (maxPos >= 6) masterFactor = 0.75;

      // Send to offscreen
      if (offscreenPort) {
        gains.forEach((g, i) => offscreenPort.postMessage({ type: 'SET_GAIN', index: i, value: g }));
        // offscreenPort.postMessage({ type: 'SET_VOLUME', value: masterFactor });
      } else {
        gains.forEach((g, i) => pendingPortMessages.push({ type: 'SET_GAIN', index: i, value: g }));
        // pendingPortMessages.push({ type: 'SET_VOLUME', value: masterFactor });
      }

      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }

  if (msg.type === "PING") {
    sendResponse({ pong: true });
    return true;
  }

  if (msg.type === "OPEN_LOGIN_PAGE") {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      const emailParam = (userInfo && userInfo.email) ? `?email=${encodeURIComponent(userInfo.email)}` : '';
      chrome.tabs.create({ url: `https://smart-audio-eq.pages.dev/${emailParam}` });
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.type === "OPEN_PREMIUM_PAGE") {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      const emailParam = (userInfo && userInfo.email) ? `?email=${encodeURIComponent(userInfo.email)}` : '';
      chrome.tabs.create({ url: `https://smart-audio-eq.pages.dev/premium${emailParam}` });
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.type === "GET_USER_INFO") {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      sendResponse({ email: userInfo ? userInfo.email : null });
    });
    return true;
  }

  if (msg.type === "SYNC_STATUS") {
    (async () => {
        try {
            // 1. Get current stored email
            const storage = await chrome.storage.local.get(['email', 'uid']);
            let email = storage.email;
            let uid = storage.uid;

            // 2. If no email, try identity
            if (!email) {
                const userInfo = await new Promise(resolve => 
                    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, resolve)
                );
                if (userInfo && userInfo.email) {
                    email = userInfo.email;
                    await chrome.storage.local.set({ email });
                }
            }

            // 3. If still no email, look for web tab
            if (!email) {
                const tabs = await chrome.tabs.query({});
                const webTab = tabs.find(t => t.url && t.url.includes("smart-audio-eq.pages.dev"));
                
                if (webTab) {
                    try {
                        const response = await new Promise((resolve) => {
                             chrome.tabs.sendMessage(webTab.id, { type: "PREGUNTAR_DATOS" }, resolve);
                        });
                        if (response && response.email) {
                            email = response.email;
                            uid = response.uid;
                            await chrome.storage.local.set({ 
                                email: response.email, 
                                uid: response.uid,
                                isPremium: response.isPremium
                            });
                            sendResponse({ success: true, message: "Synced with open web tab! ✅" });
                            return;
                        }
                    } catch (e) { console.warn("Web tab sync failed", e); }
                }
                
                sendResponse({ success: false, error: "Please login first to sync status." });
                return;
            }

            // 4. If we have email, check API
            const apiUrl = `https://smart-audio-eq-1.onrender.com/check-license?email=${encodeURIComponent(email)}&uid=${encodeURIComponent(uid || '')}`;
            const res = await fetch(apiUrl);
            if (!res.ok) {
                // Keep current isPremium status on network errors
                const current = await chrome.storage.local.get(['isPremium']);
                sendResponse({ success: true, message: current.isPremium ? "Premium (cached) 💎" : "Status: Free." });
                return;
            }
            const data = await res.json();

            // 5. Also check Official App Pass SDK as part of sync
            await performAutomaticAppPassCheck();

            // Refresh isPremium from storage in case App Pass check updated it
            const finalStorage = await chrome.storage.local.get(['isPremium']);
            const isNowPremium = (typeof data.premium === 'boolean' ? data.premium : finalStorage.isPremium) || !!finalStorage.isPremium;

            isPremium = isNowPremium; // Update global variable too
            await chrome.storage.local.set({ isPremium: isNowPremium });
            
            if (isNowPremium) {
                sendResponse({ success: true, message: "Premium status synced! 💎" });
            } else {
                sendResponse({ success: true, message: "Status: Free. If you bought Premium, please wait a minute." });
            }

        } catch (e) {
            sendResponse({ success: false, error: "Sync error: " + e.message });
        }
    })();
    return true; // Respuesta asíncrona
  }

  if (msg.type === "VERIFY_APP_PASS") {
    (async () => {
        try {
            const storage = await chrome.storage.local.get(['email', 'uid']);
            if (!storage.email || !storage.uid) {
                sendResponse({ success: false, error: "Please login first." });
                return;
            }

            const res = await fetch("https://smart-audio-eq-1.onrender.com/verify-app-pass", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: storage.email,
                    uid: storage.uid,
                    code: msg.code
                })
            });

            if (!res.ok) throw new Error("Server error");
            const data = await res.json();

            if (data.status === "success") {
                await chrome.storage.local.set({ isPremium: true });
                
                // Notify open web tabs about the new Premium status
                try {
                    const tabs = await chrome.tabs.query({ url: "*://smart-audio-eq.pages.dev/*" });
                    tabs.forEach(t => {
                        chrome.tabs.sendMessage(t.id, { type: "PREMIUM_ACTIVADO_EXT" });
                    });
                } catch (e) { console.log("Failed to notify web tabs", e); }

                sendResponse({ success: true, message: data.message });
            } else {
                sendResponse({ success: false, error: data.error || "Invalid code" });
            }
        } catch (e) {
            sendResponse({ success: false, error: e.message });
        }
    })();
    return true;
  }

  if (msg.type === "ACTIVATE_OFFICIAL_APP_PASS") {
    activateAppPass().then(res => sendResponse(res)).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === "MANAGE_OFFICIAL_APP_PASS") {
    manageAppPass().then(() => sendResponse({ success: true })).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === "GET_TAB_STATUS") {

    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          sendResponse({ enabled: false });
          return;
        }

        const tabId = tab.id;
        // Check if we have active state for this tab
        if (activeTabs[tabId] && activeTabs[tabId].enabled) {
          
          // If port is missing, try to reconnect silently
          if (!offscreenPort) {
             console.log("GET_TAB_STATUS: Active tab found but port missing. Attempting silent reconnect...");
             const existingContexts = await chrome.runtime.getContexts({
               contextTypes: ['OFFSCREEN_DOCUMENT'],
               documentUrls: ['offscreen.html']
             });

             if (existingContexts.length > 0) {
               try {
                 offscreenPort = chrome.runtime.connect({ name: 'offscreen-port' });
                 offscreenPort.onMessage.addListener((m) => {
                    console.log('Background <- offscreen (reconnected via status):', m && m.type);
                 });
                 offscreenPort.onDisconnect.addListener(() => {
                    console.log('❌ Offscreen desconectado (reconnected via status)');
                    offscreenPort = null;
                 });
                 console.log("✅ Silent reconnect successful!");
               } catch (e) {
                 console.warn("Silent reconnect failed:", e);
               }
             }
          }

          sendResponse({ 
            enabled: true, 
            preset: activeTabs[tabId].preset || 'flat',
            gains: activeTabs[tabId].gains,
            masterVolume: activeTabs[tabId].masterVolume
          });
        } else {
          sendResponse({ enabled: false });
        }
      } catch (e) {
        sendResponse({ enabled: false, error: e.message });
      }
    })();
    return true;
  }
  // ===== GESTIÓN DE USUARIOS / LOGIN =====
  if (msg.type === "LOGIN_EXITOSO") {
    isPremium = msg.isPremium; // Actualizar estado local
    chrome.storage.local.set({
      email: msg.email,
      uid: msg.uid,
      isPremium: msg.isPremium
    }, () => {
      console.log("Background: Usuario sincronizado, isPremium:", isPremium);
      sendResponse({ success: true });
    });
    return true;
  }
});

// ===== MENSAJES EXTERNOS (WEB) =====
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.type === "USER_SYNC" || message.type === "LOGIN_EXITOSO" || message.accion === "SYNC_USER") {
        const email = message.email || (message.user && message.user.email);
        const uid = message.uid || (message.user && message.user.uid);
        const webPremium = message.isPremium || (message.user && message.user.isPremium) || false;
        
        console.log("Background: Sync received from Web", { email, isPremium: webPremium });

        // Logic: Extension is Premium if Web says so OR if it already has an App Pass
        chrome.storage.local.get(['isPremium'], async (res) => {
            // Check App Pass again just to be sure
            const appPassStatus = await performAutomaticAppPassCheck();
            const finalPremiumStatus = webPremium || appPassStatus || false;

            chrome.storage.local.set({ 
                email: email || '', 
                uid: uid || '', 
                isPremium: finalPremiumStatus 
            });

            isPremium = finalPremiumStatus;
            sendResponse({ status: "OK", premium: isPremium });
        });
        return true; 
    }
});
