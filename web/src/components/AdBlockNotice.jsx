import React, { useEffect, useState } from 'react';

const AdBlockNotice = () => {
  const [adBlocked, setAdBlocked] = useState(false);

  useEffect(() => {
    // 1. Create bait element
    const bait = document.createElement('div');
    bait.className = 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
    bait.setAttribute('style', 'width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;');
    document.body.appendChild(bait);

    // 2. Check if it was blocked/hidden
    setTimeout(() => {
      if (
        !bait || 
        bait.offsetParent === null || 
        bait.offsetHeight === 0 || 
        bait.offsetLeft === 0 || 
        bait.style.display === 'none' || 
        window.getComputedStyle(bait).display === 'none'
      ) {
        setAdBlocked(true);
      }
      document.body.removeChild(bait);
    }, 2000);
  }, []);

  if (!adBlocked) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#333',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
      zIndex: 9999,
      maxWidth: '300px',
      borderLeft: '4px solid #ff9800',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#ff9800' }}>Adblock Detectado</h4>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4' }}>
        Mantenemos esta herramienta gratuita gracias a la publicidad. 
        Por favor, considera desactivar tu bloqueador para apoyarnos.
      </p>
      <button 
        onClick={() => setAdBlocked(false)}
        style={{
            marginTop: '10px',
            background: 'transparent',
            border: '1px solid #aaa',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
        }}
      >
        Entendido
      </button>
    </div>
  );
};

export default AdBlockNotice;