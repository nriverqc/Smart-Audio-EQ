import React, { useState, useContext, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { UserContext } from '../App';

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

// Initialize with user's Public Key
// NOTE: VITE_MP_PUBLIC_KEY must be set in your .env file
const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY;
if (MP_PUBLIC_KEY) {
  try {
    initMercadoPago(MP_PUBLIC_KEY);
  } catch (e) {
    console.error("Failed to initialize MercadoPago", e);
  }
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
             // Add intent=subscription and vault=true for Subscription flow
             script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=subscription&vault=true`;
             script.async = true;
             script.onload = () => {
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
                          if (!paypalPlans[planType]) {
                              alert("Error: PayPal Plan ID not loaded. Please refresh.");
                              return actions.reject();
                          }
                          return actions.resolve();
                      },
                      createSubscription: (data, actions) => {
                          const currentUser = userRef.current;
                          return actions.subscription.create({
                              'plan_id': paypalPlans[planType],
                              'custom_id': currentUser.uid
                          });
                      },
                      onApprove: (data, actions) => {
                          console.log("PayPal Subscription Approved:", data);
                          setLoading(true);
                          
                          // Register license in backend
                          fetch(`${API_BASE}/register-paypal`, {
                              method: 'POST',
                              headers: {'Content-Type': 'application/json'},
                              body: JSON.stringify({
                                  email: userRef.current.email,
                                  uid: userRef.current.uid,
                                  subscriptionID: data.subscriptionID,
                                  orderID: data.orderID, // Just in case
                                  plan_type: planType
                              })
                          })
                          .then(res => res.json())
                          .then(response => {
                              if (response.status === 'approved' || response.success) {
                                  alert(lang === 'es' ? '¡Suscripción activada! Tu cuenta Premium está lista.' : 'Subscription activated! Your Premium account is ready.');
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
  }, [country, lang, loginWithGoogle, sdkReady, refreshUser, planType]); // Added planType dependency

  const [planType, setPlanType] = useState('monthly'); // 'monthly' or 'yearly'
  const [paypalPlans, setPaypalPlans] = useState({});

  useEffect(() => {
      // Fetch Plans from Backend
      fetch(`${API_BASE}/get-plans`)
          .then(res => res.json())
          .then(data => {
              if (data.paypal) {
                  setPaypalPlans(data.paypal);
              }
          })
          .catch(err => console.error("Error fetching plans:", err));
  }, []);

  const texts = {
    es: {
      title: 'Desbloquea toda la potencia',
      subtitle: 'Elige el plan que mejor se adapte a ti.',
      freeTitle: 'Gratis',
      freePrice: '$0 / para siempre',
      premiumTitle: 'Premium 💎',
      premiumPriceCO_Monthly: '$20.000 COP / mes',
      premiumPriceCO_Yearly: '$204.000 COP / año (Ahorra 15%)',
      premiumPriceINT_Monthly: '$4.99 USD / month',
      premiumPriceINT_Yearly: '$49.99 USD / year',
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
      planLabel: 'Selecciona tu plan:',
      optionCO: '🇨🇴 Colombia (MercadoPago)',
      optionINT: '🌍 Resto del Mundo (PayPal)',
      optionMonthly: 'Mensual',
      optionYearly: 'Anual (Ahorra 15%)',
      paypalNote: 'Nota: Después de pagar en PayPal, tu cuenta se activará automáticamente en unos minutos. Si no, contáctanos.'
    },
    en: {
      title: 'Unlock the full power',
      subtitle: 'Choose the plan that suits you best.',
      freeTitle: 'Free',
      freePrice: '$0 / forever',
      premiumTitle: 'Premium 💎',
      premiumPriceCO_Monthly: '$20.000 COP / month',
      premiumPriceCO_Yearly: '$204.000 COP / year (Save 15%)',
      premiumPriceINT_Monthly: '$4.99 USD / month',
      premiumPriceINT_Yearly: '$49.99 USD / year',
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
      planLabel: 'Select your plan:',
      optionCO: '🇨🇴 Colombia (MercadoPago)',
      optionINT: '🌍 Rest of World (PayPal)',
      optionMonthly: 'Monthly',
      optionYearly: 'Yearly (Save 15%)',
      paypalNote: 'Note: After paying on PayPal, your account will be activated automatically within a few minutes. If not, contact us.'
    },
  };

  const t = texts[lang] || texts.es;

  const restorePurchase = async () => {
      if (!user.email) {
          alert(lang === 'es' ? 'Por favor inicia sesión primero.' : 'Please login first.');
          return;
      }

      // Ask user for alternate email or payment ID
      const paymentIdInput = prompt(lang === 'es' 
          ? '¿Tienes el ID de la operación (Pago)? Si es así, ingrésalo aquí. Si no, déjalo vacío.' 
          : 'Do you have the Operation ID (Payment ID)? If so, enter it here. If not, leave blank.');
      
      let payerEmailInput = '';
      if (!paymentIdInput) {
           payerEmailInput = prompt(lang === 'es'
              ? `¿Pagaste con un email diferente a ${user.email}? Ingrésalo aquí. (Deja vacío para usar tu email actual)`
              : `Did you pay with a different email than ${user.email}? Enter it here. (Leave blank to use current email)`);
      }

      setLoading(true);
      try {
          const res = await fetch(`${API_BASE}/restore-purchase`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  email: user.email, 
                  uid: user.uid,
                  payer_email: payerEmailInput ? payerEmailInput.trim() : null,
                  payment_id: paymentIdInput ? paymentIdInput.trim() : null
              })
          });
          const data = await res.json();
          if (data.status === 'restored') {
              alert(data.message);
              refreshUser();
          } else if (data.status === 'not_found') {
              alert(lang === 'es' ? 'No se encontraron pagos aprobados con esos datos.' : 'No approved payments found with those details.');
          } else {
              alert('Error: ' + (data.error || 'Unknown'));
          }
      } catch (e) {
          console.error(e);
          alert('Error restoring purchase');
      } finally {
          setLoading(false);
      }
  };

  const createMPSubscription = async () => {
    if (!user.uid) {
        alert(lang === 'es' ? 'Por favor inicia sesión primero.' : 'Please login first.');
        loginWithGoogle();
        return;
    }
    
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/create-mp-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                uid: user.uid,
                plan_type: planType
            })
        });
        const data = await res.json();
        if (data.init_point) {
            window.location.href = data.init_point;
        } else {
            alert('Error creating subscription: ' + (data.error || 'Unknown'));
        }
    } catch (e) {
        console.error(e);
        alert('Network error');
    } finally {
        setLoading(false);
    }
  };

  /* REMOVED LEGACY BRICK LOGIC */

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
          
          {/* Plan Selector */}
          <div style={{margin: '10px 0'}}>
              <label style={{display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc'}}>{t.planLabel}</label>
              <div style={{display: 'flex', gap: '10px'}}>
                  <button 
                      onClick={() => { setPlanType('monthly'); setShowBrick(false); }}
                      style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '5px',
                          background: planType === 'monthly' ? '#ffd700' : '#222',
                          color: planType === 'monthly' ? '#000' : '#fff',
                          border: '1px solid #555',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                      }}
                  >
                      {t.optionMonthly}
                  </button>
                  <button 
                      onClick={() => { setPlanType('yearly'); setShowBrick(false); }}
                      style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '5px',
                          background: planType === 'yearly' ? '#ffd700' : '#222',
                          color: planType === 'yearly' ? '#000' : '#fff',
                          border: '1px solid #555',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                      }}
                  >
                      {t.optionYearly}
                  </button>
              </div>
          </div>

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
              {country === 'CO' 
                  ? (planType === 'yearly' ? t.premiumPriceCO_Yearly : t.premiumPriceCO_Monthly)
                  : (planType === 'yearly' ? t.premiumPriceINT_Yearly : t.premiumPriceINT_Monthly)
              }
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
                          background: user.uid ? '#333' : '#222',
                          color: user.uid ? '#aaa' : '#fff',
                          cursor: user.uid ? 'not-allowed' : 'text'
                      }}
                  />
                  {user.uid && <div style={{fontSize: '0.8rem', color: '#00d2ff', marginTop: '5px'}}>
                      {lang === 'es' ? 'Sesión iniciada con Google' : 'Logged in with Google'}
                  </div>}
              </div>

              {/* PAYMENT OPTIONS */}
              {country === 'CO' ? (
                <button 
                  className="cta-button" 
                  onClick={createMPSubscription} 
                  disabled={loading}
                  style={{
                      background: '#009ee3', 
                      color: 'white', 
                      padding: '15px 30px', 
                      border: 'none', 
                      borderRadius: '5px', 
                      fontSize: '1.2rem', 
                      cursor: 'pointer', 
                      fontWeight: 'bold',
                      boxShadow: '0 4px 15px rgba(0, 158, 227, 0.4)',
                      width: '100%',
                      marginTop: '10px'
                  }}
                >
                  {loading ? t.processingLabel : (lang === 'es' ? 'Suscribirse con MercadoPago' : 'Subscribe with MercadoPago')}
                </button>
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
