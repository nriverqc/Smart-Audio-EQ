// Service Worker con gestión de Offscreen Document
// Migrado para cumplir con Manifest V3 y evitar problemas de CSP/Autoplay

console.log("Equalizer – Web Audio: Background Service Worker iniciado");

async function notifyWebTabsOfPremium() {
    try {
        const tabs = await chrome.tabs.query({ url: "*://smart-audio-eq.pages.dev/*" });
        tabs.forEach(t => {
            chrome.tabs.sendMessage(t.id, { type: "PREMIUM_ACTIVADO_EXT" });
        });
    } catch (e) { console.log("Error notifying tabs", e); }
}

chrome.runtime.onStartup.addListener(() => {
    console.log("Background: Browser startup. Re-verifying status...");
    chrome.storage.local.get(['email', 'uid', 'isPremium'], (res) => {
        if (res.isPremium) isPremium = true;
        
        if (res.email && res.uid) {
            fetch(`https://smart-audio-eq-1.onrender.com/check-license?email=${encodeURIComponent(res.email)}&uid=${encodeURIComponent(res.uid)}`)
            .then(r => r.json())
            .then(data => {
                if (typeof data.premium === 'boolean') {
                    isPremium = data.premium;
                    chrome.storage.local.set({ 
                        isPremium: data.premium,
                        status: data.status || (data.premium ? 'active' : 'free'),
                        method: data.method || null,
                        trial_end: data.trial_end || null
                    });
                }
            }).catch(() => {});
        }
    });
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
        const tabId = msg.tabId || tab?.id;
        
        if (!tabId) {
          sendResponse({ success: false, error: "No tab found" });
          return;
        }

        if (activeTabs[tabId] && activeTabs[tabId].enabled) {
           console.log("⚠️ EQ already active for tab", tabId);

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
                sendMessageToTab(tabId, { type: 'EQ_ENABLED' });
                return;
             } catch (e) {
                console.warn("Failed to reconnect:", e);
                // Fallthrough to recreate
             }
           }
        }

        // Setup Offscreen Document for audio processing if not exists
        await setupOffscreenDocument('offscreen.html');

        // Get Stream ID from tab
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        console.log('✅ StreamId obtenido para tab:', tabId, streamId);

        // 3. Enviar mensaje al offscreen
        try {
          // Si no hay puerto, intentar conectar
          if (!offscreenPort) {
            offscreenPort = chrome.runtime.connect({ name: 'offscreen-port' });
            
            offscreenPort.onMessage.addListener((m) => {
              // console.log('Background <- offscreen:', m && m.type);
            });

            offscreenPort.onDisconnect.addListener(() => {
              console.log('❌ Offscreen desconectado');
              offscreenPort = null;
            });
            
            // Esperar un poco para que la conexión se estabilice
            await new Promise(r => setTimeout(r, 200));
          }

          // Enviar comando de inicio con tabId
          const startMsg = { 
            type: 'START_AUDIO_CAPTURE', 
            streamId: streamId, 
            isPremium: isPremium,
            tabId: tabId 
          };
          
          offscreenPort.postMessage(startMsg);

          // Esperar confirmación del offscreen (AUDIO_CAPTURE_STARTED)
          const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout - offscreen no respondió'));
            }, 5000);

            const listener = (msg) => {
              if (!msg || !msg.type || msg.tabId !== tabId) return;
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
          const storageRes = await chrome.storage.local.get('masterVolume');
          const savedVolume = storageRes.masterVolume;
          const normalizedVolume = savedVolume ? savedVolume / 100 : 1.0;

          activeTabs[tabId] = { 
              enabled: true, 
              preset: 'flat', 
              isPremium: isPremium,
              masterVolume: normalizedVolume,
              gains: isPremium ? new Array(15).fill(0) : new Array(6).fill(0)
          };
          await chrome.storage.local.set({ activeTabs });

          // Apply saved volume immediately for this tab
          offscreenPort.postMessage({ type: 'SET_VOLUME', value: normalizedVolume, tabId: tabId });

          console.log("✅ EQ Enabled for tab", tabId, "Volume:", normalizedVolume);

          // Notify widget to show itself
          sendMessageToTab(tabId, { type: 'EQ_ENABLED' });

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
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = msg.tabId || tab?.id;

        if (tabId && activeTabs[tabId]) {
          // Send STOP to offscreen and WAIT for it to stop tracks
          if (offscreenPort) {
            offscreenPort.postMessage({ type: 'STOP_AUDIO_CAPTURE', tabId: tabId });
            
            // Wait for confirmation to ensure tracks are released
            await new Promise((resolve) => {
                const timeout = setTimeout(resolve, 2000);
                const listener = (m) => {
                    if (m && m.type === 'AUDIO_CAPTURE_STOPPED' && m.tabId === tabId) {
                        clearTimeout(timeout);
                        offscreenPort.onMessage.removeListener(listener);
                        resolve();
                    }
                };
                offscreenPort.onMessage.addListener(listener);
            });
          }
          
          try {
            await sendMessageToTab(tabId, { type: 'STOP_TAB_EQ' });
            await sendMessageToTab(tabId, { type: 'EQ_DISABLED' });
          } catch (e) {}

          delete activeTabs[tabId];
          await chrome.storage.local.set({ activeTabs });

          console.log(`✅ EQ disabled and tracks released for tab ${tabId}`);
          sendResponse({ success: true });
          return;
        }
        sendResponse({ success: false, error: "Tab not active" });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "SET_BAND_GAIN") {
    (async () => {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetTabId = msg.tabId || activeTab?.id;
        
        if (!targetTabId || !offscreenPort) {
            sendResponse({ success: false });
            return;
        }

        const isPrem = activeTabs[targetTabId]?.isPremium || false;

        if (isPrem) {
            // Per-tab independent for premium
            offscreenPort.postMessage({ type: 'SET_GAIN', index: msg.bandIndex, value: msg.value, tabId: targetTabId });
            if (activeTabs[targetTabId]) {
                if (!activeTabs[targetTabId].gains) activeTabs[targetTabId].gains = [];
                activeTabs[targetTabId].gains[msg.bandIndex] = msg.value;
            }
        } else {
            // Global for free users
            const allTabIds = Object.keys(activeTabs);
            allTabIds.forEach(tId => {
                offscreenPort.postMessage({ type: 'SET_GAIN', index: msg.bandIndex, value: msg.value, tabId: parseInt(tId) });
                if (activeTabs[tId]) {
                    if (!activeTabs[tId].gains) activeTabs[tId].gains = [];
                    activeTabs[tId].gains[msg.bandIndex] = msg.value;
                }
            });
        }
        await chrome.storage.local.set({ activeTabs });
        sendResponse({ success: true });
    })();
    return true;
  }

  if (msg.type === "SET_MASTER_VOLUME") {
    (async () => {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetTabId = msg.tabId || activeTab?.id;

        if (!targetTabId || !offscreenPort) {
            sendResponse({ success: false });
            return;
        }

        const isPrem = activeTabs[targetTabId]?.isPremium || false;

        if (isPrem) {
            // Per-tab independent for premium
            offscreenPort.postMessage({ type: 'SET_VOLUME', value: msg.value, tabId: targetTabId });
            if (activeTabs[targetTabId]) {
                activeTabs[targetTabId].masterVolume = msg.value;
            }
        } else {
            // Global for free users
            const allTabIds = Object.keys(activeTabs);
            allTabIds.forEach(tId => {
                offscreenPort.postMessage({ type: 'SET_VOLUME', value: msg.value, tabId: parseInt(tId) });
                if (activeTabs[tId]) {
                    activeTabs[tId].masterVolume = msg.value;
                }
            });
        }
        
        // Also update global preference
        chrome.storage.local.set({ activeTabs, masterVolume: Math.round(msg.value * 100) });
        sendResponse({ success: true });
    })();
    return true;
  }

  if (msg.type === "SET_GAIN") {
    (async () => {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetTabId = msg.tabId || activeTab?.id;

        if (!targetTabId || !offscreenPort) {
            sendResponse({ success: false });
            return;
        }

        const isPrem = activeTabs[targetTabId]?.isPremium || false;

        if (isPrem) {
            // Per-tab independent for premium
            offscreenPort.postMessage({ type: 'SET_GAIN', index: msg.index, value: msg.value, tabId: targetTabId });
            if (activeTabs[targetTabId]) {
                if (!activeTabs[targetTabId].gains) activeTabs[targetTabId].gains = [];
                activeTabs[targetTabId].gains[msg.index] = msg.value;
            }
        } else {
            // Global for free users
            const allTabIds = Object.keys(activeTabs);
            allTabIds.forEach(tId => {
                offscreenPort.postMessage({ type: 'SET_GAIN', index: msg.index, value: msg.value, tabId: parseInt(tId) });
                if (activeTabs[tId]) {
                    if (!activeTabs[tId].gains) activeTabs[tId].gains = [];
                    activeTabs[tId].gains[msg.index] = msg.value;
                }
            });
        }
        await chrome.storage.local.set({ activeTabs });
        sendResponse({ success: true });
    })();
    return true;
  }

  if (msg.type === "GET_ANALYSER_DATA") {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetTabId = msg.tabId || activeTab?.id;

        if (!targetTabId || !offscreenPort || !activeTabs[targetTabId]) {
          sendResponse({ success: false, data: [] });
          return;
        }

        const data = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => resolve({ success: false }), 1000);
          const listener = (m) => {
            if (m && m.type === 'ANALYSER_DATA' && m.tabId === targetTabId) {
              clearTimeout(timeout);
              offscreenPort.onMessage.removeListener(listener);
              resolve(m);
            }
          };
          offscreenPort.onMessage.addListener(listener);
          offscreenPort.postMessage({ type: 'GET_ANALYSER_DATA', tabId: targetTabId });
        });

        sendResponse({ success: !!data.success, data: data.data || [] });
      } catch (err) {
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
    (async () => {
      try {
        const gains = Array.isArray(msg.gains) ? msg.gains : [];
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetTabId = msg.tabId || activeTab?.id;
        
        if (targetTabId && activeTabs[targetTabId]) {
          const isPrem = activeTabs[targetTabId].isPremium || false;

          if (isPrem) {
            // Per-tab independent for premium
            activeTabs[targetTabId].gains = gains;
            activeTabs[targetTabId].preset = msg.preset || 'custom';
            if (offscreenPort) {
              gains.forEach((g, i) => {
                offscreenPort.postMessage({ type: 'SET_GAIN', index: i, value: g, tabId: targetTabId });
              });
            }
          } else {
            // Global for free users
            const allTabIds = Object.keys(activeTabs);
            allTabIds.forEach(tId => {
                activeTabs[tId].gains = gains;
                activeTabs[tId].preset = msg.preset || 'custom';
                if (offscreenPort) {
                    gains.forEach((g, i) => {
                        offscreenPort.postMessage({ type: 'SET_GAIN', index: i, value: g, tabId: parseInt(tId) });
                    });
                }
            });
          }
          await chrome.storage.local.set({ activeTabs });
        }
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
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

            // 5. Cleanup old variables if present
            const finalStorage = await chrome.storage.local.get(['isPremium', 'status', 'trial_end', 'method']);
            
            // IMPORTANT: If API says Premium, we enforce it
            const isNowPremium = (typeof data.premium === 'boolean' && data.premium === true);

            isPremium = isNowPremium; // Update global variable too
            const newStatus = data.status || (isNowPremium ? 'active' : 'free');
            const finalMethod = data.method || 'Unknown';
            
            await chrome.storage.local.set({ 
                isPremium: isNowPremium, 
                status: newStatus,
                method: finalMethod,
                trial_end: data.trial_end || null
            });
            
            // Notify web tabs to update their UI as well (Bidirectional Sync)
            if (isNowPremium) {
                notifyWebTabsOfPremium();
            } else {
                // If we are free, also tell web (in case it thinks we are premium)
                try {
                    const tabs = await chrome.tabs.query({ url: "*://smart-audio-eq.pages.dev/*" });
                    tabs.forEach(t => {
                        chrome.tabs.sendMessage(t.id, { type: "SYNC_STATUS_FROM_EXT", isPremium: false });
                    });
                } catch (e) {}
            }
            
            if (isNowPremium) {
                const statusMsg = newStatus === 'trialing' ? "Trial activo 🎁" : "Premium activo 💎";
                const methodMsg = `Metodo: ${finalMethod}`;
                sendResponse({ 
                    success: true, 
                    message: `Sincronización completa: ${statusMsg}`, 
                    detail: `Plan: ${finalMethod}`
                });
            } else {
                sendResponse({ 
                    success: true, 
                    message: "Estado: Gratis.",
                    detail: "Si compraste Premium, espera un minuto o verifica tu pago."
                });
            }

        } catch (e) {
            sendResponse({ success: false, error: "Sync error: " + e.message });
        }
    })();
    return true; // Respuesta asíncrona
  }

  if (msg.type === "GET_TAB_STATUS") {

    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = msg.tabId || tab?.id;
        
        if (!tabId) {
          sendResponse({ enabled: false });
          return;
        }

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
  if (msg.type === "LOGIN_EXITOSO" || msg.type === "USER_SYNC") {
    isPremium = msg.isPremium; // Actualizar estado local
    chrome.storage.local.set({
      email: msg.email,
      uid: msg.uid,
      isPremium: msg.isPremium,
      status: msg.status || (msg.isPremium ? 'active' : 'free'),
      trial_end: msg.trial_end || null
    }, () => {
      console.log("Background: Usuario sincronizado, isPremium:", isPremium);
      // Notificar a todos los componentes de la extensión (popup, etc)
      chrome.runtime.sendMessage(msg);
      sendResponse({ success: true });
    });
    return true;
  }
});

