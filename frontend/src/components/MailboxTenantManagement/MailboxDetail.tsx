import React from 'react';
import type { Mailbox, Tenant } from '../../types';

interface MailboxDetailProps {
  mailbox: Mailbox;
  tenants: Tenant[];
  onBack: () => void;
  onDeleteMailbox: (mailbox: Mailbox) => void;
  onAddTenant: () => void;
  onEditTenant: (tenant: Tenant) => void;
  onDeleteTenant: (tenant: Tenant) => void;
}

export const MailboxDetail: React.FC<MailboxDetailProps> = ({
  mailbox,
  tenants,
  onBack,
  onDeleteMailbox,
  onAddTenant,
  onEditTenant,
  onDeleteTenant,
}) => {
  return (
    <div className="space-y-6" data-testid="mailbox-management-detail">
      {/* Header Section */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <button
          onClick={onBack}
          style={{
            color: 'white',
            fontSize: '0.8125rem',
            fontWeight: '600',
            marginBottom: '0.75rem',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '0.4375rem 0.875rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          data-testid="back-to-list-button"
        >
          ← Back to Mailboxes
        </button>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2.25rem' }}>📬</span>
            <div>
              <h4 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: 'white',
                margin: 0,
                marginBottom: '0.125rem'
              }}>
                Mailbox {mailbox.mailbox_number}
              </h4>
              <p style={{ 
                fontSize: '0.8125rem', 
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: '500',
                margin: 0
              }}>
                ID: {mailbox.id}
              </p>
            </div>
          </div>
          <button
            onClick={() => onDeleteMailbox(mailbox)}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            }}
            data-testid="delete-mailbox-button"
          >
            🗑️ Delete Mailbox
          </button>
        </div>
      </div>

      {/* Tenants Section */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid #e2e8f0',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div 
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '2px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>👥</span>
            <h5 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '700', 
              color: '#1f2937',
              margin: 0
            }}>
              Tenants
            </h5>
            <span 
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                padding: '0.1875rem 0.625rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8125rem',
                fontWeight: '700',
              }}
            >
              {tenants.length}
            </span>
          </div>
          <button
            onClick={onAddTenant}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
            data-testid="add-tenant-button"
          >
            ➕ Add Tenant
          </button>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          {tenants.length === 0 ? (
            <div 
              style={{
                textAlign: 'center',
                padding: '3rem 2rem',
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                border: '3px dashed #cbd5e1',
              }}
            >
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>👤</div>
              <p style={{ 
                color: '#6b7280', 
                marginBottom: '1.25rem',
                fontSize: '1rem',
                fontWeight: '500'
              }}>
                No tenants in this mailbox
              </p>
              <button
                onClick={onAddTenant}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
              >
                ➕ Add the first tenant
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tenants.map((tenant) => {
                const isDefault = mailbox.default_tenant_id === tenant.id;
                
                return (
                  <div
                    key={tenant.id}
                    style={{
                      background: 'white',
                      border: '2px solid #e2e8f0',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.5rem',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                      e.currentTarget.style.borderColor = '#3b82f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                    data-testid={`tenant-card-${tenant.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>👤</span>
                          <h6 style={{ 
                            fontSize: '1.25rem',
                            fontWeight: '700', 
                            color: '#1f2937',
                            margin: 0
                          }}>
                            {tenant.name}
                          </h6>
                          {isDefault && (
                            <span 
                              style={{
                                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                color: '#1e40af',
                                padding: '0.25rem 0.75rem',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                border: '1px solid #93c5fd',
                              }}
                            >
                              ⭐ Default
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '2.25rem' }}>
                          {tenant.email && (
                            <p style={{ 
                              fontSize: '0.9375rem',
                              color: '#6b7280',
                              margin: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              <span style={{ fontSize: '1.125rem' }}>📧</span>
                              {tenant.email}
                            </p>
                          )}
                          {tenant.phone && (
                            <p style={{ 
                              fontSize: '0.9375rem',
                              color: '#6b7280',
                              margin: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              <span style={{ fontSize: '1.125rem' }}>📱</span>
                              {tenant.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                          onClick={() => onEditTenant(tenant)}
                          className="btn"
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            padding: '0.75rem 1.25rem',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                          data-testid={`edit-tenant-${tenant.id}`}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => onDeleteTenant(tenant)}
                          className="btn"
                          style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            padding: '0.75rem 1.25rem',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                          data-testid={`delete-tenant-${tenant.id}`}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
