import React, { useState, useEffect } from 'react';
import type { Mailbox, Tenant } from '../types';
import { mailboxApi, tenantApi } from '../services/api';

interface MailboxTenantManagementProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

type ViewMode = 'search' | 'list' | 'view-mailbox' | 'add-mailbox' | 'edit-tenant' | 'add-tenant';

interface ViewState {
  mode: ViewMode;
  selectedMailbox: Mailbox | null;
  selectedTenant: Tenant | null;
}

const MailboxTenantManagement: React.FC<MailboxTenantManagementProps> = ({ onError, onSuccess }) => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({
    mode: 'search', // Start with search view instead of loading all
    selectedMailbox: null,
    selectedTenant: null,
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Mailbox[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Form states
  const [newMailboxNumber, setNewMailboxNumber] = useState('');
  const [tenantForm, setTenantForm] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Don't load mailboxes on mount - only load when needed
  // Load tenants when a mailbox is selected
  useEffect(() => {
    if (viewState.selectedMailbox) {
      loadTenants(viewState.selectedMailbox.id);
    }
  }, [viewState.selectedMailbox]);

  const loadMailboxes = async () => {
    setLoading(true);
    try {
      const response = await mailboxApi.getAll();
      setMailboxes(response.mailboxes);
    } catch (error) {
      console.error('Error loading mailboxes:', error);
      onError?.('Failed to load mailboxes');
    } finally {
      setLoading(false);
    }
  };

  const searchMailboxes = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await mailboxApi.getAll();
      const allMailboxes = response.mailboxes;
      
      const query_lower = query.toLowerCase().trim();
      const filtered = allMailboxes.filter((mailbox) => {
        const mailboxNumberMatch = mailbox.mailbox_number.toLowerCase().includes(query_lower);
        const tenantMatch = mailbox.default_tenant_name?.toLowerCase().includes(query_lower);
        return mailboxNumberMatch || tenantMatch;
      });

      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching mailboxes:', error);
      onError?.('Failed to search mailboxes');
    } finally {
      setIsSearching(false);
    }
  };

  const loadTenants = async (mailboxId: number) => {
    setLoading(true);
    try {
      const response = await tenantApi.getByMailboxId(mailboxId);
      setTenants(response.tenants);
    } catch (error) {
      console.error('Error loading tenants:', error);
      onError?.('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleViewMailbox = (mailbox: Mailbox) => {
    setViewState({
      mode: 'view-mailbox',
      selectedMailbox: mailbox,
      selectedTenant: null,
    });
  };

  const handleBackToList = () => {
    setViewState({
      mode: 'search',
      selectedMailbox: null,
      selectedTenant: null,
    });
    setTenants([]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMailboxNumber.trim()) {
      onError?.('Please enter a mailbox number');
      return;
    }

    setLoading(true);
    try {
      await mailboxApi.create({ mailbox_number: newMailboxNumber });
      onSuccess?.(`Mailbox ${newMailboxNumber} created successfully`);
      setNewMailboxNumber('');
      setViewState({ mode: 'search', selectedMailbox: null, selectedTenant: null });
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error creating mailbox:', error);
      onError?.('Failed to create mailbox');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMailbox = async (mailbox: Mailbox) => {
    if (!window.confirm(`Are you sure you want to delete Mailbox ${mailbox.mailbox_number}? This will also delete all associated tenants.`)) {
      return;
    }

    setLoading(true);
    try {
      await mailboxApi.delete(mailbox.id);
      onSuccess?.(`Mailbox ${mailbox.mailbox_number} deleted successfully`);
      handleBackToList();
      loadMailboxes();
    } catch (error) {
      console.error('Error deleting mailbox:', error);
      onError?.('Failed to delete mailbox');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewState.selectedMailbox) return;
    if (!tenantForm.name.trim()) {
      onError?.('Please enter a tenant name');
      return;
    }

    setLoading(true);
    try {
      await tenantApi.create({
        mailbox_id: viewState.selectedMailbox.id,
        name: tenantForm.name,
        email: tenantForm.email || undefined,
        phone: tenantForm.phone || undefined,
      });
      onSuccess?.(`Tenant ${tenantForm.name} added successfully`);
      setTenantForm({ name: '', email: '', phone: '' });
      setViewState({ ...viewState, mode: 'view-mailbox' });
      loadTenants(viewState.selectedMailbox.id);
    } catch (error) {
      console.error('Error adding tenant:', error);
      onError?.('Failed to add tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewState.selectedTenant) return;
    if (!tenantForm.name.trim()) {
      onError?.('Please enter a tenant name');
      return;
    }

    setLoading(true);
    try {
      await tenantApi.update(viewState.selectedTenant.id, {
        name: tenantForm.name,
        email: tenantForm.email || undefined,
        phone: tenantForm.phone || undefined,
      });
      onSuccess?.(`Tenant ${tenantForm.name} updated successfully`);
      setTenantForm({ name: '', email: '', phone: '' });
      setViewState({ ...viewState, mode: 'view-mailbox', selectedTenant: null });
      if (viewState.selectedMailbox) {
        loadTenants(viewState.selectedMailbox.id);
      }
    } catch (error) {
      console.error('Error updating tenant:', error);
      onError?.('Failed to update tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!window.confirm(`Are you sure you want to delete tenant "${tenant.name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await tenantApi.deactivate(tenant.id);
      onSuccess?.(`Tenant ${tenant.name} deleted successfully`);
      if (viewState.selectedMailbox) {
        loadTenants(viewState.selectedMailbox.id);
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      onError?.('Failed to delete tenant');
    } finally {
      setLoading(false);
    }
  };

  const startEditTenant = (tenant: Tenant) => {
    setTenantForm({
      name: tenant.name,
      email: tenant.email || '',
      phone: tenant.phone || '',
    });
    setViewState({
      ...viewState,
      mode: 'edit-tenant',
      selectedTenant: tenant,
    });
  };

  const startAddTenant = () => {
    setTenantForm({ name: '', email: '', phone: '' });
    setViewState({
      ...viewState,
      mode: 'add-tenant',
    });
  };

  // Filter mailboxes based on search query
  const filteredMailboxes = mailboxes.filter((mailbox) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    const mailboxNumberMatch = mailbox.mailbox_number.toLowerCase().includes(query);
    const defaultTenantMatch = mailbox.default_tenant_name?.toLowerCase().includes(query);
    
    return mailboxNumberMatch || defaultTenantMatch;
  });

  // Render search view (default)
  if (viewState.mode === 'search') {
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchMailboxes(e.target.value);
              }}
              placeholder="Search by mailbox number or tenant name..."
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
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
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
              {searchResults.map((mailbox) => (
                <button
                  key={mailbox.id}
                  onClick={() => handleViewMailbox(mailbox)}
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
            onClick={() => setViewState({ ...viewState, mode: 'add-mailbox' })}
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
            onClick={async () => {
              setViewState({ ...viewState, mode: 'list' });
              await loadMailboxes();
            }}
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
  }

  // Render loading state
  if (loading && viewState.mode === 'list' && mailboxes.length === 0) {
    return (
      <div className="text-center py-12" data-testid="mailbox-management-loading">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">Loading mailboxes...</p>
      </div>
    );
  }

  // Render mailbox list view
  if (viewState.mode === 'list') {
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
            onClick={() => setViewState({ ...viewState, mode: 'add-mailbox' })}
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

        {/* Empty States and Mailbox Grid */}
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
              onClick={() => setViewState({ ...viewState, mode: 'add-mailbox' })}
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
                onClick={() => handleViewMailbox(mailbox)}
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
  }

  // Render add mailbox form
  if (viewState.mode === 'add-mailbox') {
    return (
      <div className="space-y-6" data-testid="mailbox-management-add">
        <button
          onClick={handleBackToList}
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
          
          <form onSubmit={handleAddMailbox} style={{ padding: '2rem' }}>
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
                value={newMailboxNumber}
                onChange={(e) => setNewMailboxNumber(e.target.value)}
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
                onClick={handleBackToList}
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
  }

  // Render mailbox detail view with tenants
  if (viewState.mode === 'view-mailbox' && viewState.selectedMailbox) {
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
            onClick={handleBackToList}
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
                  Mailbox {viewState.selectedMailbox.mailbox_number}
                </h4>
                <p style={{ 
                  fontSize: '0.8125rem', 
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontWeight: '500',
                  margin: 0
                }}>
                  ID: {viewState.selectedMailbox.id}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDeleteMailbox(viewState.selectedMailbox!)}
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
              onClick={startAddTenant}
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
                  onClick={startAddTenant}
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
                  const isDefault = viewState.selectedMailbox?.default_tenant_id === tenant.id;
                  
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
                                <span style={{ fontSize: '1.125rem' }}>�</span>
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
                            onClick={() => startEditTenant(tenant)}
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
                            onClick={() => handleDeleteTenant(tenant)}
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
  }

  // Render add/edit tenant form
  if ((viewState.mode === 'add-tenant' || viewState.mode === 'edit-tenant') && viewState.selectedMailbox) {
    const isEdit = viewState.mode === 'edit-tenant';
    return (
      <div className="space-y-6" data-testid={isEdit ? 'mailbox-management-edit-tenant' : 'mailbox-management-add-tenant'}>
        <button
          onClick={() => setViewState({ ...viewState, mode: 'view-mailbox', selectedTenant: null })}
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
          
          <form onSubmit={isEdit ? handleEditTenant : handleAddTenant} style={{ padding: '2rem' }}>
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
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
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
                  value={tenantForm.email}
                  onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
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
                  value={tenantForm.phone}
                  onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
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
                onClick={() => setViewState({ ...viewState, mode: 'view-mailbox', selectedTenant: null })}
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
  }

  return null;
};

export default MailboxTenantManagement;
