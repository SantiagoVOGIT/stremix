import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Dialog = ({ open, onClose, children }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-dialog-overlay" onClick={onClose}>
      {children}
    </div>
  );
};

export const DialogContent = ({ className = '', children, onClose, ...props }) => (
  <div 
    className={`ui-dialog-content modal-sheet ${className}`} 
    onClick={(e) => e.stopPropagation()} 
    {...props}
  >
    {onClose && (
      <button className="ui-dialog-close modal-close-btn" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
    )}
    {children}
  </div>
);

export const DialogHeader = ({ className = '', children, ...props }) => (
  <div className={`ui-dialog-header ${className}`} {...props}>
    {children}
  </div>
);

export const DialogTitle = ({ className = '', children, ...props }) => (
  <h2 className={`ui-dialog-title ${className}`} {...props}>
    {children}
  </h2>
);

export const DialogDescription = ({ className = '', children, ...props }) => (
  <p className={`ui-dialog-description ${className}`} {...props}>
    {children}
  </p>
);

export const DialogFooter = ({ className = '', children, ...props }) => (
  <div className={`ui-dialog-footer ${className}`} {...props}>
    {children}
  </div>
);
