import React, { useState } from 'react';

export default function Premium() {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Call backend to create preference
      // Replace with your actual deployed backend URL later
      const response = await fetch('https://smart-audio-eq-api.onrender.com/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: 'Smart Audio EQ Premium', price: 9.99 })
      });
      
      const data = await response.json();
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        alert('Payment setup failed. Please try again.');
      }
    } catch (error) {
      console.error(error);
      alert('Error connecting to payment server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{textAlign: 'center', padding: '50px 0'}}>
      <h1 style={{color: '#ffd700', fontSize: '3rem'}}>Unlock the Full Power</h1>
      <p style={{fontSize: '1.2rem', marginBottom: '40px'}}>One-time payment. Lifetime access.</p>

      <div style={{display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap'}}>
        <div className="feature-card" style={{border: '1px solid #333', textAlign: 'left', minWidth: '300px'}}>
          <h2>Free</h2>
          <ul style={{listStyle: 'none', padding: 0, lineHeight: '2'}}>
            <li>✅ 6 Band EQ</li>
            <li>✅ Basic Presets (Flat, Vocal, etc)</li>
            <li>✅ Volume Boost</li>
          </ul>
          <h3 style={{marginTop: '20px'}}>$0 / forever</h3>
        </div>

        <div className="feature-card" style={{border: '2px solid #ffd700', textAlign: 'left', minWidth: '300px', transform: 'scale(1.05)'}}>
          <h2 style={{color: '#ffd700'}}>Premium 💎</h2>
          <ul style={{listStyle: 'none', padding: 0, lineHeight: '2'}}>
            <li>✅ Everything in Free</li>
            <li>✅ <strong>Custom Presets</strong> (Save your own)</li>
            <li>✅ Pro Presets (Bass Pro, Gaming, Cinema)</li>
            <li>✅ Cloud Sync (Coming soon)</li>
            <li>✅ Priority Support</li>
          </ul>
          <h3 style={{marginTop: '20px'}}>$9.99 / lifetime</h3>
          <button 
            className="btn-premium" 
            style={{width: '100%', marginTop: '10px'}}
            onClick={handlePayment}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Buy Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
