import React, { useEffect, useState } from 'react';

const AdBlockNotice = ({ lang }) => {
  const [adBlocked, setAdBlocked] = useState(false);

  useEffect(() => {
    // 1. Create bait element with common ad class names
    const bait = document.createElement('div');
    bait.className = 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
    bait.setAttribute('style', 'width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;');
    document.body.appendChild(bait);

    // 2. Check if it was blocked/hidden
    const checkAdBlock = () => {
      if (
        !bait || 
        bait.offsetParent === null || 
        bait.offsetHeight === 0 || 
        bait.offsetLeft === 0 || 
        bait.style.display === 'none' || 
        window.getComputedStyle(bait).display === 'none'
      ) {
        setAdBlocked(true);
      } else {
        setAdBlocked(false);
      }
    };

    // Initial check after a delay to let blockers act
    const timer = setTimeout(checkAdBlock, 2000);

    // Also check on window load and periodically
    window.addEventListener('load', checkAdBlock);
    const interval = setInterval(checkAdBlock, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('load', checkAdBlock);
      if (document.body.contains(bait)) {
        document.body.removeChild(bait);
      }
    };
  }, []);

  if (!adBlocked) return null;

  const texts = {
    es: {
      title: '⚠️ Bloqueador de Anuncios Detectado',
      message: 'Hemos detectado que estás usando un bloqueador de anuncios (AdBlock).',
      warning: 'Para poder procesar pagos Premium, registrarte o usar todas las funciones, DEBES desactivar tu bloqueador para este sitio.',
      reason: 'Mantenemos esta herramienta gratuita gracias a la publicidad. Sin anuncios, no podemos procesar tu suscripción ni mantener el servicio activo.',
      instruction: 'Desactiva el AdBlock y recarga la página para continuar.',
      btn: 'Ya lo desactivé, recargar'
    },
    en: {
      title: '⚠️ AdBlocker Detected',
      message: 'We have detected that you are using an AdBlocker.',
      warning: 'To process Premium payments, register, or use all features, you MUST disable your blocker for this site.',
      reason: 'We keep this tool free thanks to advertising. Without ads, we cannot process your subscription or keep the service active.',
      instruction: 'Please disable your AdBlocker and refresh the page to continue.',
      btn: 'I disabled it, refresh now'
    },
    pt: {
      title: '⚠️ Bloqueador de Anúncios Detectado',
      message: 'Detectamos que você está usando um bloqueador de anúncios (AdBlock).',
      warning: 'Para processar pagamentos Premium, registrar-se ou usar todas as funções, você DEVE desativar seu bloqueador para este site.',
      reason: 'Mantemos esta ferramenta gratuita graças à publicidade. Sem anúncios, não podemos processar sua assinatura ou manter o serviço ativo.',
      instruction: 'Desative o AdBlock e recarregue a página para continuar.',
      btn: 'Já desativei, recarregar'
    },
    de: {
      title: '⚠️ AdBlocker erkannt',
      message: 'Wir haben festgestellt, dass Sie einen AdBlocker verwenden.',
      warning: 'Um Premium-Zahlungen zu verarbeiten, sich zu registrieren oder alle Funktionen zu nutzen, MÜSSEN Sie Ihren Blocker für diese Website deaktivieren.',
      reason: 'Wir halten dieses Tool dank Werbung kostenlos. Ohne Werbung können wir Ihr Abonnement nicht verarbeiten oder den Dienst aktiv halten.',
      instruction: 'Bitte deaktivieren Sie Ihren AdBlocker und laden Sie die Seite neu, um fortzufahren.',
      btn: 'Ich habe ihn deaktiviert, neu laden'
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
      zIndex: 100000,
      backdropFilter: 'blur(10px)',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        color: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 0 50px rgba(0, 210, 255, 0.3)',
        maxWidth: '500px',
        border: '1px solid #333',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#ff9800', fontSize: '1.8rem' }}>{t.title}</h2>
        <p style={{ margin: '0 0 15px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>
          {t.message}
        </p>
        <div style={{
            background: 'rgba(255, 0, 0, 0.1)',
            padding: '15px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            marginBottom: '20px',
            color: '#ff5555',
            fontWeight: 'bold'
        }}>
          {t.warning}
        </div>
        <p style={{ margin: '0 0 20px 0', fontSize: '0.95rem', color: '#aaa', lineHeight: '1.5' }}>
          {t.reason}
        </p>
        <p style={{ margin: '0 0 30px 0', fontSize: '1rem', color: '#00d2ff', fontWeight: 'bold' }}>
          {t.instruction}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="btn-primary"
          style={{
              padding: '15px 40px',
              fontSize: '1.1rem',
              width: '100%'
          }}
        >
          {t.btn}
        </button>
      </div>
    </div>
  );
};

export default AdBlockNotice;
