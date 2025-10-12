import React, { useState } from 'react';

interface MailboxFormProps {
  onSubmit: (mailboxNumber: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export const MailboxForm: React.FC<MailboxFormProps> = ({
  onSubmit,
  onCancel,
  loading,
}) => {
  const [mailboxNumber, setMailboxNumber] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(mailboxNumber);
    setMailboxNumber('');
  };

  return (
    <div className="space-y-6" data-testid="mailbox-management-add">
      <button
        onClick={onCancel}
        style={{
          color: '#3b82f6',
          fontSize: '0.875rem',
          fontWeight: '600',
          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }}
        data-testid="back-to-list-button"
      >
        ← Back to Mailboxes
      </button>

      <div 
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid #e2e8f0',
          boxShadow: 'var(--shadow-lg)',
          maxWidth: '40rem',
        }}
      >
        <div 
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            padding: '1.5rem 2rem',
            borderTopLeftRadius: 'var(--radius-lg)',
            borderTopRightRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ fontSize: '2rem' }}>📬</span>
          <h4 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: 'white',
            margin: 0
          }}>
            Add New Mailbox
          </h4>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <label 
              htmlFor="mailbox-number" 
              style={{ 
                display: 'block',
                fontSize: '1rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.75rem',
              }}
            >
              Mailbox Number <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="mailbox-number"
              type="text"
              value={mailboxNumber}
              onChange={(e) => setMailboxNumber(e.target.value)}
              placeholder="e.g., 101"
              className="input-field"
              style={{
                width: '100%',
                padding: '0.875rem 1.125rem',
                fontSize: '1rem',
                fontWeight: '500',
              }}
              required
              autoFocus
              data-testid="mailbox-number-input"
            />
            <p style={{ 
              marginTop: '0.5rem',
              fontSize: '0.875rem',
              color: '#6b7280',
              fontStyle: 'italic'
            }}>
              💡 Enter a unique mailbox number (e.g., 101, 145, 350)
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn"
              style={{
                flex: 1,
                background: loading ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '1rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              data-testid="submit-mailbox-button"
            >
              {loading ? '⏳ Creating...' : '✓ Create Mailbox'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="btn"
              style={{
                background: 'white',
                color: '#6b7280',
                padding: '1rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                border: '2px solid #e5e7eb',
              }}
              data-testid="cancel-mailbox-button"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
