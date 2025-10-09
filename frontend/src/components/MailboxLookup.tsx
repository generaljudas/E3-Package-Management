import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Mailbox, Tenant } from '../types';

interface MailboxLookupProps {
  onMailboxSelect: (mailbox: Mailbox, defaultTenant?: Tenant) => void;
  onTenantChange?: (tenant: Tenant | null) => void;
  onDefaultTenantUpdate?: (success: boolean, message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

interface MailboxCache {
  mailboxes: Mailbox[];
  lastFetched: number;
}

// Cache for instant lookups (in-memory for speed)
let mailboxCache: MailboxCache | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function MailboxLookup({
  onMailboxSelect,
  onTenantChange,
  onDefaultTenantUpdate,
  placeholder = "Type mailbox number (e.g., 145)",
  disabled = false,
  autoFocus = true,
  className = "",
  value = "",
  onValueChange,
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

  // Load mailbox cache on component mount
  useEffect(() => {
    loadMailboxCache();
  }, []);

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

  // Load and cache all mailboxes for instant lookup
  const loadMailboxCache = async () => {
    try {
      // Check if cache is still valid
      if (
        mailboxCache &&
        Date.now() - mailboxCache.lastFetched < CACHE_DURATION
      ) {
        return;
      }

      console.log('🔄 Loading mailbox cache...');
      const startTime = performance.now();
      
      // Simulate API call - replace with actual API when backend is updated
      const mockMailboxes: Mailbox[] = [
        { id: 1, mailbox_number: '101', default_tenant_id: 1, active: true, created_at: '2025-10-06', default_tenant_name: 'John Smith' },
        { id: 2, mailbox_number: '102', default_tenant_id: 2, active: true, created_at: '2025-10-06', default_tenant_name: 'Sarah Johnson' },
        { id: 3, mailbox_number: '103', default_tenant_id: 3, active: true, created_at: '2025-10-06', default_tenant_name: 'Michael Brown' },
        { id: 4, mailbox_number: '104', default_tenant_id: 4, active: true, created_at: '2025-10-06', default_tenant_name: 'Emily Davis' },
        { id: 5, mailbox_number: '105', default_tenant_id: 5, active: true, created_at: '2025-10-06', default_tenant_name: 'David Wilson' },
        { id: 6, mailbox_number: '145', default_tenant_id: 6, active: true, created_at: '2025-10-06', default_tenant_name: 'Alice Cooper' },
        { id: 7, mailbox_number: '201', default_tenant_id: 7, active: true, created_at: '2025-10-06', default_tenant_name: 'Bob Martinez' },
        { id: 8, mailbox_number: '202', default_tenant_id: 8, active: true, created_at: '2025-10-06', default_tenant_name: 'Carol White' },
        { id: 9, mailbox_number: '301', default_tenant_id: 9, active: true, created_at: '2025-10-06', default_tenant_name: 'Robert Lee' },
        { id: 10, mailbox_number: '350', default_tenant_id: 10, active: true, created_at: '2025-10-06', default_tenant_name: 'Lisa Anderson' },
      ];
      
      const duration = performance.now() - startTime;
      
      mailboxCache = {
        mailboxes: mockMailboxes,
        lastFetched: Date.now(),
      };

      console.log(`✅ Mailbox cache loaded: ${mockMailboxes.length} mailboxes in ${Math.round(duration)}ms`);
    } catch (err) {
      console.error('❌ Failed to load mailbox cache:', err);
      setError('Failed to load mailbox data');
    }
  };

  // Instant search through cached mailboxes
  const searchMailboxes = useCallback((query: string) => {
    if (!mailboxCache || query.length === 0) {
      setSearchResults([]);
      return;
    }

    const searchTerm = query.toLowerCase();
    const startTime = performance.now();

    const results = mailboxCache.mailboxes
      .filter(mailbox => 
        mailbox.mailbox_number.toLowerCase().includes(searchTerm) ||
        (mailbox.default_tenant_name && mailbox.default_tenant_name.toLowerCase().includes(searchTerm))
      )
      .sort((a, b) => {
        // Exact mailbox number match first
        if (a.mailbox_number.toLowerCase() === searchTerm) return -1;
        if (b.mailbox_number.toLowerCase() === searchTerm) return 1;
        
        // Mailbox number starts with query
        const aMailboxStarts = a.mailbox_number.toLowerCase().startsWith(searchTerm);
        const bMailboxStarts = b.mailbox_number.toLowerCase().startsWith(searchTerm);
        if (aMailboxStarts && !bMailboxStarts) return -1;
        if (!aMailboxStarts && bMailboxStarts) return 1;
        
        // Sort by mailbox number
        return parseInt(a.mailbox_number) - parseInt(b.mailbox_number);
      })
      .slice(0, 10); // Limit results for performance

    const duration = performance.now() - startTime;
    
    // Log if search is slow (should be < 10ms)
    if (duration > 10) {
      console.warn(`⚠️ Slow mailbox search (${Math.round(duration)}ms) for query: "${query}"`);
    }

    setSearchResults(results);
  }, []);

  // Handle input changes with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setError(null);
    
    // Notify parent of value change
    onValueChange?.(newValue);

    // Clear previous search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search for better performance
    searchTimeoutRef.current = setTimeout(() => {
      searchMailboxes(newValue);
      setShowDropdown(newValue.length > 0);
      setHighlightedIndex(-1);
    }, 50); // Very short debounce for instant feel
  };

  // Load tenants for selected mailbox
  const loadTenantsForMailbox = async (mailboxId: number) => {
    try {
      // Mock tenant data - replace with actual API call
      const mockTenants: Record<number, Tenant[]> = {
        1: [{ id: 1, mailbox_id: 1, name: 'John Smith', phone: '555-0101', email: 'john.smith@email.com', active: true, created_at: '2025-10-06', mailbox_number: '101' }],
        2: [{ id: 2, mailbox_id: 2, name: 'Sarah Johnson', phone: '555-0102', email: 'sarah.johnson@email.com', active: true, created_at: '2025-10-06', mailbox_number: '102' }],
        6: [
          { id: 6, mailbox_id: 6, name: 'Alice Cooper', phone: '555-0145', email: 'alice.cooper@email.com', active: true, created_at: '2025-10-06', mailbox_number: '145' },
          { id: 11, mailbox_id: 6, name: 'Bob Cooper', phone: '555-0146', email: 'bob.cooper@email.com', active: true, created_at: '2025-10-06', mailbox_number: '145' }
        ],
      };
      
      const tenants = mockTenants[mailboxId] || [];
      setAvailableTenants(tenants);
      
      return tenants;
    } catch (err) {
      console.error('Failed to load tenants for mailbox:', err);
      return [];
    }
  };

  // Handle mailbox selection
  const handleMailboxSelect = async (mailbox: Mailbox) => {
    setInputValue(`${mailbox.mailbox_number} — ${mailbox.default_tenant_name || 'No Default Tenant'}`);
    setShowDropdown(false);
    setSearchResults([]);
    setHighlightedIndex(-1);
    setSelectedMailbox(mailbox);
    
    // Load tenants for this mailbox
    const tenants = await loadTenantsForMailbox(mailbox.id);
    
    // Select default tenant if available
    let defaultTenant = null;
    if (mailbox.default_tenant_id && tenants.length > 0) {
      defaultTenant = tenants.find(t => t.id === mailbox.default_tenant_id) || tenants[0];
      setSelectedTenant(defaultTenant);
    }
    
    // Notify parent components
    onMailboxSelect(mailbox, defaultTenant || undefined);
    onValueChange?.(`${mailbox.mailbox_number} — ${mailbox.default_tenant_name || 'No Default Tenant'}`);
  };

  // Handle tenant change (when user switches tenant for the selected mailbox)
  const handleTenantChange = (tenant: Tenant | null) => {
    setSelectedTenant(tenant);
    onTenantChange?.(tenant);
    
    // Update display value
    if (selectedMailbox) {
      const displayName = tenant ? tenant.name : 'No Tenant Selected';
      setInputValue(`${selectedMailbox.mailbox_number} — ${displayName}`);
      onValueChange?.(`${selectedMailbox.mailbox_number} — ${displayName}`);
    }
  };

  // Handle default tenant change
  const handleSetDefaultTenant = async (tenantId: number) => {
    if (!selectedMailbox || isUpdatingDefault) return;

    setIsUpdatingDefault(true);
    setPendingDefaultChange(tenantId);

    try {
      // Update on backend
      const response = await fetch(`http://localhost:3001/api/tenants/mailboxes/${selectedMailbox.id}/default-tenant`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ default_tenant_id: tenantId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update default tenant: ${response.status}`);
      }

      // Update local state
      const updatedMailbox = { ...selectedMailbox, default_tenant_id: tenantId };
      setSelectedMailbox(updatedMailbox);

      // Update cache
      if (mailboxCache) {
        const mailboxIndex = mailboxCache.mailboxes.findIndex(m => m.id === selectedMailbox.id);
        if (mailboxIndex >= 0) {
          mailboxCache.mailboxes[mailboxIndex] = updatedMailbox;
        }
      }

      // Show success notification
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
        
        // Find mailbox in cache
        const mailbox = mailboxCache?.mailboxes.find(m => m.mailbox_number === mailboxNumber);
        if (mailbox) {
          handleMailboxSelect(mailbox);
        } else {
          setError(`Mailbox ${mailboxNumber} not found`);
          inputRef.current?.select();
        }
      } catch (err) {
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

  const clearSelection = () => {
    setSelectedMailbox(null);
    setSelectedTenant(null);
    setAvailableTenants([]);
    setInputValue('');
    onValueChange?.('');
  };

  return (
    <div className={`space-y-4 ${className}`}>
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
                searchMailboxes(inputValue);
                setShowDropdown(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled || isSearching}
            className={`input-field keyboard-focus ${
              error ? 'border-red-500 ring-red-500' : ''
            } ${isSearching ? 'cursor-wait' : ''}`}
            autoComplete="off"
            spellCheck={false}
          />
          
          {isSearching && (
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
          <div ref={dropdownRef} className="tenant-dropdown">
            {searchResults.map((mailbox, index) => (
              <div
                key={mailbox.id}
                onClick={() => handleMailboxSelect(mailbox)}
                className={`tenant-option ${
                  index === highlightedIndex ? 'highlighted' : ''
                }`}
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

      {/* Tenant Selection (when mailbox is selected) */}
      {selectedMailbox && availableTenants.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Tenant for Mailbox {selectedMailbox.mailbox_number}
            </label>
            <div className="text-xs text-gray-500">
              Click "Set Default" to change default tenant
            </div>
          </div>
          
          <div className="space-y-3">
            {availableTenants.map((tenant) => {
              const isDefault = selectedMailbox.default_tenant_id === tenant.id;
              const isPending = pendingDefaultChange === tenant.id;
              
              return (
                <div key={tenant.id} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                  <label className="flex items-center flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="tenant"
                      value={tenant.id}
                      checked={selectedTenant?.id === tenant.id}
                      onChange={() => handleTenantChange(tenant)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {tenant.name}
                        </span>
                        {isDefault && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            ⭐ Default
                          </span>
                        )}
                        {isPending && (
                          <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                            Updating...
                          </span>
                        )}
                      </div>
                      {tenant.phone && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          📞 {tenant.phone}
                        </div>
                      )}
                    </div>
                  </label>
                  
                  {!isDefault && (
                    <button
                      onClick={() => handleSetDefaultTenant(tenant.id)}
                      disabled={isUpdatingDefault}
                      className={`ml-3 px-3 py-1 text-xs rounded transition-colors ${
                        isUpdatingDefault
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                      }`}
                    >
                      {isPending ? (
                        <span className="flex items-center">
                          <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin mr-1"></div>
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
            
            <div className="flex items-center p-3 bg-white rounded border border-gray-200">
              <label className="flex items-center flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="tenant"
                  value=""
                  checked={selectedTenant === null}
                  onChange={() => handleTenantChange(null)}
                  className="mr-3"
                />
                <span className="text-sm text-gray-500">No specific tenant selected</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Selected Summary */}
      {selectedMailbox && (
        <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-medium text-primary-900">
                📬 Mailbox {selectedMailbox.mailbox_number}
              </div>
              {selectedTenant && (
                <div className="text-primary-800">
                  👤 {selectedTenant.name}
                  {selectedMailbox.default_tenant_id === selectedTenant.id && (
                    <span className="ml-2 text-xs text-primary-600">(Default Tenant)</span>
                  )}
                  {selectedTenant.phone && (
                    <div className="text-sm text-primary-600">
                      📞 {selectedTenant.phone}
                    </div>
                  )}
                </div>
              )}
              {!selectedTenant && availableTenants.length === 0 && (
                <div className="text-sm text-primary-600">
                  No tenants registered for this mailbox
                </div>
              )}
              {!selectedTenant && availableTenants.length > 0 && (
                <div className="text-sm text-primary-600">
                  No specific tenant selected
                </div>
              )}
              
              {/* Show default tenant info when no tenant is selected */}
              {!selectedTenant && availableTenants.length > 0 && selectedMailbox.default_tenant_id && (
                <div className="text-xs text-primary-500 mt-1">
                  Default: {availableTenants.find(t => t.id === selectedMailbox.default_tenant_id)?.name}
                </div>
              )}
            </div>
            <button
              onClick={clearSelection}
              className="text-primary-600 hover:text-primary-800 text-sm ml-4"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}