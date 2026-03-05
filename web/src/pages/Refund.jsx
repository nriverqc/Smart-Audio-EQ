import React from 'react';

export default function Refund({ lang }) {
  const content = {
    es: {
      title: 'Política de Reembolso',
      updated: 'Última actualización: 26 de febrero de 2026',
      intro: 'En Nicolas Rivera Software, queremos que esté satisfecho con su compra.',
      sections: [
        {
          h: '1. Garantía de Reembolso de 14 Días',
          p: 'Ofrecemos una política de reembolso de 14 días. Si no está satisfecho con su compra por cualquier motivo, puede solicitar un reembolso completo dentro de los 14 días posteriores a la fecha de compra original.'
        },
        {
          h: '2. Cómo solicitar un reembolso',
          p: 'Para solicitar su reembolso, simplemente envíenos un correo electrónico a nr525859@gmail.com con los detalles de su compra. Procesaremos su solicitud de inmediato.'
        }
      ]
    },
    en: {
      title: 'Refund Policy',
      updated: 'Last updated: February 26, 2026',
      intro: 'At Nicolas Rivera Software, we want you to be satisfied with your purchase.',
      sections: [
        {
          h: '1. 14-Day Refund Guarantee',
          p: 'We offer a 14-day refund policy. If you are not satisfied with your purchase for any reason, you can request a full refund within 14 days of the original purchase date.'
        },
        {
          h: '2. How to Request a Refund',
          p: 'To request your refund, simply email us at nr525859@gmail.com with your purchase details. We will process your request immediately.'
        }
      ]
    },
    pt: {
      title: 'Política de Reembolso',
      updated: 'Última atualização: 26 de fevereiro de 2026',
      intro: 'Na Nicolas Rivera Software, queremos que você esteja satisfeito com sua compra.',
      sections: [
        {
          h: '1. Garantia de Reembolso de 14 Dias',
          p: 'Oferecemos uma política de reembolso de 14 dias. Se você não estiver satisfeito com sua compra por qualquer motivo, poderá solicitar um reembolso total no prazo de 14 dias a partir da data da compra original.'
        },
        {
          h: '2. Como solicitar um reembolso',
          p: 'Para solicitar seu reembolso, basta nos enviar um e-mail para nr525859@gmail.com com os detalhes da sua compra. Processaremos seu pedido imediatamente.'
        }
      ]
    },
    de: {
      title: 'Rückerstattungsrichtlinie',
      updated: 'Zuletzt aktualisiert: 26. Februar 2026',
      intro: 'Bei Nicolas Rivera Software möchten wir, dass Sie mit Ihrem Kauf zufrieden sind.',
      sections: [
        {
          h: '1. 14-tägige Rückerstattungsgarantie',
          p: 'Wir bieten eine 14-tägige Rückerstattungsrichtlinie an. Wenn Sie aus irgendeinem Grund mit Ihrem Kauf nicht zufrieden sind, können Sie innerhalb von 14 Tagen nach dem ursprünglichen Kaufdatum eine vollständige Rückerstattung beantragen.'
        },
        {
          h: '2. So beantragen Sie eine Rückerstattung',
          p: 'Um Ihre Rückerstattung zu beantragen, senden Sie uns einfach eine E-Mail an nr525859@gmail.com mit Ihren Kaufdetails. Wir werden Ihre Anfrage umgehend bearbeiten.'
        }
      ]
    }
  };

  const t = content[lang] || content.es;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', color: '#eee', lineHeight: '1.6' }}>
      <h1 style={{ color: '#00d2ff' }}>{t.title}</h1>
      <p style={{ opacity: 0.8, marginBottom: '20px' }}>{t.updated}</p>
      <p style={{ marginBottom: '30px', color: '#ccc' }}>{t.intro}</p>
      
      {t.sections.map((section, index) => (
        <div key={index} style={{ marginBottom: '25px' }}>
          {section.h && <h2 style={{ color: '#00d2ff', fontSize: '1.3rem' }}>{section.h}</h2>}
          {section.p && <p style={{ color: '#ccc' }}>{section.p}</p>}
        </div>
      ))}
    </div>
  );
}
