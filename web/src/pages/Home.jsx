import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div>
      <div className="hero">
        <h1 style={{fontSize: '3.5rem', marginBottom: '20px'}}>
          Boost Your Browser Audio <br />
          <span style={{color: '#00d2ff'}}>Like a Pro</span>
        </h1>
        <p style={{fontSize: '1.2rem', color: '#aaa', maxWidth: '600px', margin: '0 auto 40px'}}>
          Smart Audio EQ brings professional-grade equalization to YouTube, Spotify, and every other site you visit.
        </p>
        <div style={{display: 'flex', gap: '20px', justifyContent: 'center'}}>
          <button className="btn-primary">Add to Chrome (Free)</button>
          <Link to="/premium" className="btn-premium">Get Premium</Link>
        </div>
      </div>

      <div className="features">
        <div className="feature-card">
          <h3>🎚️ 6-Band Equalizer</h3>
          <p>Precise control over bass, mids, and treble for perfect sound.</p>
        </div>
        <div className="feature-card">
          <h3>🚀 Zero Latency</h3>
          <p>Real-time processing ensures audio stays perfectly synced with video.</p>
        </div>
        <div className="feature-card">
          <h3>🔒 Privacy First</h3>
          <p>We process audio locally. Your data never leaves your browser.</p>
        </div>
      </div>
    </div>
  );
}
