import React from 'react';

export default function Privacy({ lang }) {
  const content = {
    pt: {
      title: 'Política de Privacidade',
      updated: 'Última atualização: 26 de fevereiro de 2026',
      intro_h: 'Introdução',
      intro_p: 'Esta Política de Privacidade descreve como o "Equalizador - Smart Audio EQ" (a "Extensão") coleta, usa e compartilha dados do usuário. A Extensão é uma ferramenta para melhorar o áudio em sites como YouTube, Spotify Web e Netflix.',
      collect_h: 'Dados que Coletamos',
      collect_p: 'A Extensão coleta os seguintes dados locais:',
      collect_li1: 'Configurações personalizadas: Presets de equalizador e volume.',
      collect_li2: 'Dados de uso anônimos: Frequência de uso para melhorias.',
      collect_li3: 'Dados de Autenticação: Email e UID para verificar o estado Premium.',
      use_h: 'Como Usamos os Dados',
      use_p: 'Usamos os dados apenas para fornecer funções da extensão e verificar assinaturas Premium.',
      security_h: 'Segurança dos Dados',
      security_p: 'Os dados são armazenados localmente ou no Firebase com criptografia moderna (HTTPS).',
      rights_h: 'Direitos do Usuário',
      rights_p: 'Você pode excluir dados desinstalando a extensão ou contatando support@smartaudioeq.com.',
    },
    de: {
      title: 'Datenschutzbestimmungen',
      updated: 'Zuletzt aktualisiert: 26. Februar 2026',
      intro_h: 'Einführung',
      intro_p: 'Diese Datenschutzrichtlinie beschreibt, wie "Equalizer - Smart Audio EQ" (die "Erweiterung") Benutzerdaten sammelt, verwendet und weitergibt. Die Erweiterung ist ein Tool zur Verbesserung von Audio auf Websites wie YouTube, Spotify Web und Netflix.',
      collect_h: 'Daten, die wir sammeln',
      collect_p: 'Die Erweiterung sammelt die folgenden lokalen Daten:',
      collect_li1: 'Benutzerdefinierte Einstellungen: Equalizer-Presets und Lautstärke.',
      collect_li2: 'Anonyme Nutzungsdaten: Häufigkeit der Nutzung für Verbesserungen.',
      collect_li3: 'Authentifizierungsdaten: E-Mail und UID zur Überprüfung des Premium-Status.',
      use_h: 'Wie wir Daten verwenden',
      use_p: 'Wir verwenden die Daten nur zur Bereitstellung von Erweiterungsfunktionen und zur Überprüfung von Premium-Abonnements.',
      security_h: 'Datensicherheit',
      security_p: 'Daten werden lokal oder in Firebase mit moderner Verschlüsselung (HTTPS) gespeichert.',
      rights_h: 'Benutzerrechte',
      rights_p: 'Sie können Daten löschen, indem Sie die Erweiterung deinstallieren oder support@smartaudioeq.com kontaktieren.',
    }
  };

  if (lang === 'pt' || lang === 'de') {
    const t = content[lang];
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', color: '#eee', lineHeight: '1.6' }}>
        <h1 style={{ color: '#00d2ff' }}>{t.title}</h1>
        <p style={{ opacity: 0.8 }}>{t.updated}</p>
        <h2>{t.intro_h}</h2>
        <p>{t.intro_p}</p>
        <h2>{t.collect_h}</h2>
        <p>{t.collect_p}</p>
        <ul style={{ paddingLeft: '20px', color: '#ccc' }}>
          <li>{t.collect_li1}</li>
          <li>{t.collect_li2}</li>
          <li>{t.collect_li3}</li>
        </ul>
        <h2>{t.use_h}</h2>
        <p>{t.use_p}</p>
        <h2>{t.security_h}</h2>
        <p>{t.security_p}</p>
        <h2>{t.rights_h}</h2>
        <p>{t.rights_p}</p>
      </div>
    );
  }

  if (lang === 'en') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', color: '#eee', lineHeight: '1.6' }}>
        <h1 style={{ color: '#00d2ff' }}>Privacy Policy</h1>
        <p style={{ opacity: 0.8 }}>Last updated: February 9, 2026</p>

        <h2>Introduction</h2>
        <p>
          This Privacy Policy describes how "Equalizer - Smart Audio EQ" (the "Extension") collects, uses, and shares user data. 
          The Extension is a tool to enhance audio on websites like YouTube, Spotify Web, and Netflix, allowing for equalizer and volume adjustments.
        </p>

        <h2>Data We Collect</h2>
        <p>The Extension collects the following local data (stored in your browser and not sent to external servers):</p>
        <ul style={{ paddingLeft: '20px', color: '#ccc' }}>
          <li><strong>Custom Settings:</strong> Equalizer presets (bass, mids, highs), volume adjustments, and modes (e.g., Rock, Pop, Bass Booster).</li>
          <li><strong>Anonymous Usage Data:</strong> Frequency of feature usage to improve the Extension (without identifying individual users).</li>
          <li><strong>Authentication Data (Optional):</strong> If you log in, we store your email and UID (via Firebase) solely to verify Premium status and sync your preferences across devices.</li>
        </ul>
        <p>We do not collect personal data such as browsing history, website content, or web activity, except what is strictly necessary for the audio functions described.</p>

        <h2>How We Use Data</h2>
        <p>We use the data only to:</p>
        <ul style={{ paddingLeft: '20px', color: '#ccc' }}>
          <li>Provide and improve Extension features (e.g., saving your presets for future use).</li>
          <li>Verify your Premium subscription status.</li>
          <li>Analyze anonymous usage for internal optimizations.</li>
        </ul>
        <p>We do not use data for personalized advertising, selling, or purposes unrelated to the Extension.</p>

        <h2>Data Sharing</h2>
        <p>We do not share data with third parties, except:</p>
        <ul style={{ paddingLeft: '20px', color: '#ccc' }}>
          <li>To comply with applicable laws.</li>
          <li>In the event of a merger or acquisition, with prior user consent.</li>
        </ul>
        <p>We do not sell or transfer data to advertising platforms, data brokers, or for creditworthiness purposes.</p>

        <h2>Data Security</h2>
        <p>
          Data is stored locally in your browser or securely in Firebase (for login data). 
          Any data transmission uses modern cryptography (HTTPS/TLS). We do not allow human reading of data except for security or legal compliance.
        </p>

        <h2>Chrome Web Store Policy Compliance</h2>
        <div style={{ background: 'rgba(0, 210, 255, 0.1)', padding: '15px', borderLeft: '4px solid #00d2ff', margin: '20px 0' }}>
          <p style={{ margin: 0 }}>
            <strong>Limited Use Disclosure:</strong> The use of information received from Google APIs will adhere to the 
            <a href="https://developer.chrome.com/docs/webstore/program_policies/additional_requirements/#limited-use" target="_blank" rel="noopener noreferrer" style={{ color: '#00d2ff' }}> Chrome Web Store User Data Policy</a>, 
            including the Limited Use requirements.
          </p>
        </div>

        <h2>User Rights</h2>
        <p>
          You can delete local data by uninstalling the Extension or clearing Chrome data. 
          For Premium account data deletion, please contact us at support@smartaudioeq.com.
        </p>

        <h2>Changes to Policy</h2>
        <p>We will notify of changes via updates to this page. Continued use of the Extension implies acceptance.</p>
      </div>
    );
  }

  // Spanish Version (Default)
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', color: '#eee', lineHeight: '1.6' }}>
      <h1 style={{ color: '#00d2ff' }}>Política de Privacidad</h1>
      <p style={{ opacity: 0.8 }}>Última actualización: 9 de febrero de 2026</p>

      <h2>Introducción</h2>
      <p>
        Esta Política de Privacidad describe cómo "Equalizer - Smart Audio EQ" (la "Extensión") recopila, usa y comparte datos de usuarios. 
        La Extensión es una herramienta para mejorar el audio en sitios web como YouTube, Spotify Web y Netflix, permitiendo ajustes de ecualizador y volumen.
      </p>

      <h2>Datos que Recopilamos</h2>
      <p>La Extensión recopila los siguientes datos locales (almacenados en tu navegador y no enviados a servidores externos):</p>
      <ul style={{ paddingLeft: '20px', color: '#ccc' }}>
        <li><strong>Configuraciones personalizadas:</strong> Presets de ecualizador (graves, medios, agudos), ajustes de volumen y modos (ej: Rock, Pop, Bass Booster).</li>
        <li><strong>Datos de uso anónimos:</strong> Frecuencia de uso de features para mejorar la Extensión (sin identificar usuarios individuales).</li>
        <li><strong>Datos de Autenticación (Opcional):</strong> Si inicias sesión, guardamos tu email y UID (vía Firebase) únicamente para verificar el estado Premium y sincronizar preferencias.</li>
      </ul>
      <p>No recopilamos datos personales como historial de navegación o actividad web, salvo lo necesario para las funciones de audio descritas.</p>

      <h2>Cómo Usamos los Datos</h2>
      <p>Usamos los datos solo para:</p>
      <ul style={{ paddingLeft: '20px', color: '#ccc' }}>
        <li>Proporcionar y mejorar las funciones de la Extensión (ej: guardar tus presets para uso futuro).</li>
        <li>Verificar tu estado de suscripción Premium.</li>
        <li>Analizar uso anónimo para optimizaciones internas.</li>
      </ul>
      <p>No usamos datos para publicidad personalizada, venta o fines no relacionados con la Extensión.</p>

      <h2>Compartir Datos</h2>
      <p>No compartimos datos con terceros, excepto:</p>
      <ul style={{ paddingLeft: '20px', color: '#ccc' }}>
        <li>Para cumplir con leyes aplicables.</li>
        <li>En caso de fusión o adquisición, con consentimiento previo del usuario.</li>
      </ul>
      <p>No vendemos ni transferimos datos a plataformas de publicidad, brokers o para fines de crédito.</p>

      <h2>Seguridad de los Datos</h2>
      <p>
        Los datos se almacenan localmente en tu navegador o de forma segura en Firebase (para datos de login). 
        Cualquier transmisión usa criptografía moderna (HTTPS/TLS). No permitimos lecturas humanas de datos salvo para seguridad o cumplimiento legal.
      </p>

      <h2>Cumplimiento con Políticas de Chrome Web Store</h2>
      <div style={{ background: 'rgba(0, 210, 255, 0.1)', padding: '15px', borderLeft: '4px solid #00d2ff', margin: '20px 0' }}>
        <p style={{ margin: 0 }}>
          <strong>Uso Limitado:</strong> El uso de la información recibida de las APIs de Google se adherirá a la 
          <a href="https://developer.chrome.com/docs/webstore/program_policies/additional_requirements/#limited-use" target="_blank" rel="noopener noreferrer" style={{ color: '#00d2ff' }}> Política de Datos de Usuario de Chrome Web Store</a>, 
          incluyendo los requisitos de Uso Limitado.
        </p>
      </div>

      <h2>Derechos del Usuario</h2>
      <p>
        Puedes eliminar datos locales desinstalando la Extensión o borrando datos de Chrome. 
        Para eliminar datos de cuenta Premium, contáctanos en support@smartaudioeq.com.
      </p>

      <h2>Cambios en la Política</h2>
      <p>Notificaremos cambios vía actualización en esta página. Continuar usando la Extensión implica aceptación.</p>
    </div>
  );
}
