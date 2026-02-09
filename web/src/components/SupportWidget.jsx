import React, { useState, useEffect } from 'react';

const API_BASE = 'https://smart-audio-eq-1.onrender.com';

export default function SupportWidget({ user, lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null
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
        body: JSON.stringify({
          email,
          subject,
          message
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setStatusMsg(lang === 'es' ? 'Mensaje enviado con éxito.' : 'Message sent successfully.');
        setMessage('');
        setSubject('');
        setTimeout(() => {
          setIsOpen(false);
          setStatus(null);
        }, 3000);
      } else {
        setStatus('error');
        setStatusMsg(data.error || (lang === 'es' ? 'Error al enviar.' : 'Error sending message.'));
      }
    } catch (err) {
      setStatus('error');
      setStatusMsg(lang === 'es' ? 'Error de conexión.' : 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: '#00d2ff',
          color: '#000',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title={lang === 'es' ? 'Soporte' : 'Support'}
      >
        {isOpen ? '✕' : '?'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '350px',
          maxWidth: '90vw',
          backgroundColor: '#222',
          borderRadius: '10px',
          boxShadow: '0 5px 20px rgba(0,0,0,0.5)',
          zIndex: 1000,
          overflow: 'hidden',
          border: '1px solid #444',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#333',
            borderBottom: '1px solid #444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>
              {lang === 'es' ? 'Soporte / Contacto' : 'Support / Contact'}
            </h3>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            <div>
              <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem', marginBottom: '5px' }}>
                {lang === 'es' ? 'Tu Correo' : 'Your Email'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  background: '#333',
                  color: '#fff',
                  boxSizing: 'border-box' // Important for width 100%
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem', marginBottom: '5px' }}>
                {lang === 'es' ? 'Asunto' : 'Subject'}
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={lang === 'es' ? 'Asunto del mensaje...' : 'Message subject...'}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  background: '#333',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem', marginBottom: '5px' }}>
                {lang === 'es' ? 'Mensaje' : 'Message'}
              </label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={lang === 'es' ? 'Escribe tu consulta o queja aquí...' : 'Write your inquiry or complaint here...'}
                rows="4"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  background: '#333',
                  color: '#fff',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {status && (
              <div style={{
                padding: '10px',
                borderRadius: '5px',
                fontSize: '0.9rem',
                backgroundColor: status === 'success' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                color: status === 'success' ? '#0f0' : '#f55',
                border: `1px solid ${status === 'success' ? '#0f0' : '#f55'}`
              }}>
                {statusMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '10px',
                padding: '10px',
                backgroundColor: '#00d2ff',
                color: '#000',
                border: 'none',
                borderRadius: '5px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading 
                ? (lang === 'es' ? 'Enviando...' : 'Sending...') 
                : (lang === 'es' ? 'Enviar Mensaje' : 'Send Message')
              }
            </button>
          </form>
        </div>
      )}
    </>
  );
}
