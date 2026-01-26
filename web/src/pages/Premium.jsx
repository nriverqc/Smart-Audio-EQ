import React, { useState } from 'react';

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

export default function Premium({ lang }) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const itemTitle =
        lang === 'es' ? 'Smart Audio EQ Premium (Pago único)' : 'Smart Audio EQ Premium (One-time)';

      const response = await fetch(`${API_BASE}/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: itemTitle, price: 4.99 }),
      });
      
      const data = await response.json();
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        alert(lang === 'es' ? 'No se pudo iniciar el pago. Intenta de nuevo.' : 'Payment setup failed. Please try again.');
      }
    } catch (error) {
      console.error(error);
      alert(lang === 'es' ? 'Error al conectar con el servidor de pagos.' : 'Error connecting to payment server.');
    } finally {
      setLoading(false);
    }
  };

  const texts = {
    es: {
      title: 'Desbloquea toda la potencia',
      subtitle: 'Pago único. Acceso de por vida.',
      freeTitle: 'Gratis',
      freePrice: '$0 / para siempre',
      premiumTitle: 'Premium 💎',
      premiumPrice: '$4.99 / de por vida',
      freeItems: ['✅ Ecualizador de 6 bandas', '✅ Presets básicos (Flat, Vocal, etc.)', '✅ Mejora de volumen'],
      premiumItems: [
        '✅ Todo lo de Gratis',
        '✅ Presets personalizados (guarda tus configuraciones)',
        '✅ Presets Pro (Bass Pro, Gaming, Cinema)',
        '✅ Sync en la nube (próximamente)',
        '✅ Soporte prioritario',
      ],
      buyLabel: 'Comprar ahora',
      processingLabel: 'Procesando...',
    },
    en: {
      title: 'Unlock the full power',
      subtitle: 'One-time payment. Lifetime access.',
      freeTitle: 'Free',
      freePrice: '$0 / forever',
      premiumTitle: 'Premium 💎',
      premiumPrice: '$4.99 / lifetime',
      freeItems: ['✅ 6-Band EQ', '✅ Basic presets (Flat, Vocal, etc.)', '✅ Volume boost'],
      premiumItems: [
        '✅ Everything in Free',
        '✅ Custom presets (save your own)',
        '✅ Pro presets (Bass Pro, Gaming, Cinema)',
        '✅ Cloud sync (coming soon)',
        '✅ Priority support',
      ],
      buyLabel: 'Buy now',
      processingLabel: 'Processing...',
    },
  };

  const t = texts[lang] || texts.es;

  return (
    <div style={{textAlign: 'center', padding: '50px 0'}}>
      <h1 style={{color: '#ffd700', fontSize: '3rem'}}>{t.title}</h1>
      <p style={{fontSize: '1.2rem', marginBottom: '40px'}}>{t.subtitle}</p>

      <div style={{display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap'}}>
        <div className="feature-card" style={{border: '1px solid #333', textAlign: 'left', minWidth: '300px'}}>
          <h2>{t.freeTitle}</h2>
          <ul style={{listStyle: 'none', padding: 0, lineHeight: '2'}}>
            {t.freeItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 style={{marginTop: '20px'}}>{t.freePrice}</h3>
        </div>

        <div className="feature-card" style={{border: '2px solid #ffd700', textAlign: 'left', minWidth: '300px', transform: 'scale(1.05)'}}>
          <h2 style={{color: '#ffd700'}}>{t.premiumTitle}</h2>
          <ul style={{listStyle: 'none', padding: 0, lineHeight: '2'}}>
            {t.premiumItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 style={{marginTop: '20px'}}>{t.premiumPrice}</h3>
          <button 
            className="btn-premium" 
            style={{width: '100%', marginTop: '10px'}}
            onClick={handlePayment}
            disabled={loading}
          >
            {loading ? t.processingLabel : t.buyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
