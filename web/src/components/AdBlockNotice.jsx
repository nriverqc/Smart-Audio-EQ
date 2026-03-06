import React, { useEffect, useState } from 'react';

const AdBlockNotice = ({ lang }) => {
  const [adBlocked, setAdBlocked] = useState(false);

  useEffect(() => {
    // 1. Create bait element with common ad class names
    const bait = document.createElement('div');
    bait.className = 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links advertisement ad-banner';
    bait.setAttribute('style', 'width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;');
    document.body.appendChild(bait);

    // 2. Network Check: Try to fetch a known ad-related script URL
    const checkNetworkAdBlock = async () => {
        // URLs that AdBlockers typically block
        const adUrls = [
            'https://pl28656732.effectivegatecpm.com/98/23/7c/98237cf077449f197b6656eb7fccd1dc.js',
            'https://pl28656733.effectivegatecpm.com/7b/9e/1e/7b9e1e3e5f4a6b7c9e1e3e5f4a6b7c9e.js',
            'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
        ];

        for (const url of adUrls) {
            try {
                const response = await fetch(new Request(url), { mode: 'no-cors' });
                // If we get here, it MIGHT be okay, but some blockers "fake" success
                // So we still rely on other methods.
            } catch (error) {
                // If fetch fails, it's very likely blocked by an extension (ERR_BLOCKED_BY_CLIENT)
                return true;
            }
        }
        return false;
    };

    // 3. DOM Check: Check if bait element is hidden
    const checkDomAdBlock = () => {
      return (
        !bait || 
        bait.offsetParent === null || 
        bait.offsetHeight === 0 || 
        bait.offsetLeft === 0 || 
        bait.style.display === 'none' || 
        window.getComputedStyle(bait).display === 'none'
      );
    };

    const performCheck = async () => {
        const isDomBlocked = checkDomAdBlock();
        const isNetworkBlocked = await checkNetworkAdBlock();
        
        if (isDomBlocked || isNetworkBlocked) {
            setAdBlocked(true);
        } else {
            setAdBlocked(false);
        }
    };

    // Initial check almost immediately
    const timer1 = setTimeout(performCheck, 1000);
    // Second check after 3 seconds
    const timer2 = setTimeout(performCheck, 3000);

    // Periodic check every 5 seconds
    const interval = setInterval(performCheck, 5000);

    window.addEventListener('load', performCheck);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearInterval(interval);
      window.removeEventListener('load', performCheck);
      if (document.body.contains(bait)) {
        document.body.removeChild(bait);
      }
    };
  }, []);

  if (!adBlocked) return null;

  const texts = {
    es: {
      title: '⚠️ Bloqueador Detectado (AdBlock)',
      message: 'Tu navegador está bloqueando los recursos necesarios para el funcionamiento de este sitio.',
      warning: 'Para poder REGISTRARTE, PAGAR PREMIUM o ACTIVAR tu cuenta, DEBES desactivar el AdBlock (u-Block, AdGuard, Brave Shields, etc.) para esta página.',
      reason: 'Los anuncios de Adsterra son esenciales para financiar este servicio. Si los bloqueas, el sistema de seguridad impedirá cualquier transacción o registro.',
      instruction: 'Haz clic en el icono de tu bloqueador, selecciona "Desactivar para este sitio" y recarga la página.',
      btn: 'Recargar página ahora'
    },
    en: {
      title: '⚠️ Blocker Detected (AdBlock)',
      message: 'Your browser is blocking the resources required for this site to function.',
      warning: 'To REGISTER, PAY PREMIUM, or ACTIVATE your account, you MUST disable your AdBlock (u-Block, AdGuard, Brave Shields, etc.) for this site.',
      reason: 'Adsterra ads are essential to fund this service. If you block them, our security system will prevent any transaction or registration.',
      instruction: 'Click your blocker icon, select "Disable for this site," and refresh the page.',
      btn: 'Refresh page now'
    },
    pt: {
      title: '⚠️ Bloqueador Detectado (AdBlock)',
      message: 'Seu navegador está bloqueando os recursos necessários para o funcionamento deste site.',
      warning: 'Para REGISTRAR-SE, PAGAR PREMIUM ou ATIVAR sua conta, você DEVE desativar o AdBlock (u-Block, AdGuard, Brave Shields, etc.) para este site.',
      reason: 'Os anúncios da Adsterra são essenciais para financiar este serviço. Se você os bloquear, o sistema de segurança impedirá qualquer transação ou registro.',
      instruction: 'Clique no ícone do seu bloqueador, selecione "Desativar para este site" e recarregue a página.',
      btn: 'Recarregar página agora'
    },
    de: {
      title: '⚠️ Blocker erkannt (AdBlock)',
      message: 'Ihr Browser blockiert die für diese Website erforderlichen Ressourcen.',
      warning: 'Um sich zu REGISTRIEREN, PREMIUM ZU BEZAHLEN oder Ihr Konto zu AKTIVIEREN, MÜSSEN Sie Ihren AdBlock (u-Block, AdGuard, Brave Shields usw.) für diese Website deaktivieren.',
      reason: 'Adsterra-Anzeigen sind für die Finanzierung dieses Dienstes unerlässlich. Wenn Sie sie blockieren, verhindert unser Sicherheitssystem jede Transaktion oder Registrierung.',
      instruction: 'Klicken Sie auf das Blocker-Symbol, wählen Sie "Für diese Website deaktivieren" und laden Sie die Seite neu.',
      btn: 'Seite jetzt neu laden'
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
      backgroundColor: 'rgba(0, 0, 0, 0.98)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000000,
      backdropFilter: 'blur(15px)',
      padding: '20px',
      textAlign: 'center',
      userSelect: 'none'
    }}>
      <div style={{
        backgroundColor: '#0a0a0a',
        color: 'white',
        padding: '50px 30px',
        borderRadius: '30px',
        boxShadow: '0 0 100px rgba(255, 0, 0, 0.2)',
        maxWidth: '550px',
        border: '1px solid #333',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🛑</div>
        <h2 style={{ margin: '0 0 20px 0', color: '#ff4444', fontSize: '2.2rem', fontWeight: '800' }}>{t.title}</h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#eee' }}>
          {t.message}
        </p>
        <div style={{
            background: 'rgba(255, 0, 0, 0.15)',
            padding: '20px',
            borderRadius: '15px',
            border: '2px solid #ff4444',
            marginBottom: '25px',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            lineHeight: '1.4'
        }}>
          {t.warning}
        </div>
        <p style={{ margin: '0 0 25px 0', fontSize: '0.95rem', color: '#999', lineHeight: '1.6' }}>
          {t.reason}
        </p>
        <div style={{
            borderTop: '1px solid #333',
            paddingTop: '25px',
            marginTop: '20px'
        }}>
            <p style={{ margin: '0 0 30px 0', fontSize: '1.1rem', color: '#00d2ff', fontWeight: 'bold' }}>
            {t.instruction}
            </p>
            <button 
            onClick={() => window.location.reload()}
            className="btn-primary"
            style={{
                padding: '18px 50px',
                fontSize: '1.2rem',
                width: '100%',
                borderRadius: '15px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 5px 15px rgba(0, 210, 255, 0.4)'
            }}
            >
            {t.btn}
            </button>
        </div>
      </div>
    </div>
  );
};

export default AdBlockNotice;
