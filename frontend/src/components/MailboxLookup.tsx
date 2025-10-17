import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Mailbox, Tenant } from '../types';
import { useMailboxCache, invalidateMailboxCache } from '../hooks/useMailboxCache';
import { tenantApi } from '../services/api';

// eslint-disable-next-line react-refresh/only-export-components
export { invalidateMailboxCache } from '../hooks/useMailboxCache';

interface MailboxLookupProps {
  onMailboxSelect: (mailbox: Mailbox, defaultTenant?: Tenant) => void;
  onTenantChange?: (tenant: Tenant | null) => void;
  onDefaultTenantUpdate?: (success: boolean, message: string) => void;
  onClearSelection?: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  view?: 'intake' | 'pickup'; // Add view prop to conditionally show tenant selection
}


export default function MailboxLookup({
  onMailboxSelect,
  onTenantChange,
  onDefaultTenantUpdate,
  onClearSelection,
  placeholder = "Type mailbox number (e.g., 145)",
  disabled = false,
  autoFocus = true,
  className = "",
  value = "",
  onValueChange,
  view = 'intake', // Default to intake for backwards compatibility
}: MailboxLookupProps) {
  const [inputValue, setInputValue] = useState(value);
  const [searchResults, setSearchResults] = useState<Mailbox[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  const [pendingDefaultChange, setPendingDefaultChange] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const latestSearchIdRef = useRef(0);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Auto-focus input
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const {
    searchMailboxes: searchMailboxCache,
    findMailboxByNumber,
    loadMailboxes,
    isLoading: isCacheLoading,
  } = useMailboxCache();

  // Load mailboxes cache on mount (will be instant if already cached)
  useEffect(() => {
    loadMailboxes().catch((err) => {
      console.error('Failed to load mailbox cache:', err);
      setError('Failed to load mailbox data');
    });
  }, [loadMailboxes]);

  const triggerSearch = useCallback((query: string) => {
    const trimmedQuery = query.trim();
    const searchId = latestSearchIdRef.current + 1;
    latestSearchIdRef.current = searchId;

    if (trimmedQuery.length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    searchMailboxCache(query)
      .then((results) => {
        if (latestSearchIdRef.current === searchId) {
          setSearchResults(results);
        }
      })
      .catch((err) => {
        console.error('Mailbox search failed:', err);
        if (latestSearchIdRef.current === searchId) {
          setSearchResults([]);
        }
      })
      .finally(() => {
        if (latestSearchIdRef.current === searchId) {
          setIsSearching(false);
        }
      });
  }, [searchMailboxCache]);

  // Handle input changes with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setError(null);
    
    // If input is cleared, reset all state and notify parent
    if (newValue.trim() === '') {
      setSelectedMailbox(null);
      setAvailableTenants([]);
      setSelectedTenant(null);
      setSearchResults([]);
      setShowDropdown(false);
      onClearSelection?.();
    }
    
    // Notify parent of value change
    onValueChange?.(newValue);

    // Clear previous search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search for better performance
    searchTimeoutRef.current = window.setTimeout(() => {
      triggerSearch(newValue);
      setShowDropdown(newValue.length > 0);
      setHighlightedIndex(-1);
    }, 50); // Very short debounce for instant feel
  };

  const loadTenantsForMailbox = useCallback(async (mailboxId: number) => {
    try {
      const response = await tenantApi.getByMailboxId(mailboxId);
      const tenants = response.tenants ?? [];
      setAvailableTenants(tenants);
      return tenants;
    } catch (err) {
      console.error('Failed to load tenants for mailbox:', err);
      setError('Failed to load tenant data');
      return [];
    }
  }, []);

  // Handle mailbox selection
  const handleMailboxSelect = async (mailbox: Mailbox) => {
    // Clear input to allow immediate re-entry of a new mailbox number
    setInputValue('');
    setShowDropdown(false);
    setSearchResults([]);
    setHighlightedIndex(-1);
    setSelectedMailbox(mailbox);
    
    // Only load tenants for intake view
    let defaultTenant = null;
    if (view === 'intake') {
      // Load tenants for this mailbox
      const tenants = await loadTenantsForMailbox(mailbox.id);
      
      // Select default tenant if available
      if (mailbox.default_tenant_id && tenants.length > 0) {
        defaultTenant = tenants.find((t: Tenant) => t.id === mailbox.default_tenant_id) || tenants[0];
        setSelectedTenant(defaultTenant);
      }
    }
    
    // Notify parent components
    onMailboxSelect(mailbox, defaultTenant || undefined);
    onValueChange?.('');
  };

  // Handle tenant change (when user switches tenant for the selected mailbox)
  const handleTenantChange = (tenant: Tenant | null) => {
    setSelectedTenant(tenant);
    onTenantChange?.(tenant);
    
    // Note: Input value remains clear to allow immediate re-entry
  };

  // Handle default tenant change
  const handleSetDefaultTenant = async (tenantId: number) => {
    if (!selectedMailbox || isUpdatingDefault) return;

    setIsUpdatingDefault(true);
    setPendingDefaultChange(tenantId);

    try {
      await tenantApi.setDefaultTenant(selectedMailbox.id, tenantId);

      const defaultTenant = availableTenants.find((tenant) => tenant.id === tenantId) ?? null;
      const updatedMailbox: Mailbox = {
        ...selectedMailbox,
        default_tenant_id: tenantId,
        default_tenant_name: defaultTenant?.name ?? selectedMailbox.default_tenant_name,
      };
      setSelectedMailbox(updatedMailbox);

      if (defaultTenant && (!selectedTenant || selectedTenant.id === tenantId)) {
        setSelectedTenant(defaultTenant);
        onTenantChange?.(defaultTenant);
      }

      invalidateMailboxCache();

      const successMessage = `Default tenant updated for mailbox ${selectedMailbox.mailbox_number}`;
      onDefaultTenantUpdate?.(true, successMessage);

    } catch (error) {
      console.error('Error updating default tenant:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update default tenant';
      onDefaultTenantUpdate?.(false, errorMessage);
    } finally {
      setIsUpdatingDefault(false);
      setPendingDefaultChange(null);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) {
      // Enter key - try to find exact match
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        handleEnterKey();
      }
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
      
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleMailboxSelect(searchResults[highlightedIndex]);
        } else if (searchResults.length === 1) {
          handleMailboxSelect(searchResults[0]);
        } else {
          handleEnterKey();
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle Enter key - validate mailbox
  const handleEnterKey = async () => {
    const trimmedValue = inputValue.trim();
    
    // If it looks like a mailbox number, validate it
    const mailboxMatch = trimmedValue.match(/^(\d+)/);
    if (mailboxMatch) {
      const mailboxNumber = mailboxMatch[1];
      
      try {
        setIsSearching(true);

        const mailbox = await findMailboxByNumber(mailboxNumber);
        if (mailbox) {
          handleMailboxSelect(mailbox);
        } else {
          setError(`Mailbox ${mailboxNumber} not found`);
          inputRef.current?.select();
        }
      } catch (err) {
        console.error('Failed to validate mailbox via Enter key:', err);
        setError(`Mailbox ${mailboxNumber} not found`);
        inputRef.current?.select();
      } finally {
        setIsSearching(false);
      }
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Removed summary and clear functionality

  return (
    <div className={`space-y-4 ${className}`} data-testid="mailbox-lookup-root">
      {/* Mailbox Input */}
      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.length > 0) {
                triggerSearch(inputValue);
                setShowDropdown(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled || isSearching || isCacheLoading}
            className={`input-field keyboard-focus ${
              error ? 'border-red-500 ring-red-500' : ''
            } ${(isSearching || isCacheLoading) ? 'cursor-wait' : ''}`}
            autoComplete="off"
            spellCheck={false}
            data-testid="mailbox-lookup-input"
          />
          
          {(isSearching || isCacheLoading) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}

        {showDropdown && searchResults.length > 0 && (
          <div ref={dropdownRef} className="tenant-dropdown" data-testid="mailbox-lookup-dropdown">
            {searchResults.map((mailbox, index) => (
              <div
                key={mailbox.id}
                onClick={() => handleMailboxSelect(mailbox)}
                className={`tenant-option ${
                  index === highlightedIndex ? 'highlighted' : ''
                }`}
                data-testid={`mailbox-lookup-option-${mailbox.id}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      Mailbox {mailbox.mailbox_number}
                    </div>
                    <div className="text-sm text-gray-600">
                      {mailbox.default_tenant_name ? `Default: ${mailbox.default_tenant_name}` : 'No default tenant'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    ID: {mailbox.id}
                  </div>
                </div>
              </div>
            ))}
            
            {searchResults.length === 10 && (
              <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
                Showing first 10 results. Type more to narrow search.
              </div>
            )}
          </div>
        )}

        {showDropdown && inputValue.length > 0 && searchResults.length === 0 && (
          <div ref={dropdownRef} className="tenant-dropdown">
            <div className="px-4 py-3 text-gray-500">
              No mailboxes found for "{inputValue}"
            </div>
          </div>
        )}
      </div>

      {/* Tenant Selection (when mailbox is selected) - Only show for intake view */}
      {view === 'intake' && selectedMailbox && availableTenants.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '2px solid #bae6fd',
          marginTop: '1.5rem'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <label style={{
              fontSize: '1.125rem',
              fontWeight: '700',
              color: '#0c4a6e'
            }}>
              Select Tenant for Mailbox {selectedMailbox.mailbox_number}
            </label>
            <div style={{
              fontSize: '0.75rem',
              color: '#0369a1',
              fontWeight: '600'
            }}>
              Click "Set Default" to change default tenant
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {availableTenants.map((tenant) => {
              const isDefault = selectedMailbox.default_tenant_id === tenant.id;
              const isPending = pendingDefaultChange === tenant.id;
              const isSelected = selectedTenant?.id === tenant.id;
              
              return (
                <div key={tenant.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  background: isSelected ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'white',
                  borderRadius: '10px',
                  border: isSelected ? '2px solid #2563eb' : '2px solid #e5e7eb',
                  boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.25)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: 1,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="tenant"
                      value={tenant.id}
                      checked={isSelected}
                      onChange={() => handleTenantChange(tenant)}
                      style={{
                        marginRight: '1rem',
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: '#3b82f6'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '1rem',
                          fontWeight: '700',
                          color: isSelected ? 'white' : '#111827'
                        }}>
                          {tenant.name}
                        </span>
                        {isDefault && (
                          <span style={{
                            padding: '4px 10px',
                            background: isSelected ? 'rgba(255, 255, 255, 0.2)' : '#dbeafe',
                            color: isSelected ? 'white' : '#1e40af',
                            fontSize: '0.75rem',
                            borderRadius: '12px',
                            fontWeight: '700'
                          }}>
                            DEFAULT
                          </span>
                        )}
                        {isPending && (
                          <span style={{
                            padding: '4px 10px',
                            background: '#fef3c7',
                            color: '#92400e',
                            fontSize: '0.75rem',
                            borderRadius: '12px',
                            fontWeight: '600'
                          }}>
                            Updating...
                          </span>
                        )}
                      </div>
                      {tenant.phone && (
                        <div style={{
                          fontSize: '0.875rem',
                          color: isSelected ? 'rgba(255, 255, 255, 0.9)' : '#6b7280',
                          marginTop: '4px',
                          fontWeight: '500'
                        }}>
                          📞 {tenant.phone}
                        </div>
                      )}
                    </div>
                  </label>
                  
                  {!isDefault && (
                    <button
                      onClick={() => handleSetDefaultTenant(tenant.id)}
                      disabled={isUpdatingDefault}
                      style={{
                        marginLeft: '1rem',
                        padding: '8px 16px',
                        fontSize: '0.875rem',
                        borderRadius: '8px',
                        border: 'none',
                        fontWeight: '600',
                        cursor: isUpdatingDefault ? 'not-allowed' : 'pointer',
                        background: isUpdatingDefault ? '#f3f4f6' : isSelected ? 'rgba(255, 255, 255, 0.2)' : '#f3f4f6',
                        color: isUpdatingDefault ? '#9ca3af' : isSelected ? 'white' : '#374151',
                        transition: 'all 0.2s',
                        opacity: isUpdatingDefault ? 0.5 : 1
                      }}
                    >
                      {isPending ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            border: '2px solid #9ca3af',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          Setting...
                        </span>
                      ) : (
                        'Set Default'
                      )}
                    </button>
                  )}
                </div>
              );
            })}
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1rem 1.25rem',
              background: selectedTenant === null ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' : 'white',
              borderRadius: '10px',
              border: selectedTenant === null ? '2px solid #4b5563' : '2px solid #e5e7eb',
              boxShadow: selectedTenant === null ? '0 4px 12px rgba(107, 114, 128, 0.25)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="tenant"
                  value=""
                  checked={selectedTenant === null}
                  onChange={() => handleTenantChange(null)}
                  style={{
                    marginRight: '1rem',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    accentColor: '#6b7280'
                  }}
                />
                <span style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: selectedTenant === null ? 'white' : '#6b7280'
                }}>
                  No specific tenant selected
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Selected Summary removed per request */}
    </div>
  );
}