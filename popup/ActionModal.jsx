import React from 'react';

export default function ActionModal({ isOpen, title, icon, message, confirmText, cancelText, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="modal-icon">{icon || '🔄'}</span>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        
        <div className="modal-actions">
          <button className="modal-btn-premium" onClick={onConfirm}>
            {confirmText}
          </button>
          <button className="modal-btn-close" onClick={onClose}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
