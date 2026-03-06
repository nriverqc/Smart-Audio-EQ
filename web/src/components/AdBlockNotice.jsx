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
      title: '⚠️ Bloqueador Detectado',
      message: 'Hemos detectado un bloqueador de anuncios.',
      warning: 'Para usar este sitio, desactiva tu AdBlock y recarga la página.',
      instruction: 'Si ya lo desactivaste, presiona el botón de abajo.',
      btn: 'Ya lo desactivé, Verificar',
      checking: 'Verificando...'
    },
    en: {
      title: '⚠️ AdBlocker Detected',
      message: 'We have detected an ad blocker.',
      warning: 'To use this site, disable your AdBlock and refresh the page.',
      instruction: 'If you already disabled it, press the button below.',
      btn: 'I disabled it, Verify',
      checking: 'Verifying...'
    },
    pt: {
      title: '⚠️ Bloqueador Detectado',
      message: 'Detectamos um bloqueador de anúncios.',
      warning: 'Para usar este site, desative seu AdBlock e recarregue a página.',
      instruction: 'Se você já desativou, pressione o botão abaixo.',
      btn: 'Já desativei, Verificar',
      checking: 'Verificando...'
    },
    de: {
      title: '⚠️ AdBlocker erkannt',
      message: 'Wir haben einen Werbeblocker erkannt.',
      warning: 'Um diese Website zu nutzen, deaktivieren Sie Ihren AdBlock und laden Sie die Seite neu.',
      instruction: 'Wenn Sie ihn bereits deaktiviert haben, drücken Sie die Taste unten.',
      btn: 'Ich habe ihn deaktiviert, Überprüfen',
      checking: 'Überprüfen...'
    }
  };

  const t = texts[lang] || texts.es;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000000,
      backdropFilter: 'blur(10px)',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: '#111',
        color: 'white',
        padding: '40px',
        borderRadius: '20px',
        border: '1px solid #333',
        maxWidth: '500px'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🛡️</div>
        <h2 style={{ margin: '0 0 15px 0', color: '#ff4444' }}>{t.title}</h2>
        <p style={{ fontSize: '1.1rem', marginBottom: '20px' }}>{t.message}</p>
        <p style={{ color: '#aaa', marginBottom: '30px' }}>{t.warning}</p>
        
        <button 
          onClick={handleManualCheck}
          disabled={checking}
          className="btn-primary"
          style={{
            padding: '15px 30px',
            fontSize: '1rem',
            width: '100%',
            opacity: checking ? 0.7 : 1,
            cursor: checking ? 'wait' : 'pointer'
          }}
        >
          {checking ? t.checking : t.btn}
        </button>
      </div>
    </div>
  );
};

export default AdBlockNotice;
