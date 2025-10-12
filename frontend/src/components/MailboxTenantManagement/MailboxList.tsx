import React, { useState } from 'react';
import type { Mailbox } from '../../types';

interface MailboxListProps {
  mailboxes: Mailbox[];
  loading: boolean;
  onViewMailbox: (mailbox: Mailbox) => void;
  onAddMailbox: () => void;
}

export const MailboxList: React.FC<MailboxListProps> = ({
  mailboxes,
  loading,
  onViewMailbox,
  onAddMailbox,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter mailboxes based on search query
  const filteredMailboxes = mailboxes.filter((mailbox) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    const mailboxNumberMatch = mailbox.mailbox_number.toLowerCase().includes(query);
    const defaultTenantMatch = mailbox.default_tenant_name?.toLowerCase().includes(query);
    
    return mailboxNumberMatch || defaultTenantMatch;
  });

  if (loading && mailboxes.length === 0) {
    return (
      <div className="text-center py-12" data-testid="mailbox-management-loading">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">Loading mailboxes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="mailbox-management-list">
      {/* Header with gradient */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📬</span>
          <h4 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700', 
            color: 'white',
            margin: 0
          }}>
            All Mailboxes
          </h4>
        </div>
        <button
          onClick={onAddMailbox}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '0.625rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          }}
          data-testid="add-mailbox-button"
        >
          ➕ Add New Mailbox
        </button>
      </div>

      {/* Search Bar */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid #e2e8f0',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '1rem',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            fontSize: '1.25rem',
          }}>
            🔍
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by mailbox number or tenant name..."
            className="input-field"
            style={{
              width: '100%',
              paddingLeft: '3rem',
              paddingRight: searchQuery ? '3rem' : '1rem',
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
              fontSize: '1rem',
              fontWeight: '500',
            }}
            data-testid="mailbox-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                top: '50%',
                right: '1rem',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                padding: '0.25rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.background = '#fee2e2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.background = 'transparent';
              }}
              data-testid="clear-search-button"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <div style={{ 
            marginTop: '0.5rem', 
            fontSize: '0.8125rem', 
            color: '#6b7280',
            fontWeight: '500'
          }}>
            Showing {filteredMailboxes.length} of {mailboxes.length} mailbox{mailboxes.length !== 1 ? 'es' : ''}
          </div>
        )}
      </div>

      {/* Mailbox Grid or Empty States */}
      {mailboxes.length === 0 ? (
        <div 
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '3px dashed #cbd5e1',
          }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📭</div>
          <p style={{ 
            color: '#6b7280', 
            marginBottom: '1.25rem',
            fontSize: '1rem',
            fontWeight: '500'
          }}>
            No mailboxes found
          </p>
          <button
            onClick={onAddMailbox}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            ➕ Create your first mailbox
          </button>
        </div>
      ) : filteredMailboxes.length === 0 ? (
        <div 
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '3px dashed #cbd5e1',
          }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔍</div>
          <p style={{ 
            color: '#6b7280', 
            marginBottom: '0.5rem',
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            No mailboxes match your search
          </p>
          <p style={{ 
            fontSize: '0.8125rem', 
            color: '#9ca3af',
            marginBottom: '1.25rem'
          }}>
            Try searching for a different mailbox number or tenant name
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMailboxes.map((mailbox) => (
            <button
              key={mailbox.id}
              onClick={() => onViewMailbox(mailbox)}
              className="mailbox-card"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                border: '2px solid #e2e8f0',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                textAlign: 'left',
                transition: 'all 0.3s ease',
                boxShadow: 'var(--shadow-md)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              data-testid={`mailbox-card-${mailbox.mailbox_number}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div 
                  style={{
                    fontSize: '2.25rem',
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.375rem',
                    lineHeight: '1',
                  }}
                >
                  📬
                </div>
                <div style={{ flex: 1 }}>
                  <h5 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '700', 
                    color: '#1f2937',
                    margin: 0,
                    marginBottom: '0.125rem'
                  }}>
                    {mailbox.mailbox_number}
                  </h5>
                  <p style={{ 
                    fontSize: '0.6875rem', 
                    color: '#9ca3af',
                    fontWeight: '500',
                    margin: 0
                  }}>
                    ID: {mailbox.id}
                  </p>
                </div>
              </div>
              
              {mailbox.default_tenant_name && (
                <div 
                  style={{
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 0.75rem',
                    marginTop: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>👤</span>
                  <span style={{ 
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    color: '#1e40af'
                  }}>
                    {mailbox.default_tenant_name}
                  </span>
                </div>
              )}
              
              <div 
                style={{
                  marginTop: '0.875rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e5e7eb',
                  fontSize: '0.8125rem',
                  color: '#3b82f6',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                View Tenants <span>→</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
