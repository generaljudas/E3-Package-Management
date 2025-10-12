import React from 'react';

interface TenantFormData {
  name: string;
  email: string;
  phone: string;
}

interface TenantFormProps {
  mode: 'add' | 'edit';
  formData: TenantFormData;
  loading: boolean;
  onFormChange: (data: TenantFormData) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
}

export const TenantForm: React.FC<TenantFormProps> = ({
  mode,
  formData,
  loading,
  onFormChange,
  onSubmit,
  onCancel,
}) => {
  const isEdit = mode === 'edit';

  return (
    <div className="space-y-6" data-testid={isEdit ? 'mailbox-management-edit-tenant' : 'mailbox-management-add-tenant'}>
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
        data-testid="back-to-mailbox-button"
      >
        ← Back to Mailbox
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
            background: isEdit 
              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '1.5rem 2rem',
            borderTopLeftRadius: 'var(--radius-lg)',
            borderTopRightRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ fontSize: '2rem' }}>👤</span>
          <h4 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: 'white',
            margin: 0
          }}>
            {isEdit ? 'Edit Tenant' : 'Add New Tenant'}
          </h4>
        </div>
        
        <form onSubmit={onSubmit} style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label 
                htmlFor="tenant-name" 
                style={{ 
                  display: 'block',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.75rem',
                }}
              >
                Tenant Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="tenant-name"
                type="text"
                value={formData.name}
                onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                placeholder="e.g., John Doe"
                className="input-field"
                style={{
                  width: '100%',
                  padding: '0.875rem 1.125rem',
                  fontSize: '1rem',
                  fontWeight: '500',
                }}
                required
                autoFocus
                data-testid="tenant-name-input"
              />
            </div>
            
            <div>
              <label 
                htmlFor="tenant-email" 
                style={{ 
                  display: 'block',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.75rem',
                }}
              >
                📧 Email <span style={{ color: '#9ca3af', fontWeight: '400', fontSize: '0.875rem' }}>(Optional)</span>
              </label>
              <input
                id="tenant-email"
                type="email"
                value={formData.email}
                onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
                placeholder="e.g., john@example.com"
                className="input-field"
                style={{
                  width: '100%',
                  padding: '0.875rem 1.125rem',
                  fontSize: '1rem',
                  fontWeight: '500',
                }}
                data-testid="tenant-email-input"
              />
            </div>
            
            <div>
              <label 
                htmlFor="tenant-phone" 
                style={{ 
                  display: 'block',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.75rem',
                }}
              >
                📱 Phone <span style={{ color: '#9ca3af', fontWeight: '400', fontSize: '0.875rem' }}>(Optional)</span>
              </label>
              <input
                id="tenant-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => onFormChange({ ...formData, phone: e.target.value })}
                placeholder="e.g., (555) 123-4567"
                className="input-field"
                style={{
                  width: '100%',
                  padding: '0.875rem 1.125rem',
                  fontSize: '1rem',
                  fontWeight: '500',
                }}
                data-testid="tenant-phone-input"
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn"
              style={{
                flex: 1,
                background: loading 
                  ? '#9ca3af' 
                  : isEdit 
                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '1rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                boxShadow: loading 
                  ? 'none' 
                  : isEdit
                    ? '0 4px 12px rgba(59, 130, 246, 0.3)'
                    : '0 4px 12px rgba(16, 185, 129, 0.3)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              data-testid="submit-tenant-button"
            >
              {loading 
                ? (isEdit ? '⏳ Updating...' : '⏳ Adding...') 
                : (isEdit ? '✓ Update Tenant' : '✓ Add Tenant')}
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
              data-testid="cancel-tenant-button"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
