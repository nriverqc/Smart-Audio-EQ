import React, { useState, useContext, useEffect } from 'react';
import { UserContext } from '../App';

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

export default function Premium({ lang }) {
  const { user, refreshUser, loginWithGoogle, requestExtensionAppPassCheck } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [appPassCode, setAppPassCode] = useState('');
  const [sdkReady, setSdkReady] = useState(false); // New state for PayPal SDK
  const [planType, setPlanType] = useState('monthly'); // 'monthly' or 'yearly'
  const [paypalPlans, setPaypalPlans] = useState({});
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

  const [paypalClientId, setPaypalClientId] = useState('');

  useEffect(() => {
      // Fetch Plans and Config from Backend
      fetch(`${API_BASE}/get-plans`)
          .then(res => res.json())
          .then(data => {
              if (data.paypal) {
                  setPaypalPlans(data.paypal);
              }
              if (data.paypal_client_id) {
                  setPaypalClientId(data.paypal_client_id);
              }
              if (data.paypal_mode === 'sandbox') {
                  console.log("⚠️ Running in PayPal SANDBOX Mode");
              }
          })
          .catch(err => console.error("Error fetching plans:", err));
  }, []);

  // PayPal Effect
  useEffect(() => {
      const containerId = "paypal-button-container";
      
      // 1. Wait for Client ID and Plans
      if (!paypalClientId || (!paypalPlans.monthly && !paypalPlans.yearly)) return;
      
      // 2. Load SDK if not present
      if (!window.paypal && !document.getElementById('paypal-sdk-script')) {
          const script = document.createElement("script");
          script.id = 'paypal-sdk-script';
          // Add cache buster v=1.0.7
          script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&vault=true&intent=subscription&v=1.0.7`;
          script.setAttribute('data-sdk-integration-source', 'button-factory');
          script.async = true;
          script.onload = () => setSdkReady(true);
          script.onerror = () => setErrorMsg("Error loading PayPal SDK.");
          document.body.appendChild(script);
      } else if (window.paypal) {
          setSdkReady(true);
      }

      // 3. Wait for SDK Ready
      if (!sdkReady || !window.paypal) return;
      
      // Fallback plans if backend hasn't responded yet (Only for Production Fallback)
      const currentPlans = {
          monthly: paypalPlans.monthly,
          yearly: paypalPlans.yearly
      };

      const planId = currentPlans[planType];
      const container = document.getElementById(containerId);

      if (container && planId) {
          container.innerHTML = ""; // Clear
          try {
              window.paypal.Buttons({
                  style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
                  onClick: (data, actions) => {
                      if (!userRef.current?.uid) {
                          alert(lang === 'es' ? 'Por favor inicia sesión primero.' : 'Please login first.');
                          loginWithGoogle();
                          return actions.reject();
                      }
                      return actions.resolve();
                  },
                  createSubscription: (data, actions) => {
                      return actions.subscription.create({
                          'plan_id': planId,
                          'custom_id': userRef.current.uid || "GUEST"
                      });
                  },
                  onApprove: (data, actions) => {
                      setLoading(true);
                      fetch(`${API_BASE}/register-paypal`, {
                          method: 'POST',
                          headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({
                              email: userRef.current.email,
                              uid: userRef.current.uid,
                              subscriptionID: data.subscriptionID,
                              plan_type: planType
                          })
                      })
                      .then(res => res.json())
                      .then(response => {
                          if (response.status === 'approved' || response.success) {
                              alert(lang === 'es' ? '¡Suscripción activada!' : 'Subscription activated!');
                              refreshUser();
                          }
                      })
                      .finally(() => setLoading(false));
                  },
                  onError: (err) => {
                      console.error("PayPal Error:", err);
                      if (!err.message?.includes("render")) {
                          setErrorMsg("PayPal check error. Please refresh.");
                      }
                  }
              }).render("#" + containerId);
          } catch (e) {
              console.error("PayPal Buttons Error:", e);
          }
      }
  }, [lang, sdkReady, planType, paypalPlans, loginWithGoogle, refreshUser, paypalClientId]);

  const texts = {
    es: {
      title: 'Desbloquea toda la potencia',
      subtitle: 'Elige el plan que mejor se adapte a ti.',
      freeTitle: 'Gratis',
      freePrice: '$0 / para siempre',
      premiumTitle: 'Premium 💎',
      premiumPriceINT_Monthly: '$0.99 1er mes, luego $1.99/mes',
      premiumPriceINT_Yearly: '$16.99 USD / año (30% DCTO)',
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
        '✨ Ecualizador de 15 bandas',
        '✨ Presets Personalizados Ilimitados',
        '✨ Presets Pro (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Sincronización en la Nube (Tus presets en todos lados)',
        '✨ Soporte Técnico Prioritario',
        '✨ Acceso anticipado a nuevas funciones',
        '✨ Sin anuncios / Experiencia limpia',
        '✨ Badge Premium exclusivo',
        '✨ Cualquier integración a la extensión'
      ],
      buyLabel: 'Pagar con PayPal',
      processingLabel: 'Procesando...',
      loadingLabel: 'Cargando formulario de pago...',
      emailLabel: 'Ingresa tu email de Google (para activar Premium)',
      emailPlaceholder: 'tu.email@gmail.com',
      successMessage: '¡Pago exitoso! Tu licencia Premium ha sido activada.',
      errorMessage: 'Hubo un error al procesar el pago.',
      planLabel: 'Selecciona tu plan:',
      optionMonthly: 'Mensual',
      optionYearly: 'Anual (Ahorra más del 15%)',
      paypalNote: 'Nota: Después de pagar en PayPal, tu cuenta se activará automáticamente en unos minutos. Si no, contáctanos.',
      appPassLabel: 'App Pass (Oficial):',
      appPassBtnAuto: 'Verificar automáticamente desde la extensión',
      appPassManualLabel: '¿Tienes un código promocional o manual?',
      appPassPlaceholder: 'CÓDIGO-PROMO',
      appPassBtn: 'Activar código'
    },
    en: {
      title: 'Unlock the full power',
      subtitle: 'Choose the plan that suits you best.',
      freeTitle: 'Free',
      freePrice: '$0 / forever',
      premiumTitle: 'Premium 💎',
      premiumPriceINT_Monthly: '$0.99 1st month, then $1.99/mo',
      premiumPriceINT_Yearly: '$16.99 USD / year (30% OFF)',
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
        '✨ 15-Band Equalizer',
        '✨ Unlimited Custom Presets',
        '✨ Pro Presets (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Cloud Sync (Your presets everywhere)',
        '✨ Priority Support',
        '✨ Early access to new features',
        '✨ Ad-free / Clean experience',
        '✨ Exclusive Premium Badge',
        '✨ Any extension integration'
      ],
      buyLabel: 'Pay with PayPal',
      processingLabel: 'Processing...',
      loadingLabel: 'Loading payment form...',
      emailLabel: 'Enter your Google Email (to activate Premium)',
      emailPlaceholder: 'your.email@gmail.com',
      successMessage: 'Payment successful! Your Premium license has been activated.',
      errorMessage: 'There was an error processing the payment.',
      planLabel: 'Select your plan:',
      optionMonthly: 'Monthly',
      optionYearly: 'Yearly (Save more than 15%)',
      paypalNote: 'Note: After paying on PayPal, your account will be activated automatically within a few minutes. If not, contact us.',
      appPassLabel: 'App Pass (Official):',
      appPassBtnAuto: 'Verify automatically via extension',
      appPassManualLabel: 'Have a promo or manual code?',
      appPassPlaceholder: 'PROMO-CODE',
      appPassBtn: 'Activate code'
    },
    pt: {
      title: 'Desbloqueie todo o poder',
      subtitle: 'Escolha o plano que melhor se adapta a você.',
      freeTitle: 'Grátis',
      freePrice: '$0 / para sempre',
      premiumTitle: 'Premium 💎',
      premiumPriceINT_Monthly: '$0.99 no 1º mês, depois $1.99/mês',
      premiumPriceINT_Yearly: '$16.99 USD / ano (30% OFF)',
      freeItems: [
        '✅ Equalizador de 6 bandas',
        '✅ Presets básicos (Flat, Rock, Pop, etc.)',
        '✅ Boost de volume (até 300%)',
        '✅ Visualizador de espectro',
        '✅ Funciona em todos os sites (YouTube, Spotify...)',
        '✅ Sem necessidade de registro'
      ],
      premiumItems: [
        '✨ Tudo no plano Grátis',
        '✨ Equalizador de 15 bandas',
        '✨ Presets Personalizados Ilimitados',
        '✨ Presets Pro (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Sincronização na Nuvem (Seus presets em todos os lugares)',
        '✨ Suporte Técnico Prioritario',
        '✨ Acesso antecipado a novas funções',
        '✨ Sem anúncios / Experiência limpa',
        '✨ Badge Premium exclusivo',
        '✨ Qualquer integração à extensão'
      ],
      buyLabel: 'Pagar com PayPal',
      processingLabel: 'Processando...',
      loadingLabel: 'Carregando formulário de pagamento...',
      emailLabel: 'Insira seu e-mail do Google (para ativar o Premium)',
      emailPlaceholder: 'seu.email@gmail.com',
      successMessage: 'Pagamento bem-sucedido! Sua licença Premium foi ativada.',
      errorMessage: 'Houve um erro ao processar o pagamento.',
      planLabel: 'Selecione seu plano:',
      optionMonthly: 'Mensal',
      optionYearly: 'Anual (Economize mais de 15%)',
      paypalNote: 'Nota: Após pagar no PayPal, sua conta será ativada automaticamente em alguns minutos. Caso contrário, entre em contato conosco.',
      appPassLabel: 'App Pass (Oficial):',
      appPassBtnAuto: 'Verificar automaticamente via extensão',
      appPassManualLabel: 'Tem um código promocional ou manual?',
      appPassPlaceholder: 'CÓDIGO-PROMO',
      appPassBtn: 'Ativar código'
    },
    de: {
      title: 'Schalte die volle Leistung frei',
      subtitle: 'Wählen Sie den Plan, der am besten zu Ihnen passt.',
      freeTitle: 'Kostenlos',
      freePrice: '$0 / für immer',
      premiumTitle: 'Premium 💎',
      premiumPriceINT_Monthly: '$0.99 im 1. Monat, dann $1.99/Monat',
      premiumPriceINT_Yearly: '$16.99 USD / Jahr (30% RABATT)',
      freeItems: [
        '✅ 6-Band Equalizer',
        '✅ Basis-Presets (Flat, Rock, Pop, etc.)',
        '✅ Volume Boost (bis zu 300%)',
        '✅ Spektrum-Visualisator',
        '✅ Funktioniert auf allen Websites (YouTube, Spotify...)',
        '✅ Keine Registrierung erforderlich'
      ],
      premiumItems: [
        '✨ Alles aus dem kostenlosen Plan',
        '✨ 15-Band Equalizer',
        '✨ Unbegrenzte benutzerdefinierte Presets',
        '✨ Pro-Presets (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Cloud-Synchronisierung (Ihre Presets überall)',
        '✨ Prioritärer technischer Support',
        '✨ Vorabzugang zu neuen Funktionen',
        '✨ Werbefrei / Sauberes Erlebnis',
        '✨ Exklusives Premium-Badge',
        '✨ Jede Erweiterungsintegration'
      ],
      buyLabel: 'Mit PayPal bezahlen',
      processingLabel: 'Wird verarbeitet...',
      loadingLabel: 'Zahlungsformular wird geladen...',
      emailLabel: 'Geben Sie Ihre Google-E-Mail ein (um Premium zu aktivieren)',
      emailPlaceholder: 'ihre.email@gmail.com',
      successMessage: 'Zahlung erfolgreich! Ihre Premium-Lizenz wurde aktiviert.',
      errorMessage: 'Beim Verarbeiten der Zahlung ist ein Fehler aufgetreten.',
      planLabel: 'Wählen Sie Ihren Plan:',
      optionMonthly: 'Monatlich',
      optionYearly: 'Jährlich (Sparen Sie mehr als 15%)',
      paypalNote: 'Hinweis: Nach der Zahlung bei PayPal wird Ihr Konto in wenigen Minuten automatisch aktiviert. Falls nicht, kontaktieren Sie uns.',
      appPassLabel: 'App Pass (Offiziell):',
      appPassBtnAuto: 'Automatisch über Erweiterung verifizieren',
      appPassManualLabel: 'Haben Sie einen Promo- oder manuellen Code?',
      appPassPlaceholder: 'PROMO-CODE',
      appPassBtn: 'Code aktivieren'
    },
  };

  const t = texts[lang] || texts.es;

  const verifyAppPass = async () => {
    if (!user.uid) {
        alert(lang === 'es' ? 'Por favor inicia sesión primero.' : 'Please login first.');
        loginWithGoogle();
        return;
    }
    if (!appPassCode.trim()) {
        alert(lang === 'es' ? 'Por favor ingresa un código.' : 'Please enter a code.');
        return;
    }

    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/verify-app-pass`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                uid: user.uid,
                code: appPassCode.trim()
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert(data.message);
            refreshUser();
        } else {
            alert('Error: ' + (data.error || 'Unknown'));
        }
    } catch (e) {
        console.error(e);
        alert('Network error');
    } finally {
        setLoading(false);
    }
  };

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

  /* REMOVED LEGACY BRICK LOGIC */

  const getThanksMessage = () => {
      const method = user.method || '';
      if (method.includes('Official_App_Pass') || method.includes('App_Pass')) {
          return lang === 'es' ? '¡Gracias por usar App Pass! 🚀' : 'Thanks for using App Pass! 🚀';
      }
      if (method.includes('PayPal')) {
          return lang === 'es' ? '¡Gracias por tu suscripción vía PayPal! 💎' : 'Thanks for your PayPal subscription! 💎';
      }
      if (method.includes('Promo_Code')) {
          return lang === 'es' ? '¡Código promocional activado con éxito! 🎉' : 'Promo code successfully activated! 🎉';
      }
      return lang === 'es' ? '¡Gracias por ser Premium!' : 'Thank you for being Premium!';
  };

  return (
    <div style={{textAlign: 'center', padding: '50px 0'}}>
      {user.isPremium && (
          <div style={{marginBottom: '50px', padding: '20px', background: 'rgba(0, 210, 255, 0.1)', borderRadius: '10px', border: '1px solid #00d2ff', display: 'inline-block'}}>
              <h1 style={{color: '#ffd700', fontSize: '2.5rem', margin: 0}}>Premium 💎 {lang === 'es' ? 'Activado' : 'Active'}</h1>
              <p style={{fontSize: '1.2rem', marginTop: '10px'}}>
                  {getThanksMessage()}
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

      {errorMsg && (
          <div style={{
              background: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid #ff4444',
              color: '#ff4444',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '30px',
              maxWidth: '600px',
              margin: '0 auto 30px'
          }}>
              {errorMsg}
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
          
          {/* Plan Selector */}
          <div style={{margin: '10px 0'}}>
              <label style={{display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc'}}>{t.planLabel}</label>
              <div style={{display: 'flex', gap: '10px'}}>
                  <button 
                      onClick={() => setPlanType('monthly')}
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
                      onClick={() => setPlanType('yearly')}
                      style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '5px',
                          background: planType === 'yearly' ? '#ffd700' : '#222',
                          color: planType === 'yearly' ? '#000' : '#fff',
                          border: '1px solid #555',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          position: 'relative'
                      }}
                  >
                      {t.optionYearly}
                      {planType !== 'yearly' && (
                          <span style={{
                              position: 'absolute',
                              top: '-10px',
                              right: '-5px',
                              background: '#ff4444',
                              color: '#fff',
                              fontSize: '0.6rem',
                              padding: '2px 5px',
                              borderRadius: '10px',
                              border: '1px solid #fff'
                          }}>30% OFF</span>
                      )}
                  </button>
              </div>
          </div>

          <ul style={{listStyle: 'none', padding: 0, lineHeight: '2'}}>
            {t.premiumItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          
          <h3 style={{marginTop: '20px'}}>
              {planType === 'yearly' ? t.premiumPriceINT_Yearly : t.premiumPriceINT_Monthly}
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
                      disabled={!!user.uid}
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

              {/* PAYPAL */}
              <div style={{marginTop: '20px'}}>
                  <div id="paypal-button-container"></div>
                  <p style={{fontSize: '0.8rem', color: '#aaa', marginTop: '10px'}}>
                      {t.paypalNote}
                  </p>
              </div>

              {/* APP PASS SECTION */}
              <div style={{marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px', textAlign: 'left'}}>
                  <label style={{display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: '#00d2ff', fontWeight: 'bold'}}>
                      {t.appPassLabel}
                  </label>
                  <button 
                      onClick={requestExtensionAppPassCheck}
                      disabled={loading}
                      style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '5px',
                          border: 'none',
                          background: 'linear-gradient(45deg, #00d2ff, #00a8cc)',
                          color: '#000',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          marginBottom: '20px'
                      }}
                  >
                      {t.appPassBtnAuto}
                  </button>

                  <label style={{display: 'block', marginBottom: '10px', fontSize: '0.8rem', color: '#aaa'}}>
                      {t.appPassManualLabel}
                  </label>
                  <div style={{display: 'flex', gap: '10px'}}>
                      <input 
                          type="text"
                          placeholder={t.appPassPlaceholder}
                          value={appPassCode}
                          onChange={(e) => setAppPassCode(e.target.value.toUpperCase())}
                          style={{
                              flex: 1,
                              padding: '10px',
                              borderRadius: '5px',
                              border: '1px solid #555',
                              background: '#111',
                              color: '#fff',
                              fontSize: '1rem'
                          }}
                      />
                      <button 
                          onClick={verifyAppPass}
                          disabled={loading}
                          style={{
                              padding: '10px 20px',
                              borderRadius: '5px',
                              border: 'none',
                              background: '#444',
                              color: '#fff',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                          }}
                      >
                          {loading ? t.processingLabel : t.appPassBtn}
                      </button>
                  </div>
              </div>
              
              {/* RESTORE PURCHASE BUTTON */}
              <button 
                  onClick={restorePurchase} 
                  disabled={loading}
                  style={{
                      marginTop: '20px', 
                      background: 'transparent', 
                      border: '1px solid #555', 
                      color: '#ccc', 
                      padding: '10px 15px', 
                      borderRadius: '5px', 
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      width: '100%'
                  }}
              >
                  {lang === 'es' ? '¿Ya pagaste? Ingresar ID de pago' : 'Already paid? Enter Payment ID'}
              </button>
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
