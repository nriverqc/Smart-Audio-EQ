import React, { useState } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

// Initialize with user's Public Key
initMercadoPago('TEST-b4334d13-d110-4e26-9800-79a643dd69d4');

export default function Premium({ lang }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [showBrick, setShowBrick] = useState(false);
  const [preferenceId, setPreferenceId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const texts = {
    es: {
      title: 'Desbloquea toda la potencia',
      subtitle: 'Pago único. Acceso de por vida.',
      freeTitle: 'Gratis',
      freePrice: '$0 / para siempre',
      premiumTitle: 'Premium 💎',
      premiumPrice: '$5000 / de por vida',
      freeItems: ['✅ Ecualizador de 6 bandas', '✅ Presets básicos (Flat, Vocal, etc.)', '✅ Mejora de volumen'],
      premiumItems: [
        '✅ Todo lo de Gratis',
        '✅ Presets personalizados (guarda tus configuraciones)',
        '✅ Presets Pro (Bass Pro, Gaming, Cinema)',
        '✅ Sync en la nube (próximamente)',
        '✅ Soporte prioritario',
      ],
      buyLabel: 'Pagar con Tarjeta',
      processingLabel: 'Procesando...',
      loadingLabel: 'Cargando formulario de pago...',
      emailLabel: 'Ingresa tu email de Google (para activar Premium en la extensión)',
      emailPlaceholder: 'tu.email@gmail.com',
      successMessage: '¡Pago exitoso! Tu licencia Premium ha sido activada.',
      errorMessage: 'Hubo un error al procesar el pago.'
    },
    en: {
      title: 'Unlock the full power',
      subtitle: 'One-time payment. Lifetime access.',
      freeTitle: 'Free',
      freePrice: '$0 / forever',
      premiumTitle: 'Premium 💎',
      premiumPrice: '$5000 / lifetime',
      freeItems: ['✅ 6-Band EQ', '✅ Basic presets (Flat, Vocal, etc.)', '✅ Volume boost'],
      premiumItems: [
        '✅ Everything in Free',
        '✅ Custom presets (save your own)',
        '✅ Pro presets (Bass Pro, Gaming, Cinema)',
        '✅ Cloud sync (coming soon)',
        '✅ Priority support',
      ],
      buyLabel: 'Pay with Card',
      processingLabel: 'Processing...',
      loadingLabel: 'Loading payment form...',
      emailLabel: 'Enter your Google Email (to activate Premium in the extension)',
      emailPlaceholder: 'your.email@gmail.com',
      successMessage: 'Payment successful! Your Premium license has been activated.',
      errorMessage: 'There was an error processing the payment.'
    },
  };

  const t = texts[lang] || texts.es;

  const createPreference = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
          const res = await fetch(`${API_BASE}/create-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: email, price: 5000, item: 'Smart Audio EQ Premium' })
          });
          const data = await res.json();
          if (data.preference_id) {
              console.log("Preference created:", data.preference_id);
              setPreferenceId(data.preference_id);
              setShowBrick(true);
          } else {
              setErrorMsg('Error creating preference: ' + (data.error || 'Unknown error') + ' | ' + JSON.stringify(data.details || {}));
          }
      } catch (err) {
          setErrorMsg('Network error: ' + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleBrickSubmit = async ({ formData }) => {
     setLoading(true);
     return new Promise((resolve, reject) => {
         fetch(`${API_BASE}/process_payment`, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
             },
             body: JSON.stringify(formData),
         })
         .then((response) => response.json())
         .then((response) => {
             // Receive the payment result
             if (response.status === 'approved') {
                 alert(t.successMessage);
                 resolve();
             } else {
                 alert(t.errorMessage + " Status: " + response.status);
                 reject();
             }
         })
         .catch((error) => {
             console.error(error);
             alert(t.errorMessage);
             reject();
         })
         .finally(() => setLoading(false));
     });
  };

  const initialization = React.useMemo(() => ({
    preferenceId: preferenceId,
    amount: 5000,
  }), [preferenceId]);

  const customization = React.useMemo(() => ({
    paymentMethods: {
      creditCard: "all",
      debitCard: "all",
    },
  }), []);

  return (
    <div style={{textAlign: 'center', padding: '50px 0'}}>
      <h1 style={{color: '#ffd700', fontSize: '3rem'}}>{t.title}</h1>
      <p style={{fontSize: '1.2rem', marginBottom: '40px'}}>{t.subtitle}</p>

      {/* Sandbox Warning */}
      <div style={{background: '#ffeb3b', color: '#000', padding: '10px', marginBottom: '20px', borderRadius: '5px', display: 'inline-block'}}>
        <strong>MODO PRUEBA (Sandbox):</strong> Usa tarjetas de prueba. 
        <br/>Nombre del titular: <b>APRO</b> (para aprobar)
      </div>

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
          
          <div style={{margin: '20px 0', textAlign: 'left'}}>
              <label style={{display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc'}}>
                  {t.emailLabel}
              </label>
              <input 
                  type="email" 
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={showBrick}
                  style={{
                      width: '100%', 
                      padding: '10px', 
                      borderRadius: '5px', 
                      border: '1px solid #555',
                      background: '#222',
                      color: '#fff'
                  }}
              />
          </div>

          {!showBrick ? (
              <>
                  {errorMsg && <div style={{color: 'red', marginBottom: '10px'}}>{errorMsg}</div>}
                  <button 
                    className="btn-premium" 
                    style={{width: '100%', marginTop: '10px', opacity: loading ? 0.5 : 1}}
                    disabled={loading}
                    onClick={() => {
                        if (!email || !email.includes('@')) {
                            alert(lang === 'es' ? 'Por favor ingresa un email válido.' : 'Please enter a valid email.');
                            return;
                        }
                        createPreference();
                    }}
                  >
                    {loading ? t.loadingLabel : t.buyLabel}
                  </button>
              </>
          ) : (
              <div style={{background: '#fff', padding: '10px', borderRadius: '5px'}}>
                  {loading && <div style={{color: '#333', marginBottom: '10px'}}>{t.processingLabel}</div>}
                  <Payment
                    initialization={initialization}
                    customization={customization}
                    onSubmit={handleBrickSubmit}
                    onError={(error) => {
                        console.error("Brick Error:", error);
                        alert("Payment Brick Error: " + (error.message || JSON.stringify(error)));
                    }}
                  />
                  <button 
                    onClick={() => setShowBrick(false)}
                    disabled={loading}
                    style={{marginTop: '10px', background: 'transparent', border: 'none', color: '#333', cursor: 'pointer', textDecoration: 'underline', opacity: loading ? 0.5 : 1}}
                  >
                    {lang === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
              </div>
          )}

        </div>
      </div>
    </div>
  );
}
