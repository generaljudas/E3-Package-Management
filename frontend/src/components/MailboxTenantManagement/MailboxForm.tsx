import React, { useState } from 'react';

interface TenantData {
  name: string;
  email: string;
  phone: string;
}

interface MailboxFormProps {
  onSubmit: (mailboxNumber: string, tenants: TenantData[]) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export const MailboxForm: React.FC<MailboxFormProps> = ({
  onSubmit,
  onCancel,
  loading,
}) => {
  const [mailboxNumber, setMailboxNumber] = useState('');
  const [tenants, setTenants] = useState<TenantData[]>([
    { name: '', email: '', phone: '' }
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Filter out empty tenants (where name is empty)
    const validTenants = tenants.filter(t => t.name.trim() !== '');
    
    try {
      await onSubmit(mailboxNumber, validTenants);
      // Only clear the form if submission was successful
      setMailboxNumber('');
      setTenants([{ name: '', email: '', phone: '' }]);
    } catch (error) {
      // If there's an error, don't clear the form so user can correct it
      console.error('Form submission error:', error);
    }
  };

  const handleTenantChange = (index: number, field: keyof TenantData, value: string) => {
    const newTenants = [...tenants];
    newTenants[index][field] = value;
    setTenants(newTenants);
  };

  const handleAddTenant = () => {
    setTenants([...tenants, { name: '', email: '', phone: '' }]);
  };

  const handleRemoveTenant = (index: number) => {
    if (tenants.length > 1) {
      setTenants(tenants.filter((_, i) => i !== index));
    }
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

          {/* Tenants Section */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '1rem'
            }}>
              <label style={{ 
                fontSize: '1rem',
                fontWeight: '600',
                color: '#374151',
              }}>
                Tenants (Optional)
              </label>
              <button
                type="button"
                onClick={handleAddTenant}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
                }}
                data-testid="add-tenant-field-button"
              >
                + Add Another Tenant
              </button>
            </div>

            <p style={{ 
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: '#6b7280',
              fontStyle: 'italic'
            }}>
              💡 You can add tenants now or add them later
            </p>

            {tenants.map((tenant, index) => (
              <div 
                key={index}
                style={{
                  background: 'white',
                  padding: '1.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid #e5e7eb',
                  marginBottom: '1rem',
                }}
                data-testid={`tenant-${index}`}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '1rem'
                }}>
                  <h5 style={{ 
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    color: '#1f2937',
                    margin: 0
                  }}>
                    Tenant {index + 1}
                  </h5>
                  {tenants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTenant(index)}
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      data-testid={`remove-tenant-${index}`}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label 
                      htmlFor={`tenant-name-${index}`}
                      style={{ 
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Name
                    </label>
                    <input
                      id={`tenant-name-${index}`}
                      type="text"
                      value={tenant.name}
                      onChange={(e) => handleTenantChange(index, 'name', e.target.value)}
                      placeholder="e.g., John Smith"
                      className="input-field"
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        fontSize: '0.875rem',
                      }}
                      data-testid={`tenant-name-input-${index}`}
                    />
                  </div>

                  <div>
                    <label 
                      htmlFor={`tenant-email-${index}`}
                      style={{ 
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Email
                    </label>
                    <input
                      id={`tenant-email-${index}`}
                      type="email"
                      value={tenant.email}
                      onChange={(e) => handleTenantChange(index, 'email', e.target.value)}
                      placeholder="e.g., john@example.com"
                      className="input-field"
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        fontSize: '0.875rem',
                      }}
                      data-testid={`tenant-email-input-${index}`}
                    />
                  </div>

                  <div>
                    <label 
                      htmlFor={`tenant-phone-${index}`}
                      style={{ 
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Phone
                    </label>
                    <input
                      id={`tenant-phone-${index}`}
                      type="tel"
                      value={tenant.phone}
                      onChange={(e) => handleTenantChange(index, 'phone', e.target.value)}
                      placeholder="e.g., (555) 123-4567"
                      className="input-field"
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        fontSize: '0.875rem',
                      }}
                      data-testid={`tenant-phone-input-${index}`}
                    />
                  </div>
                </div>
              </div>
            ))}
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
              {loading ? '⏳ Creating...' : '✓ Create Mailbox & Add Tenants'}
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
