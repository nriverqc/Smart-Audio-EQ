import React from 'react';
import { Link } from 'react-router-dom';

export default function Home({ lang }) {
  const texts = {
    es: {
      titleLine1: 'Mejora el audio de tu navegador',
      titleHighlight: 'como un profesional',
      description:
        'Equalizer – Web Audio es una extensión de navegador que mejora y personaliza el audio en sitios web como YouTube, Spotify, Netflix y otras plataformas de streaming.',
      compatibility: 'Compatible con Chrome, Edge y navegadores Chromium.',
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
        'Equalizer – Web Audio is a browser extension that enhances and customizes audio across websites like YouTube, Spotify, Netflix, and other streaming platforms.',
      compatibility: 'Works on Chrome, Edge and Chromium browsers.',
      addButton: 'Add to Chrome (Free)',
      premiumButton: 'Get Premium',
      f1Title: '🎚️ 6-Band Equalizer',
      f1Text: 'Precise control over bass, mids, and treble for perfect sound.',
      f2Title: '🚀 Zero Latency',
      f2Text: 'Real-time processing keeps audio perfectly in sync with video.',
      f3Title: '🔒 Privacy First',
      f3Text: 'All processing is local. Your audio never leaves your browser.',
    },
    pt: {
      titleLine1: 'Melhore o áudio do seu navegador',
      titleHighlight: 'como um profissional',
      description:
        'Equalizer – Web Audio é uma extensão de navegador que melhora e personaliza o áudio em sites como YouTube, Spotify, Netflix e outras plataformas de streaming.',
      compatibility: 'Compatível com Chrome, Edge e navegadores Chromium.',
      addButton: 'Adicionar ao Chrome (Grátis)',
      premiumButton: 'Obter Premium',
      f1Title: '🎚️ Equalizador de 6 bandas',
      f1Text: 'Controle preciso de graves, médios e agudos para um som perfeito.',
      f2Title: '🚀 Latência zero',
      f2Text: 'Processamento em tempo real mantém o áudio perfeitamente sincronizado com o vídeo.',
      f3Title: '🔒 Privacidade em primeiro lugar',
      f3Text: 'Todo o processamento é local. Seu áudio nunca sai do navegador.',
    },
    de: {
      titleLine1: 'Verbessern Sie Ihren Browser-Sound',
      titleHighlight: 'wie ein Profi',
      description:
        'Equalizer – Web Audio ist eine Browser-Erweiterung, die den Ton auf Websites wie YouTube, Spotify, Netflix und anderen Streaming-Plattformen verbessert und anpasst.',
      compatibility: 'Kompatibel mit Chrome, Edge und Chromium-Browsern.',
      addButton: 'Zu Chrome hinzufügen (Kostenlos)',
      premiumButton: 'Premium erhalten',
      f1Title: '🎚️ 6-Band-Equalizer',
      f1Text: 'Präzise Kontrolle über Bässe, Mitten und Höhen für perfekten Sound.',
      f2Title: '🚀 Null Latenz',
      f2Text: 'Echtzeitverarbeitung hält den Ton perfekt mit dem Video synchron.',
      f3Title: '🔒 Datenschutz an erster Stelle',
      f3Text: 'Die gesamte Verarbeitung erfolgt lokal. Ihr Audio verlässt nie Ihren Browser.',
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
        <p style={{fontSize: '1.2rem', color: '#aaa', maxWidth: '600px', margin: '0 auto 10px'}}>
          {t.description}
        </p>
        <p style={{fontSize: '1rem', color: '#00d2ff', marginBottom: '40px', fontWeight: 'bold'}}>
          {t.compatibility}
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
