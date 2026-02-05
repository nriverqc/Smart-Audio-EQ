import React, { useState, useContext, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { UserContext } from '../App';

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

// Initialize with user's Public Key
// NOTE: VITE_MP_PUBLIC_KEY must be set in your .env file
const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY;
if (MP_PUBLIC_KEY) {
  initMercadoPago(MP_PUBLIC_KEY);
} else {
  console.warn("MercadoPago Public Key not found in env vars");
}

export default function Premium({ lang }) {
  const { user, refreshUser, loginWithGoogle } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [showBrick, setShowBrick] = useState(false);
  const [preferenceId, setPreferenceId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [country, setCountry] = useState('CO'); // 'CO' or 'INT'
  const [sdkReady, setSdkReady] = useState(false); // New state for PayPal SDK
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
      if (country === 'INT') {
          const containerId = "paypal-container-8M45H2NRA2N92";
          
          // Dynamically load PayPal SDK if not already loaded
          if (!window.paypal) {
             const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
             if (!clientId) {
                 console.error("PayPal Client ID not found in env vars");
                 return;
             }
             const script = document.createElement("script");
             script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
             script.async = true;
             script.onload = () => {
                 // Re-trigger effect or handle loading state
                 // For simplicity, we just let the next render cycle or retry pick it up
                 // or manually call a render function. 
                 // Actually, since this effect depends on country, we might need to force update 
                 // or just rely on the script being available now.
                 // A better pattern is to have a separate 'sdkLoaded' state.
                 setSdkReady(true);
             };
             document.body.appendChild(script);
             return; 
          } else {
             setSdkReady(true);
          }

          if (!sdkReady) return; // Wait for SDK

          const container = document.getElementById(containerId);
          if (container && window.paypal) {
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
  }, [country, lang, loginWithGoogle, sdkReady]); // Added sdkReady dependency

  const texts = {
    es: {
      title: 'Desbloquea toda la potencia',
      subtitle: 'Pago único. Acceso de por vida.',
      freeTitle: 'Gratis',
      freePrice: '$0 / para siempre',
      premiumTitle: 'Premium 💎',
      premiumPriceCO: '$20.000 COP / de por vida',
      premiumPriceINT: '$4.99 USD / lifetime',
      freeItems: [
        '✅ Ecualizador de 6 bandas',
        '✅ Presets básicos (Flat, Rock, Pop, etc.)',
        '✅ Boost de volumen (hasta 300%)',
        '✅ Visualizador de espectro',
        '✅ Funciona en todas las webs (YouTube, Spotify...)',
        '✅ Sin necesidad de registro'
      ],
      premiumItems: [
        '✨ Todo lo del plan Gratis',
        '✨ Presets Personalizados Ilimitados',
        '✨ Presets Pro (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Sincronización en la Nube (Tus presets en todos lados)',
        '✨ Soporte Técnico Prioritario',
        '✨ Acceso anticipado a nuevas funciones',
        '✨ Sin anuncios / Experiencia limpia',
        '✨ Badge Premium exclusivo',
        '✨ Cualquier integración a la extensión'
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
      freeItems: [
        '✅ 6-Band Equalizer',
        '✅ Basic presets (Flat, Rock, Pop, etc.)',
        '✅ Volume Boost (up to 300%)',
        '✅ Spectrum Visualizer',
        '✅ Works on all sites (YouTube, Spotify...)',
        '✅ No registration required'
      ],
      premiumItems: [
        '✨ Everything in Free plan',
        '✨ Unlimited Custom Presets',
        '✨ Pro Presets (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Cloud Sync (Your presets everywhere)',
        '✨ Priority Support',
        '✨ Early access to new features',
        '✨ Ad-free / Clean experience',
        '✨ Exclusive Premium Badge',
        '✨ Any extension integration'
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
    amount: 20000,
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

  return (
    <div style={{textAlign: 'center', padding: '50px 0'}}>
      {user.isPremium && (
          <div style={{marginBottom: '50px', padding: '20px', background: 'rgba(0, 210, 255, 0.1)', borderRadius: '10px', border: '1px solid #00d2ff', display: 'inline-block'}}>
              <h1 style={{color: '#ffd700', fontSize: '2.5rem', margin: 0}}>Premium 💎 {lang === 'es' ? 'Activado' : 'Active'}</h1>
              <p style={{fontSize: '1.2rem', marginTop: '10px'}}>
                  {lang === 'es' ? '¡Gracias por tu compra!' : 'Thank you for your purchase!'}
              </p>
              <p style={{color: '#ccc', marginTop: '5px'}}>
                  {lang === 'es' 
                    ? `Licencia activa para: ${user.email}` 
                    : `License active for: ${user.email}`}
              </p>
          </div>
      )}

      <h1 style={{color: '#ffd700', fontSize: '3rem'}}>
        {t.title}
        <span className="beta-badge" style={{fontSize: '0.4em', verticalAlign: 'middle', marginLeft: '15px'}}>BETA</span>
      </h1>
      <p style={{fontSize: '1.2rem', marginBottom: '40px'}}>{t.subtitle}</p>

      {/* Sandbox Warning */}
      {!user.isPremium && import.meta.env.VITE_MP_PUBLIC_KEY && import.meta.env.VITE_MP_PUBLIC_KEY.includes('TEST') && (
        <div style={{background: '#ffeb3b', color: '#000', padding: '10px', marginBottom: '20px', borderRadius: '5px', display: 'inline-block'}}>
            <strong>MODO PRUEBA (Sandbox):</strong> Usa tarjetas de prueba. 
            <br/>Nombre del titular: <b>APRO</b> (para aprobar)
        </div>
      )}

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
          <h2 style={{color: '#ffd700'}}>
            {t.premiumTitle}
            <span className="beta-badge" style={{fontSize: '0.5em', verticalAlign: 'middle', marginLeft: '10px'}}>BETA</span>
          </h2>
          
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
          
          {/* PAYMENT FORM OR ACTIVE STATUS */}
          {!user.isPremium ? (
            <>
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
            </>
          ) : (
            <div style={{marginTop: '30px', textAlign: 'center', padding: '20px', background: 'rgba(0, 255, 133, 0.1)', border: '1px solid #00ff85', borderRadius: '8px'}}>
                <h3 style={{color: '#00ff85', margin: 0}}>✅ {lang === 'es' ? 'Plan Activo' : 'Active Plan'}</h3>
                <p style={{color: '#ccc', fontSize: '0.9rem', marginTop: '10px'}}>
                    {lang === 'es' ? 'Disfruta de todas las funciones Premium.' : 'Enjoy all Premium features.'}
                </p>
            </div>
          )}

          {/* Refresh Status Button */}
          <div style={{marginTop: '30px', borderTop: '1px solid #333', paddingTop: '15px'}}>
              <p style={{fontSize: '0.9rem', color: '#ccc', marginBottom: '10px'}}>
                  {lang === 'es' ? '¿Ya eres Premium?' : 'Already Premium?'}
              </p>
              <button 
                  onClick={() => {
                      setLoading(true);
                      refreshUser();
                      setTimeout(() => setLoading(false), 2000);
                  }}
                  style={{
                      background: 'transparent', 
                      border: '1px solid #ffd700', 
                      color: '#ffd700', 
                      padding: '8px 15px', 
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                  }}
              >
                  {lang === 'es' ? 'Haz clic aquí para actualizar' : 'Click here to refresh status'}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
