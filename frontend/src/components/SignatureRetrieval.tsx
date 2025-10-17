import React, { useState, useEffect, useRef } from 'react';
import { searchPackagesByDateRange, getSignatureByPackageId } from '../services/api';
import MailboxLookup from './MailboxLookup';
import type { Mailbox, Package } from '../types';

interface SignatureRetrievalProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

interface SignatureData {
  id: number;
  package_id: number;
  signature_data?: string;
  created_at: string;
  tracking_number?: string;
  status?: string;
  pickup_date?: string;
  pickup_by?: string;
  pickup_person_name?: string;
  tenant_name?: string;
  mailbox_number?: string;
}

const SignatureRetrieval: React.FC<SignatureRetrievalProps> = ({ onError, onSuccess }) => {
  // Search mode
  const [searchMode, setSearchMode] = useState<'tracking' | 'advanced'>('tracking');
  
  // Tracking number search
  const [trackingNumber, setTrackingNumber] = useState('');
  
  // Advanced search
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [mailboxLookupValue, setMailboxLookupValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Results
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  
  // UI state
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSignature, setIsLoadingSignature] = useState(false);
  const trackingInputRef = useRef<HTMLInputElement>(null);



  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Focus tracking input when switching to tracking mode
  useEffect(() => {
    if (searchMode === 'tracking' && trackingInputRef.current) {
      trackingInputRef.current.focus();
    }
  }, [searchMode]);

  const handleTrackingSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!trackingNumber.trim()) {
      onError?.('Please enter a tracking number');
      return;
    }

    setIsSearching(true);
    setPackages([]);
    setSelectedPackage(null);
    setSignatureData(null);

    try {
      // Search across all mailboxes and time for this tracking number
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const results = await searchPackagesByDateRange(
        null, // All mailboxes
        oneYearAgo.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
        'picked_up' // Only picked up packages have signatures
      );

      // Filter by tracking number (case-insensitive partial match)
      const filtered = results.filter((pkg: Package) => 
        pkg.tracking_number?.toLowerCase().includes(trackingNumber.toLowerCase())
      );

      if (filtered.length === 0) {
        onError?.('No picked up packages found with that tracking number');
      } else if (filtered.length === 1) {
        // Auto-select if only one result
        setPackages(filtered);
        await loadSignature(filtered[0]);
      } else {
        setPackages(filtered);
        onSuccess?.(`Found ${filtered.length} packages matching "${trackingNumber}"`);
      }
    } catch (err) {
      console.error('Error searching by tracking number:', err);
      onError?.('Failed to search for package');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdvancedSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMailbox) {
      onError?.('Please select a mailbox');
      return;
    }

    if (!startDate || !endDate) {
      onError?.('Please select a date range');
      return;
    }

    setIsSearching(true);
    setPackages([]);
    setSelectedPackage(null);
    setSignatureData(null);

    try {
      const results = await searchPackagesByDateRange(
        selectedMailbox.id,
        startDate,
        endDate,
        'picked_up' // Only picked up packages have signatures
      );

      if (results.length === 0) {
        onError?.('No picked up packages found for the selected criteria');
      } else {
        setPackages(results);
        onSuccess?.(`Found ${results.length} picked up package(s)`);
      }
    } catch (err) {
      console.error('Error searching packages:', err);
      onError?.('Failed to search for packages');
    } finally {
      setIsSearching(false);
    }
  };

  const loadSignature = async (pkg: Package) => {
    setSelectedPackage(pkg);
    setSignatureData(null);
    setIsLoadingSignature(true);

    try {
      const data = await getSignatureByPackageId(pkg.id);
      setSignatureData(data.signature);
      onSuccess?.('Signature loaded successfully');
    } catch (err) {
      console.error('Error loading signature:', err);
      onError?.('Failed to load signature for this package');
    } finally {
      setIsLoadingSignature(false);
    }
  };

  const handleReset = () => {
    setTrackingNumber('');
    setSelectedMailbox(null);
    setMailboxLookupValue('');
    setPackages([]);
    setSelectedPackage(null);
    setSignatureData(null);
    
    // Reset to default date range
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6" data-testid="signature-retrieval-root">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Signature Retrieval
        </h2>
        <p className="text-gray-600">
          Search for picked up packages and view their signatures
        </p>
      </div>

      {/* Search Mode Toggle */}
      <div className="flex justify-center gap-2" data-testid="search-mode-toggle">
        <button
          onClick={() => {
            setSearchMode('tracking');
            handleReset();
          }}
          data-testid="search-mode-tracking"
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            border: searchMode === 'tracking' ? '2px solid #3b82f6' : '2px solid #e5e7eb',
            background: searchMode === 'tracking' ? '#eff6ff' : 'white',
            color: searchMode === 'tracking' ? '#1e40af' : '#6b7280',
            fontWeight: searchMode === 'tracking' ? '600' : '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📦 Quick Search (Tracking #)
        </button>
        <button
          onClick={() => {
            setSearchMode('advanced');
            handleReset();
          }}
          data-testid="search-mode-advanced"
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            border: searchMode === 'advanced' ? '2px solid #3b82f6' : '2px solid #e5e7eb',
            background: searchMode === 'advanced' ? '#eff6ff' : 'white',
            color: searchMode === 'advanced' ? '#1e40af' : '#6b7280',
            fontWeight: searchMode === 'advanced' ? '600' : '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🔍 Advanced Search (Mailbox + Date)
        </button>
      </div>

      {/* Search Forms */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
      }}>
        {searchMode === 'tracking' ? (
          /* Tracking Number Search */
          <form onSubmit={handleTrackingSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tracking Number
              </label>
              <input
                ref={trackingInputRef}
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number..."
                data-testid="tracking-number-input"
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter full or partial tracking number to find package
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSearching}
                data-testid="tracking-search-button"
                style={{
                  flex: 1,
                  background: isSearching ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  padding: '0.625rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: isSearching ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
                }}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                data-testid="tracking-reset-button"
                style={{
                  padding: '0.625rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 'var(--radius-md)',
                  background: 'white',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Reset
              </button>
            </div>
          </form>
        ) : (
          /* Advanced Search */
          <form onSubmit={handleAdvancedSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mailbox
              </label>
              <MailboxLookup
                onMailboxSelect={(mailbox) => {
                  setSelectedMailbox(mailbox);
                }}
                onClearSelection={() => {
                  setSelectedMailbox(null);
                  setMailboxLookupValue('');
                }}
                placeholder="Type mailbox number (e.g., 145)"
                autoFocus={false}
                value={mailboxLookupValue}
                onValueChange={setMailboxLookupValue}
              />
              {selectedMailbox && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: '#eff6ff',
                  border: '1px solid #3b82f6',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  color: '#1e40af',
                }}>
                  ✓ Selected: Mailbox {selectedMailbox.mailbox_number}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="start-date-input"
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="end-date-input"
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSearching}
                data-testid="advanced-search-button"
                style={{
                  flex: 1,
                  background: isSearching ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  padding: '0.625rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: isSearching ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
                }}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                data-testid="advanced-reset-button"
                style={{
                  padding: '0.625rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 'var(--radius-md)',
                  background: 'white',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Reset
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Package Results */}
      {packages.length > 0 && !selectedPackage && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
        }}>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Search Results ({packages.length})
          </h3>
          <div className="space-y-2">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => loadSignature(pkg)}
                data-testid={`package-result-${pkg.id}`}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: 'var(--radius-md)',
                  background: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {pkg.tracking_number}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Mailbox: {pkg.mailbox_number} • Tenant: {pkg.tenant_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Picked up: {formatDateTime(pkg.pickup_date!)}
                    </div>
                  </div>
                  <div style={{
                    padding: '0.25rem 0.75rem',
                    background: '#dcfce7',
                    color: '#166534',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}>
                    View Signature →
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Signature Display */}
      {selectedPackage && (
        <div style={{
          background: 'white',
          border: '2px solid #3b82f6',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
        }} data-testid="signature-display">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Package Signature
            </h3>
            <button
              onClick={() => {
                setSelectedPackage(null);
                setSignatureData(null);
              }}
              data-testid="close-signature-button"
              style={{
                padding: '0.375rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: 'var(--radius-md)',
                background: 'white',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Package Details */}
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Tracking Number</div>
                <div className="font-semibold text-gray-900">{selectedPackage.tracking_number}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Mailbox</div>
                <div className="font-semibold text-gray-900">{selectedPackage.mailbox_number}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Tenant</div>
                <div className="font-semibold text-gray-900">{selectedPackage.tenant_name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Picked Up</div>
                <div className="font-semibold text-gray-900">
                  {formatDateTime(selectedPackage.pickup_date!)}
                </div>
              </div>
              {signatureData && (
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 mb-1">Picked Up By</div>
                  <div className="font-semibold text-gray-900">
                    {signatureData.pickup_person_name || signatureData.pickup_by || selectedPackage.pickup_by || 'Not recorded'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signature Image */}
          {isLoadingSignature ? (
            <div className="text-center py-12">
              <div className="text-gray-500">Loading signature...</div>
            </div>
          ) : signatureData ? (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                Signature
              </div>
              <div style={{
                border: '2px solid #e5e7eb',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                background: 'white',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <img
                  src={signatureData.signature_data}
                  alt="Package pickup signature"
                  data-testid="signature-image"
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    border: '1px solid #e5e7eb',
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-2 text-center">
                Signature captured on {formatDateTime(signatureData.created_at)}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-2">⚠️</div>
              <div>No signature found for this package</div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {packages.length === 0 && !selectedPackage && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">🔍</div>
          <div className="font-medium text-gray-600">
            {searchMode === 'tracking' 
              ? 'Enter a tracking number to search'
              : 'Select mailbox and date range to search for packages'}
          </div>
        </div>
      )}
    </div>
  );
};

export default SignatureRetrieval;
