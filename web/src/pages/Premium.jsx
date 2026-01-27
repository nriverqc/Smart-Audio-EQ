import React, { useState, useContext, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { UserContext } from '../App';

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

// Initialize with user's Public Key
initMercadoPago('TEST-b4334d13-d110-4e26-9800-79a643dd69d4');

export default function Premium({ lang }) {
  const { user, refreshUser, loginWithGoogle } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [showBrick, setShowBrick] = useState(false);
  const [preferenceId, setPreferenceId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [country, setCountry] = useState('CO'); // 'CO' or 'INT'
  const emailRef = React.useRef(email);
  const userRef = React.useRef(user);

  useEffect(() => {
    if (user.email) {
        setEmail(user.email);
    }
    userRef.current = user;
  }, [user]);

  useEffect(() => {
      emailRef.current = email;
  }, [email]);

  // PayPal Effect
  useEffect(() => {
      if (country === 'INT' && window.paypal) {
          const containerId = "paypal-container-8M45H2NRA2N92";
          const container = document.getElementById(containerId);
          if (container) {
              container.innerHTML = ""; // Clear previous buttons
              try {
                  window.paypal.Buttons({
                      onClick: (data, actions) => {
                          const currentUser = userRef.current;
                          if (!currentUser || !currentUser.uid) {
                              alert(lang === 'es' ? 'Por favor inicia sesión primero.' : 'Please login first.');
                              loginWithGoogle();
                              return actions.reject();
                          }
                          return actions.resolve();
                      },
                      createOrder: (data, actions) => {
                          const currentUser = userRef.current;
                          return actions.order.create({
                              purchase_units: [{
                                  amount: {
                                      value: '4.99'
                                  },
                                  description: "Smart Audio EQ Premium",
                                  custom_id: currentUser.uid // Attach Firebase UID
                              }]
                          });
                      },
                      onApprove: (data, actions) => {
                          return actions.order.capture().then((details) => {
                              const currentUser = userRef.current;
                              console.log("PayPal Approved:", details);
                              setLoading(true);
                              
                              // Register license in backend
                              fetch(`${API_BASE}/register-paypal`, {
                                  method: 'POST',
                                  headers: {'Content-Type': 'application/json'},
                                  body: JSON.stringify({
                                      email: currentUser.email,
                                      uid: currentUser.uid,
                                      orderID: data.orderID
                                  })
                              })
                              .then(res => res.json())
                              .then(response => {
                                  if (response.status === 'approved') {
                                      alert(lang === 'es' ? '¡Pago exitoso! Tu cuenta Premium ha sido activada.' : 'Payment successful! Your Premium account has been activated.');
                                      refreshUser();
                                  } else {
                                      alert('Error activating license: ' + (response.error || 'Unknown'));
                                  }
                              })
                              .catch(err => {
                                  console.error(err);
                                  alert('Network error activating license');
                              })
                              .finally(() => setLoading(false));
                          });
                      },
                      onError: (err) => {
                          console.error("PayPal Error:", err);
                          alert("PayPal Error: " + err.message);
                      }
                  }).render("#" + containerId);
              } catch (e) {
                  console.error("PayPal Render Error:", e);
              }
          }
      }
  }, [country, lang, loginWithGoogle]); // Added loginWithGoogle dependency

  const texts = {
    es: {
      title: 'Desbloquea toda la potencia',
      subtitle: 'Pago único. Acceso de por vida.',
      freeTitle: 'Gratis',
      freePrice: '$0 / para siempre',
      premiumTitle: 'Premium 💎',
      premiumPriceCO: '$20.000 COP / de por vida',
      premiumPriceINT: '$4.99 USD / lifetime',
      freeItems: ['✅ Ecualizador de 6 bandas', '✅ Presets básicos (Flat, Vocal, etc.)', '✅ Mejora de volumen'],
      premiumItems: [
        '✅ Todo lo de Gratis',
        '✅ Presets personalizados (guarda tus configuraciones)',
        '✅ Presets Pro (Bass Pro, Gaming, Cinema)',
        '✅ Sync en la nube (próximamente)',
        '✅ Soporte prioritario',
      ],
      buyLabel: 'Pagar con Tarjeta (MercadoPago)',
      processingLabel: 'Procesando...',
      loadingLabel: 'Cargando formulario de pago...',
      emailLabel: 'Ingresa tu email de Google (para activar Premium)',
      emailPlaceholder: 'tu.email@gmail.com',
      successMessage: '¡Pago exitoso! Tu licencia Premium ha sido activada.',
      errorMessage: 'Hubo un error al procesar el pago.',
      countryLabel: 'Selecciona tu país:',
      optionCO: '🇨🇴 Colombia (MercadoPago)',
      optionINT: '🌍 Resto del Mundo (PayPal)',
      paypalNote: 'Nota: Después de pagar en PayPal, tu cuenta se activará automáticamente en unos minutos. Si no, contáctanos.'
    },
    en: {
      title: 'Unlock the full power',
      subtitle: 'One-time payment. Lifetime access.',
      freeTitle: 'Free',
      freePrice: '$0 / forever',
      premiumTitle: 'Premium 💎',
      premiumPriceCO: '$20.000 COP / lifetime',
      premiumPriceINT: '$4.99 USD / lifetime',
      freeItems: ['✅ 6-Band EQ', '✅ Basic presets (Flat, Vocal, etc.)', '✅ Volume boost'],
      premiumItems: [
        '✅ Everything in Free',
        '✅ Custom presets (save your own)',
        '✅ Pro presets (Bass Pro, Gaming, Cinema)',
        '✅ Cloud sync (coming soon)',
        '✅ Priority support',
      ],
      buyLabel: 'Pay with Card (MercadoPago)',
      processingLabel: 'Processing...',
      loadingLabel: 'Loading payment form...',
      emailLabel: 'Enter your Google Email (to activate Premium)',
      emailPlaceholder: 'your.email@gmail.com',
      successMessage: 'Payment successful! Your Premium license has been activated.',
      errorMessage: 'There was an error processing the payment.',
      countryLabel: 'Select your country:',
      optionCO: '🇨🇴 Colombia (MercadoPago)',
      optionINT: '🌍 Rest of World (PayPal)',
      paypalNote: 'Note: After paying on PayPal, your account will be activated automatically within a few minutes. If not, contact us.'
    },
  };

  const t = texts[lang] || texts.es;

  const createPreference = async () => {
    if (!user.uid) {
        alert(lang === 'es' ? 'Por favor inicia sesión primero.' : 'Please login first.');
        loginWithGoogle();
        return;
    }
    const email = user.email; // Use user email directly
    if (!email || !email.includes('@')) {
      alert('Email invalid');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    try {
        const res = await fetch(`${API_BASE}/create-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email, 
                uid: user.uid, // Send UID
                price: 20000, 
                item: 'Smart Audio EQ Premium' 
            })
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
     // Add UID to the data sent to backend
     const requestData = {
         ...formData,
         uid: user.uid,
         email: user.email // Ensure email is explicit
     };

     return new Promise((resolve, reject) => {
         fetch(`${API_BASE}/process_payment`, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
             },
             body: JSON.stringify(requestData),
         })
         .then((response) => response.json())
         .then((response) => {
             // Receive the payment result
             if (response.status === 'approved') {
                 alert(t.successMessage);
                 refreshUser();
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
    // amount: 20000, // REMOVED: Should not be used with preferenceId
  }), [preferenceId]);

  const customization = React.useMemo(() => ({
    paymentMethods: {
      creditCard: "all",
      debitCard: "all",
      ticket: "all",
      bankTransfer: "all",
      mercadoPago: "all",
    },
  }), []);

  if (user.isPremium) {
      return (
          <div style={{textAlign: 'center', padding: '100px 20px'}}>
              <h1 style={{color: '#ffd700', fontSize: '4rem'}}>Premium 💎</h1>
              <p style={{fontSize: '1.5rem', marginTop: '20px'}}>
                  {lang === 'es' ? '¡Gracias por tu compra!' : 'Thank you for your purchase!'}
              </p>
              <p style={{color: '#ccc', marginTop: '10px'}}>
                  {lang === 'es' 
                    ? `Tu licencia está activa para: ${user.email}` 
                    : `Your license is active for: ${user.email}`}
              </p>
              <div style={{marginTop: '40px', padding: '20px', background: '#222', borderRadius: '10px', display: 'inline-block'}}>
                  <h3 style={{color: '#00d2ff'}}>
                      {lang === 'es' ? '¿Qué sigue?' : 'What now?'}
                  </h3>
                  <ul style={{textAlign: 'left', marginTop: '15px', color: '#eee'}}>
                      <li>1. {lang === 'es' ? 'Abre la extensión Smart Audio EQ' : 'Open Smart Audio EQ extension'}</li>
                      <li>2. {lang === 'es' ? 'Verás el logo Premium activo' : 'You will see the Premium badge active'}</li>
                      <li>3. {lang === 'es' ? 'Disfruta de presets ilimitados' : 'Enjoy unlimited presets'}</li>
                  </ul>
              </div>
          </div>
      );
  }

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
          
          {/* Country Selector */}
          <div style={{margin: '10px 0'}}>
              <label style={{display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc'}}>{t.countryLabel}</label>
              <select 
                value={country} 
                onChange={(e) => {
                    setCountry(e.target.value);
                    setShowBrick(false); // Reset brick on change
                }}
                style={{
                    width: '100%', 
                    padding: '8px', 
                    borderRadius: '5px', 
                    background: '#222', 
                    color: '#fff', 
                    border: '1px solid #555'
                }}
              >
                  <option value="CO">{t.optionCO}</option>
                  <option value="INT">{t.optionINT}</option>
              </select>
          </div>

          <ul style={{listStyle: 'none', padding: 0, lineHeight: '2'}}>
            {t.premiumItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          
          <h3 style={{marginTop: '20px'}}>
              {country === 'CO' ? t.premiumPriceCO : t.premiumPriceINT}
          </h3>
          
          <div style={{margin: '20px 0', textAlign: 'left'}}>
              <label style={{display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc'}}>
                  {t.emailLabel}
              </label>
              <input 
                  type="email" 
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={showBrick || !!user.uid}
                  style={{
                      width: '100%', 
                      padding: '10px', 
                      borderRadius: '5px', 
                      border: '1px solid #555',
                      background: !!user.uid ? '#333' : '#222',
                      color: !!user.uid ? '#aaa' : '#fff',
                      cursor: !!user.uid ? 'not-allowed' : 'text'
                  }}
              />
              {user.uid && <div style={{fontSize: '0.8rem', color: '#00d2ff', marginTop: '5px'}}>
                  {lang === 'es' ? 'Sesión iniciada con Google' : 'Logged in with Google'}
              </div>}
          </div>

          {/* PAYMENT OPTIONS */}
          {country === 'CO' ? (
              // MERCADO PAGO
              !showBrick ? (
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
                        {loading ? t.processingLabel : t.buyLabel}
                      </button>
                  </>
              ) : (
                  <div style={{marginTop: '20px'}}>
                      <p style={{color: '#ccc', marginBottom: '10px'}}>{t.loadingLabel}</p>
                      <Payment
                          initialization={initialization}
                          customization={customization}
                          onSubmit={handleBrickSubmit}
                      />
                      <button 
                        onClick={() => setShowBrick(false)}
                        style={{marginTop: '10px', background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', textDecoration: 'underline'}}
                      >
                        {lang === 'es' ? 'Cancelar / Cambiar método' : 'Cancel / Change method'}
                      </button>
                  </div>
              )
          ) : (
              // PAYPAL
              <div style={{marginTop: '20px'}}>
                  <div id="paypal-container-8M45H2NRA2N92"></div>
                  <p style={{fontSize: '0.8rem', color: '#aaa', marginTop: '10px'}}>
                      {t.paypalNote}
                  </p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
