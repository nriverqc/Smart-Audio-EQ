import React, { useEffect, useState } from 'react';

const AdBlockNotice = ({ lang }) => {
  const [adBlocked, setAdBlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const checkAdBlock = async () => {
      // 1. DOM Check (Bait)
      const bait = document.createElement('div');
      bait.className = 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links advertisement ad-banner';
      bait.setAttribute('style', 'width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;');
      document.body.appendChild(bait);

      // Wait a moment for styles to apply
      await new Promise(r => setTimeout(r, 100));

      const isDomBlocked = 
        !bait || 
        bait.offsetParent === null || 
        bait.offsetHeight === 0 || 
        bait.offsetLeft === 0 || 
        bait.style.display === 'none' || 
        window.getComputedStyle(bait).display === 'none';

      document.body.removeChild(bait);

      if (isDomBlocked) {
        setAdBlocked(true);
        return;
      }

      // 2. Network Check (Relaxed)
      // Only check one critical URL and allow cors issues (opaque response is fine, failure is block)
      try {
        const adUrl = 'https://pl28656732.effectivegatecpm.com/98/23/7c/98237cf077449f197b6656eb7fccd1dc.js';
        await fetch(new Request(adUrl), { mode: 'no-cors' });
        // If fetch succeeds (even with opaque response), no block
        setAdBlocked(false);
      } catch (error) {
        // Only if network ERROR (ERR_BLOCKED_BY_CLIENT) we consider it blocked
        setAdBlocked(true);
      }
    };

    // Initial check
    const timer = setTimeout(checkAdBlock, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  const handleManualCheck = () => {
    setChecking(true);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (!adBlocked) return null;

  const texts = {
    es: {
      title: '👋 ¡Hola! Un pequeño favor',
      message: 'Esta herramienta se mantiene gracias a los anuncios.',
      warning: 'Si te resulta útil, considera desactivar AdBlock o usar Premium ❤️',
      instruction: '',
      btn: 'Entendido, cerrar',
      checking: 'Cerrando...'
    },
    en: {
      title: '👋 Hi! A small favor',
      message: 'This tool is supported by ads.',
      warning: 'If you find it useful, please consider disabling AdBlock or getting Premium ❤️',
      instruction: '',
      btn: 'Got it, close',
      checking: 'Closing...'
    },
    pt: {
      title: '👋 Olá! Um pequeno favor',
      message: 'Esta ferramenta é mantida por anúncios.',
      warning: 'Se for útil, considere desativar o AdBlock ou usar o Premium ❤️',
      instruction: '',
      btn: 'Entendi, fechar',
      checking: 'Fechando...'
    },
    de: {
      title: '👋 Hallo! Ein kleiner Gefallen',
      message: 'Dieses Tool wird durch Werbung finanziert.',
      warning: 'Wenn Sie es nützlich finden, deaktivieren Sie bitte AdBlock oder holen Sie sich Premium ❤️',
      instruction: '',
      btn: 'Verstanden, schließen',
      checking: 'Schließen...'
    }
  };

  const t = texts[lang] || texts.es;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      maxWidth: '350px',
      backgroundColor: '#1a1a1a',
      color: 'white',
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid #333',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      zIndex: 1000000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      animation: 'slideIn 0.5s ease-out'
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
        <span style={{fontSize: '1.5rem'}}>🛡️</span>
        <h3 style={{margin: 0, fontSize: '1rem', color: '#fff'}}>{t.title}</h3>
      </div>
      <p style={{margin: 0, fontSize: '0.9rem', color: '#ccc', lineHeight: '1.4'}}>
        {t.message}
        <br/>
        {t.warning}
      </p>
      
      <button 
        onClick={() => setAdBlocked(false)}
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          color: '#aaa',
          padding: '8px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.8rem',
          alignSelf: 'flex-end',
          marginTop: '5px'
        }}
      >
        {t.btn}
      </button>
    </div>
  );
};

export default AdBlockNotice;
