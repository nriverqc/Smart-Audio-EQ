import React, { useState, useContext, useEffect } from 'react';
import { UserContext } from '../App';

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

export default function Contact({ lang }) {
  const { user } = useContext(UserContext);
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (user && user.email) {
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_BASE}/api/support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, subject, message }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setStatusMsg(lang === 'es' ? 'Mensaje enviado con éxito.' : 'Message sent successfully.');
        setMessage('');
        setSubject('');
      } else {
        setStatus('error');
        setStatusMsg(data.error || (lang === 'es' ? 'Error al enviar.' : 'Error sending message.'));
      }
    } catch {
      setStatus('error');
      setStatusMsg(lang === 'es' ? 'Error de conexión.' : 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const texts = {
    es: {
      title: 'Contacto y Soporte',
      subtitle: '¿Tienes alguna duda, problema o sugerencia? Estamos aquí para ayudarte.',
      emailLabel: 'Tu Correo Electrónico',
      subjectLabel: 'Asunto',
      messageLabel: 'Mensaje',
      sendBtn: 'Enviar Mensaje',
      sendingBtn: 'Enviando...',
      directEmail: 'También puedes escribirnos directamente a:',
      infoTitle: 'Información de Soporte',
      infoText: 'Nuestro equipo de soporte revisa todos los mensajes en un plazo de 24-48 horas hábiles.'
    },
    en: {
      title: 'Contact & Support',
      subtitle: 'Have a question, problem, or suggestion? We are here to help.',
      emailLabel: 'Your Email Address',
      subjectLabel: 'Subject',
      messageLabel: 'Message',
      sendBtn: 'Send Message',
      sendingBtn: 'Sending...',
      directEmail: 'You can also write to us directly at:',
      infoTitle: 'Support Information',
      infoText: 'Our support team reviews all messages within 24-48 business hours.'
    },
    pt: {
      title: 'Contato e Suporte',
      subtitle: 'Tem alguma dúvida, problema ou sugestão? Estamos aqui para ajudar.',
      emailLabel: 'Seu E-mail',
      subjectLabel: 'Assunto',
      messageLabel: 'Mensagem',
      sendBtn: 'Enviar Mensagem',
      sendingBtn: 'Enviando...',
      directEmail: 'Você também pode nos escrever diretamente para:',
      infoTitle: 'Informações de Suporte',
      infoText: 'Nossa equipe de suporte analisa todas as mensagens em 24-48 horas úteis.'
    },
    de: {
      title: 'Kontakt & Support',
      subtitle: 'Haben Sie Fragen, Probleme oder Anregungen? Wir sind hier, um zu helfen.',
      emailLabel: 'Ihre E-Mail-Adresse',
      subjectLabel: 'Betreff',
      messageLabel: 'Nachricht',
      sendBtn: 'Nachricht senden',
      sendingBtn: 'Wird gesendet...',
      directEmail: 'Sie können uns auch direkt schreiben an:',
      infoTitle: 'Support-Informationen',
      infoText: 'Unser Support-Team prüft alle Nachrichten innerhalb von 24-48 Geschäftsstunden.'
    }
  };

  const t = texts[lang] || texts.es;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', color: '#eee' }}>
      <h1 style={{ color: '#00d2ff', textAlign: 'center', fontSize: '2.5rem' }}>{t.title}</h1>
      <p style={{ textAlign: 'center', fontSize: '1.1rem', marginBottom: '40px', opacity: 0.8 }}>{t.subtitle}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'window.innerWidth > 768 ? "1fr 1fr" : "1fr"', gap: '40px', marginTop: '20px' }} className="contact-grid">
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '15px', border: '1px solid #333' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#aaa' }}>{t.emailLabel}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#1a1a1a', color: '#fff', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#aaa' }}>{t.subjectLabel}</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#1a1a1a', color: '#fff', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#aaa' }}>{t.messageLabel}</label>
              <textarea
                required
                rows="5"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#1a1a1a', color: '#fff', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            {status && (
              <div style={{
                padding: '15px',
                borderRadius: '8px',
                backgroundColor: status === 'success' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                color: status === 'success' ? '#0f0' : '#f55',
                border: `1px solid ${status === 'success' ? '#0f0' : '#f55'}`,
                textAlign: 'center'
              }}>
                {statusMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '15px', fontSize: '1rem', border: 'none' }}
            >
              {loading ? t.sendingBtn : t.sendBtn}
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(0, 210, 255, 0.05)', padding: '25px', borderRadius: '15px', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
            <h3 style={{ color: '#00d2ff', marginTop: 0 }}>{t.infoTitle}</h3>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#ccc' }}>{t.infoText}</p>
          </div>

          <div style={{ background: 'rgba(255, 215, 0, 0.05)', padding: '25px', borderRadius: '15px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
            <h3 style={{ color: '#ffd700', marginTop: 0 }}>{t.directEmail}</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', margin: '10px 0' }}>nr525859@gmail.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