// ===== MENSAJES EXTERNOS (WEB) =====
// Esta función permite que la web hable DIRECTAMENTE con la extensión
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    console.log("Background: Mensaje externo recibido de", sender.url, message.type);
    
    if (message.type === "USER_SYNC" || message.type === "LOGIN_EXITOSO") {
        const email = message.email || (message.user && message.user.email);
        const uid = message.uid || (message.user && message.user.uid);
        const webPremium = message.isPremium || (message.user && message.user.isPremium) || false;
        const status = message.status || (message.user && message.user.status) || (webPremium ? 'active' : 'free');
        const trial_end = message.trial_end || (message.user && message.user.trial_end) || null;
        
        chrome.storage.local.set({ 
            email: email || '', 
            uid: uid || '', 
            isPremium: webPremium,
            status: status,
            trial_end: trial_end
        }, () => {
            isPremium = webPremium;
            // Notificar al popup si está abierto
            chrome.runtime.sendMessage({
                type: "LOGIN_EXITOSO",
                email,
                uid,
                isPremium: webPremium,
                status: status,
                trial_end: trial_end
            });
            sendResponse({ status: "OK", premium: isPremium });
        });
        return true; 
    }
    
    if (message.type === "GET_SESSION") {
        chrome.storage.local.get(['email', 'uid', 'isPremium'], (res) => {
            sendResponse(res);
        });
        return true;
    }
});
