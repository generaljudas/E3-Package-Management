import React, { useState } from 'react';
import type { Mailbox } from '../../types';

interface MailboxSearchProps {
  onViewMailbox: (mailbox: Mailbox) => void;
  onAddMailbox: () => void;
  onViewAll: () => void;
  searchMailboxes: (query: string) => Promise<Mailbox[]>;
  isSearching: boolean;
}

export const MailboxSearch: React.FC<MailboxSearchProps> = ({
  onViewMailbox,
  onAddMailbox,
  onViewAll,
  searchMailboxes,
  isSearching,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Mailbox[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setHighlightedIndex(-1);
      return;
    }
    const results = await searchMailboxes(query);
    setSearchResults(results);
    setHighlightedIndex(-1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key - auto-select best match
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (searchResults.length === 0) {
        return;
      }

      // If there's a highlighted result, select it
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        onViewMailbox(searchResults[highlightedIndex]);
        return;
      }

      // Otherwise, select the first (best) result
      if (searchResults.length > 0) {
        onViewMailbox(searchResults[0]);
      }
      return;
    }

    // Handle arrow key navigation
    if (searchResults.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      
      case 'Escape':
        e.preventDefault();
        handleClearSearch();
        break;
    }
  };

  return (
    <div className="space-y-6" data-testid="mailbox-management-search">
      {/* Hero Header */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem 2rem',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📬</div>
        <h4 style={{ 
          fontSize: '1.75rem', 
          fontWeight: '700', 
          color: 'white',
          margin: 0,
          marginBottom: '0.5rem'
        }}>
          Mailbox & Tenant Management
        </h4>
        <p style={{ 
          fontSize: '1rem', 
          color: 'rgba(255, 255, 255, 0.9)',
          fontWeight: '400',
          margin: 0
        }}>
          Search for a mailbox to manage, or create a new one
        </p>
      </div>

      {/* Search Bar */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '1.25rem',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            fontSize: '1.5rem',
          }}>
            🔍
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by mailbox number or tenant name (press Enter to select)"
            className="input-field"
            style={{
              width: '100%',
              paddingLeft: '3.5rem',
              paddingRight: searchQuery ? '3.5rem' : '1.25rem',
              paddingTop: '1rem',
              paddingBottom: '1rem',
              fontSize: '1.125rem',
              fontWeight: '500',
            }}
            autoFocus
            data-testid="mailbox-search-input"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                top: '50%',
                right: '1.25rem',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                fontSize: '1.25rem',
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
      </div>

      {/* Search Results */}
      {isSearching ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Searching...</p>
        </div>
      ) : searchQuery && searchResults.length > 0 ? (
        <div>
          <div style={{ 
            marginBottom: '1rem', 
            fontSize: '0.875rem', 
            color: '#6b7280',
            fontWeight: '500'
          }}>
            Found {searchResults.length} mailbox{searchResults.length !== 1 ? 'es' : ''}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((mailbox, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
              <button
                key={mailbox.id}
                onClick={() => onViewMailbox(mailbox)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className="mailbox-card"
                style={{
                  background: isHighlighted 
                    ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' 
                    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: isHighlighted ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  textAlign: 'left',
                  transition: 'all 0.3s ease',
                  boxShadow: isHighlighted ? '0 10px 25px rgba(59, 130, 246, 0.3)' : 'var(--shadow-md)',
                  transform: isHighlighted ? 'translateY(-4px)' : 'translateY(0)',
                  cursor: 'pointer',
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
              );
            })}
          </div>
        </div>
      ) : searchQuery && searchResults.length === 0 && !isSearching ? (
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
            No mailboxes found for "{searchQuery}"
          </p>
          <p style={{ 
            fontSize: '0.8125rem', 
            color: '#9ca3af',
            marginBottom: '1.25rem'
          }}>
            Try a different search term or create a new mailbox
          </p>
        </div>
      ) : null}

      {/* Quick Actions */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
        }}
      >
        <button
          onClick={onAddMailbox}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            transition: 'all 0.2s ease',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          }}
          data-testid="add-mailbox-button"
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>➕</div>
          <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
            Add New Mailbox
          </div>
          <div style={{ fontSize: '0.8125rem', opacity: 0.9 }}>
            Create a new mailbox entry
          </div>
        </button>

        <button
          onClick={onViewAll}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s ease',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
          }}
          data-testid="view-all-button"
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
            View All Mailboxes
          </div>
          <div style={{ fontSize: '0.8125rem', opacity: 0.9 }}>
            Browse complete mailbox list
          </div>
        </button>
      </div>
    </div>
  );
};
