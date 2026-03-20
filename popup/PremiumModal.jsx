import React from 'react';

export default function PremiumModal({ isOpen, message, onClose, onUpgrade }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="modal-icon">🔊</span>
        <h3 className="modal-title">¡Potencia tu Sonido!</h3>
        <p className="modal-message">{message}</p>
        
        <div className="modal-actions">
          <button className="modal-btn-premium" onClick={onUpgrade}>
            Desbloquear mejor sonido 🚀
          </button>
          <button className="modal-btn-close" onClick={onClose}>
            Tal vez más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
