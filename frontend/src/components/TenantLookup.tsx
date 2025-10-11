import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Mailbox, Tenant } from '../types';
import { api } from '../services/api';

interface MailboxLookupProps {
  onMailboxSelect: (mailbox: Mailbox, defaultTenant?: Tenant) => void;
  onTenantChange?: (tenant: Tenant | null) => void;
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
let tenantCache: TenantCache | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function TenantLookup({
  onTenantSelect,
  placeholder = "Type mailbox number (e.g., 145)",
  disabled = false,
  autoFocus = true,
  className = "",
  value = "",
  onValueChange,
}: TenantLookupProps) {
  const [inputValue, setInputValue] = useState(value);
  const [searchResults, setSearchResults] = useState<Tenant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load tenant cache on component mount
  useEffect(() => {
    loadTenantCache();
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

  // Load and cache all tenants for instant lookup
  const loadTenantCache = async () => {
    try {
      // Check if cache is still valid
      if (
        tenantCache &&
        Date.now() - tenantCache.lastFetched < CACHE_DURATION
      ) {
        return;
      }

  console.log('Loading tenant cache...');
      const startTime = performance.now();
      
      const response = await api.tenant.getAll();
      const duration = performance.now() - startTime;
      
      tenantCache = {
        tenants: response.tenants,
        lastFetched: Date.now(),
      };

  console.log(`Tenant cache loaded: ${response.tenants.length} tenants in ${Math.round(duration)}ms`);
    } catch (err) {
  console.error('Failed to load tenant cache:', err);
      setError('Failed to load tenant data');
    }
  };

  // Instant search through cached tenants
  const searchTenants = useCallback((query: string) => {
    if (!tenantCache || query.length === 0) {
      setSearchResults([]);
      return;
    }

    const searchTerm = query.toLowerCase();
    const startTime = performance.now();

    const results = tenantCache.tenants
      .filter(tenant => 
        tenant.mailbox_number.toLowerCase().includes(searchTerm) ||
        tenant.name.toLowerCase().includes(searchTerm)
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
        
        // Name matches
        const aNameStarts = a.name.toLowerCase().startsWith(searchTerm);
        const bNameStarts = b.name.toLowerCase().startsWith(searchTerm);
        if (aNameStarts && !bNameStarts) return -1;
        if (!aNameStarts && bNameStarts) return 1;
        
        // Sort by mailbox number
        return parseInt(a.mailbox_number) - parseInt(b.mailbox_number);
      })
      .slice(0, 10); // Limit results for performance

    const duration = performance.now() - startTime;
    
    // Log if search is slow (should be < 10ms)
    if (duration > 10) {
  console.warn(`Slow tenant search (${Math.round(duration)}ms) for query: "${query}"`);
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
      searchTenants(newValue);
      setShowDropdown(newValue.length > 0);
      setHighlightedIndex(-1);
    }, 50); // Very short debounce for instant feel
  };

  // Handle tenant selection
  const handleTenantSelect = (tenant: Tenant) => {
    setInputValue(`${tenant.mailbox_number} — ${tenant.name}`);
    setShowDropdown(false);
    setSearchResults([]);
    setHighlightedIndex(-1);
    onTenantSelect(tenant);
    onValueChange?.(`${tenant.mailbox_number} — ${tenant.name}`);
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
          handleTenantSelect(searchResults[highlightedIndex]);
        } else if (searchResults.length === 1) {
          handleTenantSelect(searchResults[0]);
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

  // Handle Enter key - validate tenant
  const handleEnterKey = async () => {
    const trimmedValue = inputValue.trim();
    
    // If it looks like a mailbox number, validate it
    const mailboxMatch = trimmedValue.match(/^(\d+)/);
    if (mailboxMatch) {
      const mailboxNumber = mailboxMatch[1];
      
      try {
        setIsSearching(true);
        const response = await api.tenant.getByMailbox(mailboxNumber);
        handleTenantSelect(response.tenant);
      } catch (err) {
        setError(`Mailbox ${mailboxNumber} not found`);
        // Select the input text for easy correction
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

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.length > 0) {
              searchTenants(inputValue);
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
          {searchResults.map((tenant, index) => (
            <div
              key={tenant.id}
              onClick={() => handleTenantSelect(tenant)}
              className={`tenant-option ${
                index === highlightedIndex ? 'highlighted' : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">
                    Mailbox {tenant.mailbox_number} — {tenant.name}
                  </div>
                  {tenant.phone && (
                    <div className="text-sm text-gray-500">
                      {tenant.phone}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  ID: {tenant.id}
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
            No tenants found for "{inputValue}"
          </div>
        </div>
      )}
    </div>
  );
}