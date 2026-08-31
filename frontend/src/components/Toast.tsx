import { useEffect } from 'react';
import type { ToastMessage } from '../types';

interface ToastProps extends ToastMessage {
  onClose: () => void;
}

const toastStyles: Record<ToastMessage['type'], { background: string; icon: string }> = {
  // Gradient stops chosen so white text clears WCAG AA 4.5:1 at the
  // lightest stop (success 5.48, error 4.83, warning 5.02, info 5.17).
  success: {
    background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
    icon: '✓'
  },
  error: {
    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    icon: '✕'
  },
  warning: {
    background: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
    icon: '⚠'
  },
  info: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
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
