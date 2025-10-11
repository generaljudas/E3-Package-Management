import { useEffect } from 'react';
import type { ToastMessage } from '../types';

interface ToastProps extends ToastMessage {
  onClose: () => void;
}

const toastStyles: Record<ToastMessage['type'], { background: string; icon: string }> = {
  success: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    icon: '✓'
  },
  error: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    icon: '✕'
  },
  warning: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    icon: '⚠'
  },
  info: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    icon: 'ℹ'
  }
};

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const duration = message.includes('error') ? 5000 : 3000;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, message]);

  const style = toastStyles[type];

  return (
    <div 
      data-testid={`toast-${type}`}
      style={{
        background: style.background,
        color: 'white',
        padding: '1rem 1.5rem',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        minWidth: '300px',
        maxWidth: '500px',
        animation: 'slideInRight 0.3s ease-out'
      }}
    >
      <div 
        data-testid="toast-icon"
        style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          width: '32px',
          height: '32px',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {style.icon}
      </div>
      <span 
        data-testid="toast-message"
        style={{
          flex: 1,
          fontWeight: '600',
          fontSize: '0.95rem',
          lineHeight: 1.5
        }}
      >
        {message}
      </span>
      <button
        data-testid="toast-close-button"
        onClick={onClose}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          color: 'white',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
          fontWeight: 'bold',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
      >
        ×
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemoveToast: (id: string) => void;
}

export function ToastContainer({ toasts, onRemoveToast }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 space-y-2 z-50" data-testid="app-toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => onRemoveToast(toast.id)}
        />
      ))}
    </div>
  );
}
