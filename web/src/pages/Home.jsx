import React from 'react';
import { Link } from 'react-router-dom';

export default function Home({ lang }) {
  const texts = {
    es: {
      titleLine1: 'Mejora el audio de tu navegador',
      titleHighlight: 'como un profesional',
      description:
        'Smart Audio EQ lleva un ecualizador real a YouTube, Spotify y cualquier otra página con audio.',
      addButton: 'Agregar a Chrome (Gratis)',
      premiumButton: 'Obtener Premium',
      f1Title: '🎚️ Ecualizador de 6 bandas',
      f1Text: 'Control preciso de graves, medios y agudos para un sonido perfecto.',
      f2Title: '🚀 Cero latencia',
      f2Text: 'Procesamiento en tiempo real, el audio siempre va sincronizado con el video.',
      f3Title: '🔒 Privacidad primero',
      f3Text: 'Todo se procesa de forma local. Nada de tu audio sale de tu navegador.',
    },
    en: {
      titleLine1: 'Boost your browser audio',
      titleHighlight: 'like a pro',
      description:
        'Smart Audio EQ brings a real equalizer to YouTube, Spotify, and any website with audio.',
      addButton: 'Add to Chrome (Free)',
      premiumButton: 'Get Premium',
      f1Title: '🎚️ 6-Band Equalizer',
      f1Text: 'Precise control over bass, mids, and treble for perfect sound.',
      f2Title: '🚀 Zero Latency',
      f2Text: 'Real-time processing keeps audio perfectly in sync with video.',
      f3Title: '🔒 Privacy First',
      f3Text: 'All processing is local. Your audio never leaves your browser.',
    },
  };

  const t = texts[lang] || texts.es;

  return (
    <div>
      <div className="hero">
        <h1 style={{fontSize: '3.5rem', marginBottom: '20px'}}>
          {t.titleLine1} <br />
          <span style={{color: '#00d2ff', textTransform: 'capitalize'}}>
            {t.titleHighlight}
            <span className="beta-badge" style={{fontSize: '0.4em', verticalAlign: 'top', marginTop: '10px'}}>BETA</span>
          </span>
        </h1>
        <p style={{fontSize: '1.2rem', color: '#aaa', maxWidth: '600px', margin: '0 auto 40px'}}>
          {t.description}
        </p>
        <div style={{display: 'flex', gap: '20px', justifyContent: 'center'}}>
          <a 
            className="btn-primary" 
            href="https://chromewebstore.google.com/detail/aohaefkkofgkbneodjflnacpipdnfeng?utm_source=item-share-cb"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.addButton}
          </a>
          <Link to="/premium" className="btn-premium">{t.premiumButton}</Link>
        </div>
      </div>

      <div className="features">
        <div className="feature-card">
          <h3>{t.f1Title}</h3>
          <p>{t.f1Text}</p>
        </div>
        <div className="feature-card">
          <h3>{t.f2Title}</h3>
          <p>{t.f2Text}</p>
        </div>
        <div className="feature-card">
          <h3>{t.f3Title}</h3>
          <p>{t.f3Text}</p>
        </div>
      </div>
    </div>
  );
}
