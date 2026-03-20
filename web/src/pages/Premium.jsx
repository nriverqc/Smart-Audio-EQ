import React, { useState, useContext, useEffect } from 'react';
import { UserContext } from '../App';

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

export default function Premium({ lang }) {
  const { user, refreshUser, loginWithGoogle, requestExtensionAppPassCheck, loading: refreshing } = useContext(UserContext);
  const [loading, setLoading] = useState(false); // Paddle loading
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [planType, setPlanType] = useState('yearly');

  useEffect(() => {
    // Handle redirect from extension trial button
    const params = new URLSearchParams(window.location.search);
    if (params.get('plan') === 'monthly') {
        setPlanType('monthly');
    }
  }, []);
  const displayPrices = { monthly: '$1.59 USD', yearly: '$9.99 USD' };
  const trialPrices = { monthly: '$0.00 USD' };
  const oldPrices = { monthly: '$2.29 USD', yearly: '$19.99 USD' };
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

  const texts = {
    es: {
      title: 'Desbloquea toda la potencia',
      subtitle: 'Elige el plan que mejor se adapte a ti.',
      freeTitle: 'Gratis',
      freePrice: '$0 / para siempre',
      premiumTitle: 'Premium 💎',
      premiumPriceINT_Monthly: displayPrices.monthly + ' / mes (Prueba 3 días GRATIS)',
      premiumPriceINT_Yearly: displayPrices.yearly + ' / año (50% DCTO)',
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
        '✨ Ecualizador Profesional de 15 bandas',
        '✨ Presets Personalizados Ilimitados',
        '✨ Presets Pro (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Control independiente por pestaña',
        '✨ Sin anuncios molestos (Ad-Free) 🚫',
        '✨ Soporte Técnico Prioritario',
        '✨ Acceso anticipado a nuevas funciones',
        '✨ Badge Premium exclusivo en la extensión'
      ],
      processingLabel: 'Procesando...',
      loadingLabel: 'Cargando formulario de pago...',
      emailLabel: 'Ingresa tu email de Google (para activar Premium)',
      emailPlaceholder: 'tu.email@gmail.com',
      successMessage: '¡Pago exitoso! Tu licencia Premium ha sido activada.',
      errorMessage: 'Hubo un error al procesar el pago.',
      planLabel: 'Selecciona tu plan:',
      optionMonthly: 'Mensual (30% DCTO)',
      optionYearly: 'Anual (Ahorra 51%)',
      comingSoon: 'Suscripción Premium',
      comingSoonMsg: 'Obtén acceso a todas las funciones Pro de forma inmediata.'
    },
    en: {
      title: 'Unlock the full power',
      subtitle: 'Choose the plan that suits you best.',
      freeTitle: 'Free',
      freePrice: '$0 / forever',
      premiumTitle: 'Premium 💎',
      premiumPriceINT_Monthly: displayPrices.monthly + ' / mo (3-day FREE Trial)',
      premiumPriceINT_Yearly: displayPrices.yearly + ' / year (50% OFF)',
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
        '✨ Professional 15-Band Equalizer',
        '✨ Unlimited Custom Presets',
        '✨ Pro Presets (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Independent control per tab',
        '✨ No annoying ads (Ad-Free) 🚫',
        '✨ Priority Support',
        '✨ Early access to new features',
        '✨ Exclusive Premium Badge in extension'
      ],
      processingLabel: 'Processing...',
      loadingLabel: 'Loading payment form...',
      emailLabel: 'Enter your Google Email (to activate Premium)',
      emailPlaceholder: 'your.email@gmail.com',
      successMessage: 'Payment successful! Your Premium license has been activated.',
      errorMessage: 'There was an error processing the payment.',
      planLabel: 'Select your plan:',
      optionMonthly: 'Monthly (30% OFF)',
      optionYearly: 'Yearly (Save 51%)',
      comingSoon: 'Premium Subscription',
      comingSoonMsg: 'Get access to all Pro features immediately.'
    },
    pt: {
      title: 'Desbloqueie todo o poder',
      subtitle: 'Escolha o plano que melhor se adapta a você.',
      freeTitle: 'Grátis',
      freePrice: '$0 / para siempre',
      premiumTitle: 'Premium 💎',
      premiumPriceINT_Monthly: displayPrices.monthly + ' / mês (Teste 3 dias GRÁTIS)',
      premiumPriceINT_Yearly: displayPrices.yearly + ' / ano (50% OFF)',
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
        '✨ Equalizador Profissional de 15 bandas',
        '✨ Presets Personalizados Ilimitados',
        '✨ Presets Pro (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Controle independente por aba',
        '✨ Sem anúncios irritantes (Ad-Free) 🚫',
        '✨ Suporte Técnico Prioritário',
        '✨ Acesso antecipado a nuevas funções',
        '✨ Badge Premium exclusivo na extensão'
      ],
      processingLabel: 'Processando...',
      loadingLabel: 'Carregando formulário de pagamento...',
      emailLabel: 'Insira seu e-mail do Google (para activar o Premium)',
      emailPlaceholder: 'seu.email@gmail.com',
      successMessage: 'Pagamento bem-sucedido! Sua licença Premium foi ativada.',
      errorMessage: 'Houve um erro ao processar o pagamento.',
      planLabel: 'Selecione seu plano:',
      optionMonthly: 'Mensal (30% OFF)',
      optionYearly: 'Anual (Economize 51%)',
      comingSoon: 'Assinatura Premium',
      comingSoonMsg: 'Obtenha acesso a todos os recursos Pro imediatamente.'
    },
    de: {
      title: 'Schalte die volle Leistung frei',
      subtitle: 'Wählen Sie den Plan, der am besten zu Ihnen passt.',
      freeTitle: 'Kostenlos',
      freePrice: '$0 / für immer',
      premiumTitle: 'Premium 💎',
      premiumPriceINT_Monthly: displayPrices.monthly + ' / Monat (3 Tage KOSTENLOS)',
      premiumPriceINT_Yearly: displayPrices.yearly + ' / Jahr (50% RABATT)',
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
        '✨ Professioneller 15-Band Equalizer',
        '✨ Unbegrenzte benutzerdefinierte Presets',
        '✨ Pro-Presets (Bass Extreme, Cinema 3D, Gaming)',
        '✨ Unabhängige Steuerung pro Tab',
        '✨ Keine nervige Werbung (Ad-Free) 🚫',
        '✨ Prioritärer technischer Support',
        '✨ Vorabzugang zu neuen Funktionen',
        '✨ Exklusives Premium-Badge in der Erweiterung'
      ],
      processingLabel: 'Wird verarbeitet...',
      loadingLabel: 'Zahlungsformular wird geladen...',
      emailLabel: 'Geben Sie Ihre Google-E-Mail ein (um Premium zu aktivieren)',
      emailPlaceholder: 'ihre.email@gmail.com',
      successMessage: 'Zahlung erfolgreich! Ihre Premium-Lizenz wurde aktiviert.',
      errorMessage: 'Beim Verarbeiten der Zahlung ist ein Fehler aufgetreten.',
      planLabel: 'Wählen Sie Ihren Plan:',
      optionMonthly: 'Monatlich (30% RABATT)',
      optionYearly: 'Jährlich (Sparen Sie 51%)',
      comingSoon: 'Premium-Abonnement',
      comingSoonMsg: 'Erhalten Sie sofortigen Zugriff auf alle Pro-Funktionen.'
    },
  };

  const t = texts[lang] || texts.es;

  const openPaddleCheckout = (priceId) => {
    if (!priceId) {
        alert("Error: Price ID is missing.");
        return;
    }
    
    const cleanPriceId = String(priceId).trim().replace(/\s/g, '');
    const timestamp = new Date().toISOString();
    
    console.log(`[Paddle Debug] Opening checkout for: ${cleanPriceId}`);

    if (!user || !user.email) {
        alert(lang === 'es' ? 'Por favor inicia sesión con Google primero para activar tu cuenta tras el pago.' : 'Please login with Google first to activate your account after payment.');
        loginWithGoogle();
        return;
    }

    if (window.Paddle) {
        try {
            // window.Paddle.Environment.set('production'); // Default is production
            window.Paddle.Checkout.open({
                settings: {
                    displayMode: "overlay",
                    theme: "dark",
                    locale: lang === 'es' ? 'es' : 'en',
                    allowDiscountRemoval: true
                },
                items: [
                    {
                        priceId: cleanPriceId,
                        quantity: 1
                    }
                ],
                customer: {
                    email: String(user.email).trim()
                },
                customData: {
                    uid: String(user.uid || "").trim(),
                    email: String(user.email || "").trim(),
                    debug_ts: timestamp
                }
            });
        } catch (err) {
            console.error("Paddle SDK runtime error:", err);
            alert("Error: " + err.message);
        }
    } else {
        alert("Paddle SDK not loaded. Please refresh.");
    }
  };

  // Expose to window for console testing
  useEffect(() => {
    window.testPaddle = (id) => openPaddleCheckout(id || 'pri_01kk2ntgc0py83xjw60tnw7x2c');
  }, [user]);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreId, setRestoreId] = useState('');
  const [restoreEmail, setRestoreEmail] = useState('');

  const restorePurchase = async () => {
      if (!user.email) {
          alert(lang === 'es' ? 'Por favor inicia sesión primero.' : 'Please login first.');
          return;
      }

      setLoading(true);
      try {
          const res = await fetch(`${API_BASE}/restore-purchase`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  email: user.email, 
                  uid: user.uid,
                  payer_email: restoreEmail ? restoreEmail.trim() : null,
                  payment_id: restoreId ? restoreId.trim() : null
              })
          });
          const data = await res.json();
          if (data.status === 'restored') {
              alert(data.message);
              setShowRestoreModal(false);
              refreshUser();
          } else if (data.status === 'not_found') {
              alert(data.message || (lang === 'es' ? 'No se encontraron pagos aprobados con esos datos.' : 'No approved payments found with those details.'));
          } else {
              alert('Error: ' + (data.error || 'Unknown'));
          }
      } catch (e) {
          console.error(e);
          alert('Error restoring purchase');
      } finally {
          setLoading(true); // Wait for refresh
          setTimeout(() => setLoading(false), 2000);
      }
  };

  /* REMOVED LEGACY BRICK LOGIC */

  const getThanksMessage = () => {
      const method = user.method || '';
      const status = user.status || '';
      
      if (status === 'trialing') {
          return lang === 'es' 
            ? '¡Tu prueba gratuita de 3 días está activa! 🎁' 
            : 'Your 3-day free trial is active! 🎁';
      }
      
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
    <div style={{textAlign: 'center', padding: '20px 10px', maxWidth: '1200px', margin: '0 auto'}}>
      <style>{`
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(0, 255, 133, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(0, 255, 133, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 255, 133, 0); }
        }
        .pulse-btn {
          animation: pulse-green 2s infinite;
        }
      `}</style>
      {user.isPremium && (
          <div style={{marginBottom: '30px', padding: '15px', background: 'rgba(0, 210, 255, 0.1)', borderRadius: '10px', border: '1px solid #00d2ff', display: 'inline-block'}}>
              <h1 style={{color: '#ffd700', fontSize: '2rem', margin: 0}}>Premium 💎 {lang === 'es' ? 'Activado' : 'Active'}</h1>
              <p style={{fontSize: '1rem', marginTop: '5px'}}>
                  {getThanksMessage()}
              </p>
              <p style={{color: '#ccc', marginTop: '5px', fontSize: '0.9rem'}}>
                  {lang === 'es' 
                    ? `Licencia activa para: ${user.email}` 
                    : `License active for: ${user.email}`}
              </p>
          </div>
      )}

      <h1 style={{color: '#ffd700', fontSize: '2.5rem', marginBottom: '10px'}}>
        {t.title}
        <span className="beta-badge" style={{fontSize: '0.4em', verticalAlign: 'middle', marginLeft: '15px'}}>BETA</span>
      </h1>
      <p style={{fontSize: '1.1rem', marginBottom: '30px', color: '#aaa'}}>{t.subtitle}</p>

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

      <div style={{
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '30px', 
        alignItems: 'start',
        justifyContent: 'center'
      }}>
        {/* FREE PLAN */}
        <div className="feature-card" style={{border: '1px solid #333', textAlign: 'left', background: '#1a1a1a', height: '100%'}}>
          <h2 style={{fontSize: '1.8rem', marginBottom: '10px'}}>{t.freeTitle}</h2>
          <h3 style={{color: '#aaa', fontSize: '1.2rem', marginBottom: '20px'}}>{t.freePrice}</h3>
          <ul style={{listStyle: 'none', padding: 0, lineHeight: '2.2', fontSize: '0.95rem'}}>
            {t.freeItems.map((item) => (
              <li key={item} style={{borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px'}}>{item}</li>
            ))}
          </ul>
        </div>

        {/* PREMIUM PLAN */}
        <div className="feature-card" style={{
            border: '2px solid #ffd700', 
            textAlign: 'left', 
            background: '#1a1a1a', 
            position: 'relative',
            boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)'
        }}>
          <div style={{
              position: 'absolute', 
              top: '-12px', 
              right: '20px', 
              background: '#ffd700', 
              color: '#000', 
              padding: '2px 10px', 
              borderRadius: '5px', 
              fontWeight: 'bold', 
              fontSize: '0.8rem'
          }}>
              RECOMMENDED
          </div>

          <h2 style={{color: '#ffd700', fontSize: '2rem', margin: '0 0 10px 0'}}>
            {t.premiumTitle}
          </h2>

          {/* Plan Selector - ONLY FOR FREE USERS */}
          {!user.isPremium && (
            <div style={{margin: '15px 0'}}>
                <div style={{display: 'flex', gap: '10px', background: '#222', padding: '5px', borderRadius: '8px'}}>
                    <button 
                        onClick={() => setPlanType('monthly')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '5px',
                            background: planType === 'monthly' ? '#00ff85' : 'transparent',
                            color: planType === 'monthly' ? '#000' : '#888',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                        }}
                    >
                        {t.optionMonthly}
                    </button>
                    <button 
                        onClick={() => setPlanType('yearly')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '5px',
                            background: planType === 'yearly' ? '#00ff85' : 'transparent',
                            color: planType === 'yearly' ? '#000' : '#888',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            position: 'relative',
                            transition: 'all 0.2s'
                        }}
                    >
                        {t.optionYearly}
                        <span style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-5px',
                            background: '#ff4444',
                            color: '#fff',
                            fontSize: '0.6rem',
                            padding: '2px 5px',
                            borderRadius: '10px',
                            zIndex: 10
                        }}>50% OFF</span>
                    </button>
                </div>
            </div>
          )}

          <ul style={{listStyle: 'none', padding: 0, lineHeight: '2', fontSize: '0.95rem'}}>
            {t.premiumItems.map((item) => (
              <li key={item} style={{borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px'}}>{item}</li>
            ))}
          </ul>
          
          {!user.isPremium && (
            <div style={{textAlign: 'center', marginBottom: '15px'}}>
                <span style={{
                    textDecoration: 'line-through', 
                    color: '#666', 
                    fontSize: '1.2rem',
                    marginRight: '10px'
                }}>
                    {planType === 'yearly' ? oldPrices.yearly : oldPrices.monthly}
                </span>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <h3 style={{fontSize: '2.2rem', color: '#fff', margin: 0}}>
                        {planType === 'yearly' ? displayPrices.yearly : trialPrices.monthly}
                    </h3>
                    {planType === 'monthly' && (
                        <p style={{color: '#00ff85', fontWeight: 'bold', margin: '5px 0'}}>
                            {lang === 'es' ? 'por 3 días' : 'for 3 days'}
                        </p>
                    )}
                    {planType === 'monthly' && (
                        <p style={{color: '#888', fontSize: '0.9rem', margin: 0}}>
                            {lang === 'es' ? `luego ${displayPrices.monthly} / mes` : `then ${displayPrices.monthly} / mo`}
                        </p>
                    )}
                    {planType === 'yearly' && (
                        <p style={{color: '#888', fontSize: '0.9rem', margin: 0}}>
                            {lang === 'es' ? '/ año' : '/ year'}
                        </p>
                    )}
                </div>
            </div>
          )}

          {!user.isPremium && (
            <div style={{ marginBottom: '20px', marginTop: '10px' }}>
                <button 
                    className="pulse-btn"
                    onClick={() => openPaddleCheckout(planType === 'monthly' ? 'pri_01kk2mvgj2pmjfh0pkjatsv8bf' : 'pri_01kk2mxf0828y5x7p8bky7ch47')}
                    style={{
                        width: '100%',
                        padding: '18px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(90deg, #00ff85, #00c86a)',
                        color: '#000',
                        fontWeight: '900',
                        fontSize: '1.3rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(0, 255, 133, 0.4)',
                        transition: 'all 0.3s',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}
                    onMouseOver={(e) => {
                        e.target.style.transform = 'scale(1.05)';
                        e.target.style.boxShadow = '0 6px 25px rgba(0, 255, 133, 0.6)';
                    }}
                    onMouseOut={(e) => {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.boxShadow = '0 4px 15px rgba(0, 255, 133, 0.4)';
                    }}
                >
                    {lang === 'es' ? '🚀 ¡Obtener Premium Ahora!' : '🚀 Get Premium Now!'}
                </button>
            </div>
          )}
          
          {/* PAYMENT FORM OR ACTIVE STATUS */}
          {!user.isPremium ? (
            <>


              <div style={{margin: '20px 0', textAlign: 'left'}}>
                  <input 
                      type="email" 
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={!!user.uid}
                      style={{
                          width: '100%', 
                          padding: '12px', 
                          borderRadius: '5px', 
                          border: '1px solid #444',
                          background: user.uid ? '#2a2a2a' : '#111',
                          color: user.uid ? '#aaa' : '#fff',
                          cursor: user.uid ? 'not-allowed' : 'text',
                          fontSize: '1rem'
                      }}
                  />
                  {user.uid && <div style={{fontSize: '0.8rem', color: '#00d2ff', marginTop: '5px'}}>
                      {lang === 'es' ? 'Sesión iniciada con Google' : 'Logged in with Google'}
                  </div>}
              </div>

              {/* RESTORE PURCHASE BUTTON */}
              <button 
                  onClick={() => setShowRestoreModal(true)} 
                  disabled={loading}
                  style={{
                      marginTop: '15px', 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#666', 
                      padding: '5px', 
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      width: '100%',
                      textDecoration: 'underline'
                  }}
              >
                  {lang === 'es' ? '¿Ya pagaste? Restaurar compra' : 'Already paid? Restore purchase'}
              </button>

              {/* RESTORE MODAL */}
              {showRestoreModal && (
                  <div style={{
                      position: 'fixed',
                      top: 0, left: 0, right: 0, bottom: 0,
                      background: 'rgba(0,0,0,0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10000,
                      padding: '20px'
                  }}>
                      <div style={{
                          background: '#1a1a1a',
                          border: '1px solid #333',
                          padding: '30px',
                          borderRadius: '15px',
                          maxWidth: '450px',
                          width: '100%',
                          boxShadow: '0 0 40px rgba(0,210,255,0.2)'
                      }}>
                          <h2 style={{color: '#00d2ff', marginBottom: '10px'}}>Restaurar Premium 💎</h2>
                          <p style={{fontSize: '0.9rem', color: '#888', marginBottom: '20px'}}>
                              {lang === 'es' 
                                ? 'Si ya compraste y no aparece como activo, ingresa tu email de pago (Recomendado) o tu ID de suscripción.' 
                                : 'If you already paid and it doesn\'t show as active, enter your payment email (Recommended) or your subscription ID.'}
                          </p>
                          
                          <div style={{marginBottom: '15px', textAlign: 'left'}}>
                              <label style={{fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '5px'}}>
                                  {lang === 'es' ? 'Email con el que pagaste (RECOMENDADO):' : 'Email used for payment (RECOMMENDED):'}
                              </label>
                              <input 
                                  type="email"
                                  placeholder="ejemplo@correo.com"
                                  value={restoreEmail}
                                  onChange={(e) => setRestoreEmail(e.target.value)}
                                  style={{
                                      width: '100%', padding: '12px', borderRadius: '8px', 
                                      background: '#222', border: '1px solid #00ff85', color: '#fff'
                                  }}
                              />
                          </div>

                          <div style={{marginBottom: '20px', textAlign: 'left'}}>
                              <label style={{fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '5px'}}>
                                  {lang === 'es' ? 'O ID de Pago / Suscripción:' : 'Or Payment / Subscription ID:'}
                              </label>
                              <input 
                                  type="text"
                                  placeholder="sub_... o txn_... o P-..."
                                  value={restoreId}
                                  onChange={(e) => setRestoreId(e.target.value)}
                                  style={{
                                      width: '100%', padding: '12px', borderRadius: '8px', 
                                      background: '#222', border: '1px solid #444', color: '#fff'
                                  }}
                              />
                          </div>

                          <div style={{display: 'flex', gap: '10px'}}>
                              <button 
                                  onClick={restorePurchase}
                                  style={{
                                      flex: 2, padding: '12px', borderRadius: '8px', border: 'none',
                                      background: '#00ff85', color: '#000', fontWeight: 'bold', cursor: 'pointer'
                                  }}
                              >
                                  Verificar y Activar
                              </button>
                              <button 
                                  onClick={() => setShowRestoreModal(false)}
                                  style={{
                                      flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #444',
                                      background: 'transparent', color: '#fff', cursor: 'pointer'
                                  }}
                              >
                                  Cancelar
                              </button>
                          </div>
                      </div>
                  </div>
              )}
            </>
          ) : (
            <div style={{marginTop: '20px', textAlign: 'center', padding: '15px', background: 'rgba(0, 255, 133, 0.1)', border: '1px solid #00ff85', borderRadius: '8px'}}>
                <h3 style={{color: '#00ff85', margin: 0, fontSize: '1.2rem'}}>✅ {lang === 'es' ? 'Plan Activo' : 'Active Plan'}</h3>
            </div>
          )}

          {/* Refresh Status Button */}
          <div style={{marginTop: '20px', borderTop: '1px solid #333', paddingTop: '10px', textAlign: 'center'}}>
              <button 
                  onClick={refreshUser}
                  disabled={refreshing}
                  style={{
                      background: 'transparent', 
                      border: '1px solid #444', 
                      color: refreshing ? '#555' : '#888', 
                      padding: '8px 15px', 
                      borderRadius: '5px',
                      cursor: refreshing ? 'not-allowed' : 'pointer',
                      fontSize: '0.8rem',
                      transition: 'all 0.2s'
                  }}
              >
                  {refreshing ? (lang === 'es' ? 'Sincronizando...' : 'Syncing...') : (lang === 'es' ? '↻ Actualizar estado' : '↻ Refresh status')}
              </button>
          </div>

          {/* Adsterra Native Banner - HIDDEN FOR PREMIUM USERS */}
          {!user.isPremium && (
             // Script injection logic will handle this
            <div id="container-98237cf077449f197b6656eb7fccd1dc" style={{marginTop: '20px', minHeight: '250px'}}></div>
          )}

          {!user.isPremium && (
            <script async="async" data-cfasync="false" src="//pl28656732.effectivegatecpm.com/98/23/7c/98237cf077449f197b6656eb7fccd1dc.js"></script>
          )}
        </div>
      </div>
    </div>
  );
}
