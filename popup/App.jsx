import React, { useState, useEffect } from 'react';
import Equalizer from './Equalizer';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import { PRESETS, IS_PREMIUM_PRESET } from './presets';
import logo from './Logo ecualizador 2.png';
import PremiumModal from './PremiumModal';
import ActionModal from './ActionModal';

export default function App() {
  const [enabled, setEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [status, setStatus] = useState('free');
  const [trialEndDate, setTrialEndDate] = useState(null);
  const [countdown, setCountdown] = useState("");

  const getTrialEndMs = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      const s = value.includes('T') ? value : value.replace(' ', 'T');
      const d = new Date(s);
      const ms = d.getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof value === 'number') return value;
    if (value && typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
    const d = new Date(value);
    const ms = d.getTime();
    return Number.isNaN(ms) ? null : ms;
  };

  useEffect(() => {
    let timer;
    if (trialEndDate) {
        const updateCountdown = () => {
            const endMs = getTrialEndMs(trialEndDate);
            if (!endMs) {
                setCountdown("");
                return;
            }

            const diff = endMs - Date.now();
            
            if (diff <= 0) {
                setStatus('expired_trial');
                setIsPremium(false);
                chrome.storage.local.set({ isPremium: false, status: 'expired_trial' });
                setCountdown("");
            } else {
                setStatus('trialing');
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                
                if (days > 0) {
                    setCountdown(`${days}d ${hours}h ${minutes}m`);
                } else {
                    setCountdown(`${hours}h ${minutes}m ${seconds}s`);
                }
            }
        };

        updateCountdown();
        timer = setInterval(updateCountdown, 1000);
    }
    return () => clearInterval(timer);
  }, [status, trialEndDate]);
  const [currentPreset, setCurrentPreset] = useState('flat');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [tabTitle, setTabTitle] = useState('');
  const [allActiveTabs, setAllActiveTabs] = useState({});
  const [targetTabId, setTargetTabId] = useState(null);
  const [activeTabList, setActiveTabList] = useState([]);
  const [lang, setLang] = useState('en');
  const [currentTabId, setCurrentTabId] = useState(null);

  // MODAL STATE
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // SYNC MODAL STATE
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState('');
  const [statusModalMessage, setStatusModalMessage] = useState('');
  const [statusModalIcon, setStatusModalIcon] = useState('');

  // GUIDE MODAL STATE (Power ON)
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  const openPremiumModal = (message) => {
    setModalMessage(message);
    setIsModalOpen(true);
  };

  const closePremiumModal = () => setIsModalOpen(false);

  const openSyncModal = () => setIsSyncModalOpen(true);
  const closeSyncModal = () => setIsSyncModalOpen(false);

  const openStatusModal = ({ title, message, icon }) => {
    setStatusModalTitle(title || '');
    setStatusModalMessage(message || '');
    setStatusModalIcon(icon || '');
    setIsStatusModalOpen(true);
  };
  const closeStatusModal = () => setIsStatusModalOpen(false);

  const openGuideModal = () => setIsGuideModalOpen(true);
  const closeGuideModal = () => setIsGuideModalOpen(false);

  const isActiveTabSelected = targetTabId === currentTabId;

  const langLabels = {
    es: { label: 'Español', flag: '../flags/es.svg' },
    en: { label: 'English', flag: '../flags/en.svg' },
    pt: { label: 'Português', flag: '../flags/pt.svg' },
    de: { label: 'Deutsch', flag: '../flags/de.svg' }
  };

  const [showLangMenu, setShowLangMenu] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLangMenu && !event.target.closest('.lang-switcher-container')) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLangMenu]);

  const extensionTexts = {
    es: {
      visitWebsite: 'Visitar sitio web',
      extName: 'Equalizer - Web Audio EQ',
      premiumBadge: 'PRO',
      premiumStatus: '• PREMIUM 💎',
      freeStatus: '• Gratis',
      syncStatus: 'Sincronizar estado',
      signInText: 'Inicia sesión en la web para sincronizar:',
      loginSync: 'Iniciar Sesión',
      power: 'Encendido',
      getPremium: 'Desbloquear mejor sonido 🔊',
      premiumPitch: 'Aumenta volumen, más control y presets ilimitados',
      viewAdvancedWeb: 'Ver panel avanzado en la web 🌐',
      premiumPresetWarning: 'Disponible en Premium – Mejora tu audio en segundos',
      savePresetWarning: '¡Guarda tus propios presets con Premium!',
      volumeLimitWarning: '¡Pruébalo! Con Premium puedes subir hasta el 300%.',
      syncLoginTitle: 'Sincronización requerida',
      syncLoginMsg: 'Debes iniciar sesión para sincronizar tus ajustes y estado Premium.',
      syncLoginConfirm: 'Ir a la web para iniciar sesión',
      syncLoginCancel: 'Seguir en la extensión',
      powerOnGuideTitle: 'Ecualizador Apagado',
      powerOnGuideMsg: 'Por favor, enciende el ecualizador usando el botón de encendido (ON) para empezar a mejorar tu sonido.',
      powerOnGuideConfirm: '¡Entendido!',
      trialDaysLeft: (cd) => `Tiempo de prueba: ${cd}`,
      trialEnded: 'Tu prueba terminó',
      activateSubscription: 'Activa tu suscripción',
      getFreeTrial: 'Obtener 3 Días GRATIS 🎁',
      trialBadge: 'TRIAL',
    },
    en: {
      visitWebsite: 'Visit Website',
      extName: 'Equalizer - Web Audio EQ',
      premiumBadge: 'PRO',
      premiumStatus: '• PREMIUM 💎',
      freeStatus: '• Free',
      syncStatus: 'Sync Status',
      signInText: 'Sign in on our website to sync:',
      loginSync: 'Login / Sync',
      power: 'Power',
      getPremium: 'Unlock better sound 🔊',
      premiumPitch: 'Boost volume, more control and unlimited presets',
      viewAdvancedWeb: 'View advanced panel on web 🌐',
      premiumPresetWarning: 'Available in Premium – Improve your audio in seconds',
      savePresetWarning: 'Save your own presets with Premium!',
      volumeLimitWarning: 'Try it! With Premium you can go up to 300%.',
      syncLoginTitle: 'Sync Required',
      syncLoginMsg: 'You must log in to sync your settings and Premium status.',
      syncLoginConfirm: 'Go to website to login',
      syncLoginCancel: 'Stay in extension',
      powerOnGuideTitle: 'Equalizer is OFF',
      powerOnGuideMsg: 'Please turn ON the equalizer using the power button to start improving your sound.',
      powerOnGuideConfirm: 'Got it!',
      trialDaysLeft: (cd) => `Trial time: ${cd}`,
      trialEnded: 'Your trial ended',
      activateSubscription: 'Activate subscription',
      getFreeTrial: 'Get 3 Days FREE 🎁',
      trialBadge: 'TRIAL',
    },
    pt: {
      visitWebsite: 'Visite o site',
      extName: 'Equalizer - Web Audio EQ',
      premiumBadge: 'PRO',
      premiumStatus: '• PREMIUM 💎',
      freeStatus: '• Grátis',
      syncStatus: 'Status de sincronização',
      signInText: 'Faça login no site para sincronizar:',
      loginSync: 'Entrar / Sincronizar',
      power: 'Energia',
      getPremium: 'Desbloquear som melhor 🔊',
      premiumPitch: 'Aumente o volume, mais controle e presets ilimitados',
      viewAdvancedWeb: 'Ver painel avançado na web 🌐',
      premiumPresetWarning: 'Disponível no Premium – Melhore seu áudio em segundos',
      savePresetWarning: 'Salve seus propios presets com o Premium!',
      volumeLimitWarning: 'Tente! Com o Premium você pode subir até 300%.',
      syncLoginTitle: 'Sincronização Necessária',
      syncLoginMsg: 'Você deve fazer o login para sincronizar suas configurações e status Premium.',
      syncLoginConfirm: 'Ir para o site para fazer login',
      syncLoginCancel: 'Ficar na extensão',
      powerOnGuideTitle: 'Equalizador Desligado',
      powerOnGuideMsg: 'Por favor, ligue o equalizador usando o botão de energia (ON) para começar a melhorar o seu som.',
      powerOnGuideConfirm: 'Entendi!',
      trialDaysLeft: (cd) => `Tempo de teste: ${cd}`,
      trialEnded: 'Seu teste terminou',
      activateSubscription: 'Ative sua assinatura',
      getFreeTrial: 'Obter Teste Grátis 🎁',
      trialBadge: 'TESTE',
    },
    de: {
      visitWebsite: 'Website besuchen',
      extName: 'Equalizer - Web Audio EQ',
      premiumBadge: 'PRO',
      premiumStatus: '• PREMIUM 💎',
      freeStatus: '• Kostenlos',
      syncStatus: 'Sync-Status',
      signInText: 'Anmelden zum Synchronisieren:',
      loginSync: 'Anmelden / Sync',
      power: 'Strom',
      getPremium: 'Besseren Sound freischalten 🔊',
      premiumPitch: 'Lautstärke erhöhen, mehr Kontrolle und unbegrenzte Presets',
      viewAdvancedWeb: 'Erweitertes Web-Panel anzeigen 🌐',
      premiumPresetWarning: 'Verfügbar in Premium – Verbessern Sie Ihren Sound in Sekunden',
      savePresetWarning: 'Speichern Sie Ihre eigenen Presets mit Premium!',
      volumeLimitWarning: 'Probieren Sie es aus! Mit Premium können Sie bis zu 300% gehen.',
      syncLoginTitle: 'Synchronisierung Erforderlich',
      syncLoginMsg: 'Sie müssen sich anmelden, um Ihre Einstellungen und den Premium-Status zu synchronisieren.',
      syncLoginConfirm: 'Zur Website gehen und anmelden',
      syncLoginCancel: 'In der Erweiterung bleiben',
      powerOnGuideTitle: 'Equalizer ist AUS',
      powerOnGuideMsg: 'Bitte schalten Sie den Equalizer mit dem Power-Button EIN, um Ihren Sound zu verbessern.',
      powerOnGuideConfirm: 'Verstanden!',
      trialDaysLeft: (cd) => `Testzeit: ${cd}`,
      trialEnded: 'Testzeitraum abgelaufen',
      activateSubscription: 'Abonnement aktivieren',
      getFreeTrial: 'Kostenlose Testversion 🎁',
      trialBadge: 'TEST',
    }
  };

  const t = (key) => {
    return extensionTexts[lang][key] || extensionTexts['en'][key];
  };

  useEffect(() => {
    // Detect language
    const uiLang = chrome.i18n.getUILanguage().split('-')[0];
    if (langLabels[uiLang]) {
      setLang(uiLang);
    } else {
      setLang('en');
    }

    // Check state from storage and active tab status
    const checkState = () => {
        // Get current tab info
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab) {
                setTabTitle(tab.title);
                setCurrentTabId(tab.id);
                if (!targetTabId) setTargetTabId(tab.id);
            }
        });

        // Get ALL tabs to show titles in the switcher
        chrome.tabs.query({}, (tabs) => {
            setActiveTabList(tabs);
        });

        // 1. Get global settings
        chrome.storage.local.get(['isPremium', 'email', 'uid', 'activeTabs', 'status', 'trial_end'], (result) => {
            if (result.isPremium) setIsPremium(true);
            if (result.email) setUserEmail(result.email);
            if (result.status) setStatus(result.status);
            if (result.trial_end) setTrialEndDate(result.trial_end);
            if (result.activeTabs) {
                setAllActiveTabs(result.activeTabs);
            }
        });

        // 2. Ask background for TAB SPECIFIC status
        chrome.runtime.sendMessage({ type: 'GET_TAB_STATUS', tabId: targetTabId || currentTabId }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("Could not get tab status:", chrome.runtime.lastError.message);
                return;
            }
            
            if (response && response.enabled) {
                console.log("✅ Tab is already active. Syncing UI...", response);
                setEnabled(true);
                if (response.preset) setCurrentPreset(response.preset);
                if (response.gains) {
                    chrome.storage.local.set({ customGains: response.gains });
                    if (response.preset === 'custom') {
                        setCurrentPreset('custom');
                    }
                }
            } else {
                console.log("Tab is not active.");
                setEnabled(false);
            }
        });
    };

    checkState();

    // REQUEST SESSION FROM WEB ON OPEN (Instant sync)
    // We send a message to the content script of the active tab if it's our website
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes("smart-audio-eq.pages.dev")) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "PREGUNTAR_DATOS" }, (response) => {
                if (chrome.runtime.lastError) return;
                if (response && response.email) {
                    console.log("Popup: Instant sync from current tab", response);
                    setIsPremium(response.isPremium);
                    setUserEmail(response.email);
                    if (response.status) setStatus(response.status);
                    if (response.trial_end) setTrialEndDate(response.trial_end);
                }
            });
        }
    });

    // Listen for storage changes (e.g. from background.js update)
    const handleStorageChange = (changes, area) => {
        if (area === 'local') {
            if (changes.isPremium) setIsPremium(changes.isPremium.newValue);
            if (changes.email) setUserEmail(changes.email.newValue);
            if (changes.activeTabs) setAllActiveTabs(changes.activeTabs.newValue || {});
            
            // Sync current tab state if target tab data changed
            if (changes.activeTabs && targetTabId) {
                const newTabs = changes.activeTabs.newValue || {};
                if (newTabs[targetTabId]) {
                    setEnabled(true);
                    if (newTabs[targetTabId].preset) setCurrentPreset(newTabs[targetTabId].preset);
                } else {
                    setEnabled(false);
                }
            }
        }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const handleLogin = () => {
      // Open the web page to login via background script
      chrome.runtime.sendMessage({ type: 'OPEN_LOGIN_PAGE' });
  };

  const openMainPage = () => {
      chrome.tabs.create({ url: 'https://smart-audio-eq.pages.dev/' });
  };


  // Sync state when targetTabId or allActiveTabs change
  useEffect(() => {
    if (targetTabId && allActiveTabs[targetTabId]) {
      const tabData = allActiveTabs[targetTabId];
      setEnabled(true);
      if (tabData.preset) setCurrentPreset(tabData.preset);
    } else if (targetTabId) {
      // Tab is not active in background, UI should be OFF
      setEnabled(false);
      setCurrentPreset('flat');
    }
  }, [targetTabId]); // Only trigger on tab switch to avoid recursion

  useEffect(() => {
    // Escuchar mensajes del background (como reconexión)
    const listener = (msg) => {
        if (msg.type === "EQ_ENABLED") {
            setEnabled(true);
        }
        if (msg.type === "EQ_DISABLED") {
            setEnabled(false);
        }
        // Sync with web login
        if (msg.type === "LOGIN_EXITOSO" || msg.type === "USER_SYNC") {
            console.log("Popup: Login sync received", msg);
            setUserEmail(msg.email);
            setIsPremium(msg.isPremium);
            if (msg.status) setStatus(msg.status);
            if (msg.trial_end) setTrialEndDate(msg.trial_end);
        }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const toggleEq = async () => {
    const newState = !enabled;
    
    // REMOVED: Auto-redirecting free users (Bad UX/Spam)
    
    setEnabled(newState);
    
    if (newState) {
      chrome.runtime.sendMessage({ type: 'ENABLE_EQ', tabId: targetTabId }, (response) => {
          if (response && !response.success) {
              console.error(response.error);
              setEnabled(false); // Revert if failed
              alert("Failed to enable EQ: " + response.error);
          }
      });
    } else {
      chrome.runtime.sendMessage({ type: 'DISABLE_EQ', tabId: targetTabId });
    }
  };

  const handleGoPremium = () => {
    // Open the REAL premium page via background
    chrome.runtime.sendMessage({ type: 'OPEN_PREMIUM_PAGE' });
  };

  const handleStartTrial = () => {
    // Redirigir a la página web de Premium con el plan mensual seleccionado (que tiene el trial)
    chrome.tabs.create({ url: 'https://smart-audio-eq.pages.dev/premium?plan=monthly' });
  };

  const handleSubscribeMonthly = () => {
    chrome.tabs.create({ url: 'https://smart-audio-eq.pages.dev/premium?plan=monthly' });
  };

  const handlePresetChange = (e) => {
    const presetKey = e.target.value;
    
    if (IS_PREMIUM_PRESET(presetKey) && !isPremium) {
        openPremiumModal(t("premiumPresetWarning"));
        return;
    }
    
    if (presetKey === 'custom' && !isPremium) {
        openPremiumModal(t("savePresetWarning"));
        return;
    }

    setCurrentPreset(presetKey);
    // Persist immediately in the activeTabs structure
    if (targetTabId && allActiveTabs[targetTabId]) {
        const gains = presetKey === 'custom' 
            ? (allActiveTabs[targetTabId].gains || new Array(isPremium ? 15 : 6).fill(0))
            : PRESETS[presetKey];

        const updatedTabs = { ...allActiveTabs };
        updatedTabs[targetTabId] = {
            ...updatedTabs[targetTabId], // Preserves masterVolume and other fields
            preset: presetKey,
            gains: gains
        };
        setAllActiveTabs(updatedTabs);
        chrome.storage.local.set({ activeTabs: updatedTabs });
    }

    if (presetKey === 'custom') {
        // Retrieve stored custom gains and apply them
        chrome.storage.local.get(['customGains'], (result) => {
            const savedGains = result.customGains || new Array(isPremium ? 15 : 6).fill(0);
            chrome.runtime.sendMessage({ type: 'APPLY_PRESET', preset: 'custom', gains: savedGains, tabId: targetTabId });
        });
    } else {
        const gains = PRESETS[presetKey];
        if (gains) {
            // Apply preset in one message so background can route to per-tab or offscreen
            chrome.runtime.sendMessage({ type: 'APPLY_PRESET', preset: presetKey, gains, tabId: targetTabId });
        }
    }
  };

  const onUserAdjust = (newGains) => {
    if (!isPremium) {
      // We let them move it but maybe alert once or just keep the preset logic
      // Actually, let's allow them to move but not "Save" or persistent?
      // The user said "Guardar presets -> SOLO premium".
    }
    if (currentPreset !== 'custom') {
      if (!isPremium) {
        alert(t("savePresetWarning"));
        return;
      }
      setCurrentPreset('custom');
    }
    
    // Persist in activeTabs for the specific tab
    if (targetTabId && allActiveTabs[targetTabId]) {
        const updatedTabs = { ...allActiveTabs };
        updatedTabs[targetTabId] = {
            ...updatedTabs[targetTabId],
            gains: newGains,
            preset: 'custom'
        };
        setAllActiveTabs(updatedTabs);
        chrome.storage.local.set({ activeTabs: updatedTabs });
    }
    
    // Fallback for global customGains if needed (free users)
    chrome.storage.local.set({ customGains: newGains });
  };

  const formatRemaining = (trialEnd) => {
    let end;
    if (!trialEnd) return '';
    if (typeof trialEnd === 'string') {
      const s = trialEnd.includes('T') ? trialEnd : trialEnd.replace(' ', 'T');
      end = new Date(s);
    } else if (typeof trialEnd === 'number') {
      end = new Date(trialEnd);
    } else if (trialEnd && typeof trialEnd === 'object' && typeof trialEnd.seconds === 'number') {
      end = new Date(trialEnd.seconds * 1000);
    } else {
      end = new Date(trialEnd);
    }
    const ms = end.getTime();
    if (Number.isNaN(ms)) return '';
    const diff = ms - Date.now();
    if (diff <= 0) return '0s';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const refreshStatus = async () => {
    if (!userEmail) {
        openSyncModal();
        return;
    }
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'SYNC_STATUS' }, (response) => {
        setLoading(false);
        if (response && response.success) {
            // Check if status changed and update local UI
            chrome.storage.local.get(['isPremium', 'email', 'status', 'trial_end', 'method'], (res) => {
                if (res.isPremium !== undefined) setIsPremium(res.isPremium);
                if (res.email) setUserEmail(res.email);
                if (res.status) setStatus(res.status);
                if (res.trial_end) setTrialEndDate(res.trial_end);

                const remaining = res.status === 'trialing' ? formatRemaining(res.trial_end) : '';
                const title = res.status === 'trialing'
                  ? (lang === 'es' ? 'Trial activo 🎁' : 'Trial active 🎁')
                  : (res.isPremium ? (lang === 'es' ? 'Premium activo 💎' : 'Premium active 💎') : (lang === 'es' ? 'Estado: Gratis' : 'Status: Free'));
                const lines = [];
                if (res.status === 'trialing' && remaining) lines.push((lang === 'es' ? `Tiempo restante: ${remaining}` : `Time left: ${remaining}`));
                if (res.method) lines.push((lang === 'es' ? `Método: ${res.method}` : `Method: ${res.method}`));
                if (!res.isPremium) lines.push(lang === 'es' ? 'Si ya pagaste, espera un minuto y vuelve a sincronizar.' : 'If you already paid, wait a minute and sync again.');
                openStatusModal({
                  title,
                  icon: res.status === 'trialing' ? '🎁' : (res.isPremium ? '💎' : 'ℹ️'),
                  message: lines.join('\n') || (response.detail ? `${response.message}\n${response.detail}` : response.message)
                });
            });
        } else {
            if (response && response.error && response.error.includes("login")) {
                 openSyncModal();
            } else {
                 openStatusModal({
                   title: lang === 'es' ? 'Error al sincronizar' : 'Sync error',
                   icon: '⚠️',
                   message: response ? response.error : (lang === 'es' ? 'Falló la sincronización.' : 'Sync failed.')
                 });
            }
        }
    });
  };

  const trialEndMs = getTrialEndMs(trialEndDate);
  const isTrialActive = !!trialEndMs && trialEndMs > Date.now();

  return (
    <div>
      {/* HEADER: Title, Premium Button, Visit Web */}
      <div className="controls" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
        
        {/* Top Row: Title + Visit Web Icon + Lang */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{t("extName")}</h3>
                <span className="beta-badge" style={{fontSize: '0.6em', verticalAlign: 'middle'}}>BETA</span>
                {isPremium && <span className="premium-badge">{t("premiumBadge")}</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Redesigned Visit Web Button */}
                <button 
                    onClick={openMainPage} 
                    style={{ 
                        background: '#333', 
                        border: '1px solid #555', 
                        color: '#00d2ff', 
                        borderRadius: '6px', 
                        padding: '6px 10px', 
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#00d2ff';
                        e.currentTarget.style.background = '#3a3a3a';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#555';
                        e.currentTarget.style.background = '#333';
                    }}
                    title={t("visitWebsite")}
                >
                    <span>🌐</span>
                    <span>{t("visitWebsite")}</span>
                </button>

                {/* Language Switcher */}
                <div className="lang-switcher-container" style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                        }}
                    >
                        <img src={langLabels[lang].flag} alt={lang} style={{ width: '14px', height: 'auto', borderRadius: '1px' }} />
                        <span style={{ fontSize: '0.6rem' }}>▼</span>
                    </button>
                    {/* ... (Lang Menu Content - kept same) ... */}
                    {showLangMenu && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            background: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            marginTop: '2px',
                            overflow: 'hidden',
                            zIndex: 1000,
                            minWidth: '100px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                        }}>
                            {Object.keys(langLabels).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => { setLang(l); setShowLangMenu(false); }}
                                    style={{
                                        width: '100%',
                                        background: lang === l ? 'rgba(0, 210, 255, 0.1)' : 'transparent',
                                        border: 'none',
                                        color: lang === l ? '#00d2ff' : '#fff',
                                        padding: '6px 10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        textAlign: 'left'
                                    }}
                                >
                                    <img src={langLabels[l].flag} alt={l} style={{ width: '14px', height: 'auto', borderRadius: '1px' }} />
                                    {langLabels[l].label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* PROMO BUTTON - MOVED TO TOP FOR FREE USERS */}
        {!isPremium && status === 'free' && (
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <button 
                    onClick={handleStartTrial} 
                    className="vibrate-btn"
                    style={{
                        background: 'linear-gradient(90deg, #00ff85, #00c86a)',
                        border: 'none',
                        color: '#000',
                        cursor: 'pointer',
                        padding: '10px 15px',
                        borderRadius: '6px',
                        fontWeight: '900',
                        width: '100%',
                        fontSize: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 15px rgba(0, 255, 133, 0.4)'
                    }}
                >
                    {t("getFreeTrial")}
                </button>
            </div>
        )}

        {!isPremium && (status === 'expired_trial' || status === 'past_due' || status === 'canceled') && (
            <div style={{ textAlign: 'center', marginBottom: '10px', background: 'rgba(255, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid #ff4444' }}>
                <p style={{ color: '#ff4444', fontWeight: 'bold', margin: 0 }}>
                    {status === 'expired_trial' ? t("trialEnded") : t("activateSubscription")}
                </p>
                <button 
                    onClick={handleGoPremium}
                    style={{ background: 'transparent', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer', marginTop: '5px', fontSize: '0.8rem' }}
                >
                    {t("getPremium")}
                </button>
            </div>
        )}

        {isTrialActive && (
            <div style={{ textAlign: 'center', marginBottom: '10px', background: 'rgba(0, 255, 133, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid #00ff85' }}>
                <p style={{ color: '#00ff85', fontWeight: 'bold', margin: 0, fontSize: '0.85rem' }}>
                    {t("trialDaysLeft")(countdown || '...')}
                </p>
                <button
                    onClick={handleSubscribeMonthly}
                    style={{
                        marginTop: '6px',
                        background: 'transparent',
                        border: '1px solid #00ff85',
                        color: '#00ff85',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                    }}
                >
                    {lang === 'es' ? 'Suscribirme ahora ($1.59/mes)' : 'Subscribe now ($1.59/mo)'}
                </button>
            </div>
        )}

        {!isPremium && status === 'free' && (
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <button 
                    onClick={handleGoPremium} 
                    className="vibrate-btn"
                    style={{
                        background: 'linear-gradient(90deg, #ffd700, #ffaa00)',
                        border: 'none',
                        color: '#000',
                        cursor: 'pointer',
                        padding: '10px 15px',
                        borderRadius: '6px',
                        fontWeight: '900',
                        width: '100%',
                        fontSize: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)'
                    }}
                >
                    {t("getPremium")}
                </button>
                <p style={{ 
                    fontSize: '0.8rem', 
                    color: '#ffd700', 
                    marginTop: '8px', 
                    fontWeight: 'bold',
                    textShadow: '0 0 5px rgba(255, 215, 0, 0.3)'
                }}>
                    {t("premiumPitch")}
                </p>
            </div>
        )}
      </div>

      {isTrialActive && (
        <div style={{
            margin: '0 0 12px 0',
            padding: '6px 10px',
            borderRadius: '999px',
            border: '1px solid rgba(0, 255, 133, 0.6)',
            background: 'rgba(0, 255, 133, 0.08)',
            color: '#00ff85',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            textAlign: 'center'
        }}>
          {lang === 'es' ? `TRIAL • ${countdown || '...'}` : `TRIAL • ${countdown || '...'}`}
        </div>
      )}

      {isPremium && Object.keys(allActiveTabs).length > 0 && (
        <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '15px',
            textAlign: 'left'
        }}>
            <div style={{fontSize: '0.7rem', color: '#888', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>
                🎛️ Control independent tabs (Premium)
            </div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px'}}>
                {Object.keys(allActiveTabs).map(tId => {
                    const tabId = parseInt(tId);
                    const tabInfo = activeTabList.find(t => t.id === tabId);
                    const isActive = targetTabId === tabId;
                    
                    // Skip if tab info is not found (might be closed or loading)
                    if (!tabInfo) return null;

                    return (
                        <button 
                            key={tId}
                            onClick={() => {
                                // PREMIUM CHECK FOR TAB SWITCHING
                                if (!isPremium) {
                                    alert(lang === 'es' ? '🔒 Función Premium: Control independiente por pestaña' : '🔒 Premium Feature: Independent tab control');
                                    return;
                                }

                                setTargetTabId(tabId);
                                if (allActiveTabs[tabId]) {
                                    setEnabled(true);
                                    if (allActiveTabs[tabId].preset) setCurrentPreset(allActiveTabs[tabId].preset);
                                } else {
                                    setEnabled(false); // Reset UI if switching to a new tab
                                }
                            }}
                            style={{
                                background: isActive ? '#00d2ff' : '#222',
                                color: isActive ? '#000' : '#fff',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                maxWidth: '130px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                            title={tabInfo.title || `Tab ${tId}`}
                        >
                            {tabInfo.favIconUrl ? (
                                <img 
                                    src={tabInfo.favIconUrl} 
                                    alt="" 
                                    style={{ width: '14px', height: '14px', borderRadius: '2px' }} 
                                    onError={(e) => e.target.style.display = 'none'}
                                />
                            ) : (
                                <span style={{ fontSize: '10px' }}>🌍</span>
                            )}
                            <span style={{ 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap' 
                            }}>
                                {tabInfo.title || `Tab ${tId}`}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
      )}

      <div style={{
          background: 'rgba(0, 210, 255, 0.05)',
          border: enabled ? (isActiveTabSelected ? '1px solid #00d2ff' : '1px solid #444') : '1px dashed #444',
          borderRadius: '8px',
          padding: '8px 12px',
          margin: '10px 0',
          textAlign: 'left',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minHeight: '45px'
      }}>
          {!enabled ? (
              <div style={{color: '#888', fontStyle: 'italic', textAlign: 'center', width: '100%'}}>
                  {lang === 'es' ? '⚡ Enciende el ecualizador para esta pestaña' : '⚡ Turn on the equalizer for this tab'}
              </div>
          ) : (
              <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{color: '#00d2ff'}}>🎯</span>
                    <div style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        <span style={{color: '#aaa', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase'}}>
                            {isActiveTabSelected ? 'Controlling current tab:' : 'Controlling selected tab:'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            {activeTabList.find(t => t.id === targetTabId)?.favIconUrl ? (
                            <img 
                                src={activeTabList.find(t => t.id === targetTabId).favIconUrl} 
                                alt="" 
                                style={{ width: '16px', height: '16px', borderRadius: '2px' }} 
                                onError={(e) => e.target.src = 'https://www.google.com/s2/favicons?domain=google.com&sz=32'}
                            />
                            ) : (
                            <span style={{fontSize: '12px'}}>🌍</span>
                            )}
                            <span style={{color: '#fff', fontWeight: 'bold'}}>
                                {activeTabList.find(t => t.id === targetTabId)?.title || tabTitle || 'Active Website'}
                            </span>
                        </div>
                    </div>
                    {isPremium && <span style={{fontSize: '0.7rem', background: '#ffd700', color: '#000', padding: '1px 5px', borderRadius: '3px', fontWeight: 'bold'}}>PRO</span>}
                  </div>
                  
                  {/* OPTION 2: Link to web panel when active */}
                  {/* REMOVED: "View advanced panel on web" link as requested */}
              </div>
          )}
      </div>

      {/* USER INFO / SYNC SECTION */}
      {userEmail ? (
        <div style={{fontSize: '0.75rem', color: '#888', textAlign: 'center', marginBottom: '10px', background: '#222', padding: '5px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
            <span>👤 <span style={{color: '#fff'}}>{userEmail}</span></span>
            {isPremium ? (
                <span style={{color: '#ffd700', fontWeight: 'bold'}}>
                    {isTrialActive ? `• ${t("trialBadge")} 🎁` : t("premiumStatus")}
                </span>
            ) : (
                <span style={{color: '#ccc'}}>{t("freeStatus")}</span>
            )}
            <button 
                onClick={refreshStatus} 
                disabled={loading}
                title={t("syncStatus")}
                style={{
                    background: 'transparent',
                    border: '1px solid #666',
                    color: '#fff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    padding: '2px 6px',
                    opacity: loading ? 0.5 : 1
                }}
            >
                {loading ? '...' : '↻'}
            </button>
        </div>
      ) : (
         <div style={{textAlign: 'center', marginBottom: '10px'}}>
             <p style={{fontSize: '0.8rem', color: '#aaa', marginBottom: '5px'}}>{t("signInText")}</p>
             <button onClick={handleLogin} style={{background: '#4285F4', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem'}}>
                 {t("loginSync")}
             </button>
             <div style={{marginTop: '6px'}}>
               <button 
                 onClick={refreshStatus}
                 disabled={loading}
                 title={t("syncStatus")}
                 style={{
                   background: 'transparent',
                   border: '1px solid #666',
                   color: '#fff',
                   borderRadius: '4px',
                   cursor: 'pointer',
                   fontSize: '0.8rem',
                   padding: '4px 8px',
                   opacity: loading ? 0.5 : 1
                 }}
               >
                 {loading ? '...' : '↻ Sync'}
               </button>
             </div>
         </div>
      )}

      {/* POWER BUTTON */}
      <div className="controls">
        <span>{t("power")}</span>
        <button 
          className={`toggle-btn ${enabled ? 'active' : ''}`}
          onClick={toggleEq}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* PRESET SELECTOR */}
      <div className="controls" style={{justifyContent: 'center', background: 'transparent'}}>
          <select 
            value={currentPreset} 
            onChange={handlePresetChange}
            style={{
                background: '#333', color: '#fff', border: '1px solid #555', 
                padding: '5px', borderRadius: '4px', width: '100%'
            }}
          >
              <optgroup label="Free Presets">
                  <option value="flat">Flat (Default)</option>
                  <option value="vocal">Vocal Boost</option>
                  <option value="guitar">Guitar Boost</option>
                  <option value="bass-light">Bass Light</option>
                  <option value="custom">Custom (Your settings)</option>
              </optgroup>
              <optgroup label="Premium Presets (PRO)">
                  <option value="studio" disabled={!isPremium}>Studio {isPremium ? '' : '🔒'}</option>
                  <option value="bass-pro" disabled={!isPremium}>Bass Pro {isPremium ? '' : '🔒'}</option>
                  <option value="gaming" disabled={!isPremium}>Gaming {isPremium ? '' : '🔒'}</option>
                  <option value="cinema" disabled={!isPremium}>Cinema {isPremium ? '' : '🔒'}</option>
                  <option value="edm" disabled={!isPremium}>EDM / Trap {isPremium ? '' : '🔒'}</option>
                  <option value="podcast" disabled={!isPremium}>Podcast {isPremium ? '' : '🔒'}</option>
                  <option value="night-cinema" disabled={!isPremium}>Night Cinema {isPremium ? '' : '🔒'}</option>
                  <option value="warm-vintage" disabled={!isPremium}>Warm Vintage {isPremium ? '' : '🔒'}</option>
                  <option value="crystal-clear" disabled={!isPremium}>Crystal Clear {isPremium ? '' : '🔒'}</option>
                  <option value="deep-focus" disabled={!isPremium}>Deep Focus {isPremium ? '' : '🔒'}</option>
                  <option value="rock-metal" disabled={!isPremium}>Rock / Metal {isPremium ? '' : '🔒'}</option>
                  <option value="acoustic-live" disabled={!isPremium}>Acoustic / Live {isPremium ? '' : '🔒'}</option>
              </optgroup>
          </select>
      </div>

      <Equalizer 
        enabled={enabled} 
        isPremium={isPremium} 
        currentPreset={currentPreset}
        presetGains={PRESETS[currentPreset]}
        onUserAdjust={onUserAdjust}
        targetTabId={targetTabId}
        volumeLimitWarning={t("volumeLimitWarning")}
        openPremiumModal={openPremiumModal}
        openGuideModal={openGuideModal}
      />

      {enabled && (
        <SpectrumAnalyzer targetTabId={targetTabId} isPremium={isPremium} />
      )}

      {/* MODAL PREMIUM */}
      <PremiumModal 
        isOpen={isModalOpen} 
        message={modalMessage} 
        onClose={closePremiumModal} 
        onUpgrade={handleGoPremium} 
      />

      {/* MODAL SYNC/LOGIN */}
      <ActionModal 
        isOpen={isSyncModalOpen}
        title={t("syncLoginTitle")}
        message={t("syncLoginMsg")}
        confirmText={t("syncLoginConfirm")}
        cancelText={t("syncLoginCancel")}
        onClose={closeSyncModal}
        onConfirm={() => {
            closeSyncModal();
            handleLogin();
        }}
      />

      <ActionModal 
        isOpen={isStatusModalOpen}
        title={statusModalTitle}
        icon={statusModalIcon}
        message={statusModalMessage}
        confirmText={lang === 'es' ? 'OK' : 'OK'}
        cancelText=""
        onClose={closeStatusModal}
        onConfirm={closeStatusModal}
      />

      {/* MODAL GUIDE (Power ON) */}
      <ActionModal 
        isOpen={isGuideModalOpen}
        title={t("powerOnGuideTitle")}
        icon="💡"
        message={t("powerOnGuideMsg")}
        confirmText={t("powerOnGuideConfirm")}
        cancelText=""
        onClose={closeGuideModal}
        onConfirm={closeGuideModal}
      />

    </div>
  );
}
