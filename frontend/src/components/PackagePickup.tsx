/**
 * Package Pickup Interface for E3 Package Manager
 * Handles package retrieval, verification, and checkout with signature capture
 */

import React, { useState, useEffect, useRef } from 'react';
import SignaturePad, { SignatureVerification, type SignatureData } from './SignaturePad';
import { useOfflineOperations } from '../hooks/useOffline';
import type { Mailbox, Tenant } from '../types';

interface PackagePickupProps {
  selectedMailbox: Mailbox;
  selectedTenant?: Tenant | null;
  onSuccess?: (pickupData: any) => void;
  onError?: (error: string) => void;
}

interface Package {
  id: number;
  tracking_number: string;
  carrier: string | null;
  size: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  notes?: string | null;
  received_at: string;
  received_by?: string | null;
  pickup_date?: string | null;
  pickup_signature?: string | null;
  status: 'received' | 'ready_for_pickup' | 'picked_up' | 'returned' | 'returned_to_sender';
  tenant_id?: number | null;
}

interface PickupWorkflowState {
  step: 'list' | 'verify' | 'signature' | 'confirm';
  selectedPackages: Package[];
  signature: SignatureData | null;
  pickupPerson: string;
  idVerified: boolean;
}

// Compact presentation helpers
const STATUS_SHORT: { [key: string]: string } = {
  received: 'Received',
  ready_for_pickup: 'Ready',
  picked_up: 'Pick',
  returned: 'Ret',
  returned_to_sender: 'RTS',
};

const STATUS_DOT_CLASS: { [key: string]: string } = {
  received: 'bg-blue-500',
  ready_for_pickup: 'bg-green-500',
  picked_up: 'bg-gray-400',
  returned: 'bg-red-500',
  returned_to_sender: 'bg-red-500',
};

export const PackagePickup: React.FC<PackagePickupProps> = ({
  selectedMailbox,
  selectedTenant,
  onSuccess,
  onError,
}) => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'picked_up'>('available');

  const [workflow, setWorkflow] = useState<PickupWorkflowState>({
    step: 'list',
    selectedPackages: [],
    signature: null,
    pickupPerson: selectedTenant?.name || '',
    idVerified: false,
  });

  const searchRef = useRef<HTMLInputElement>(null);
  const { isOnline, queuePackagePickup } = useOfflineOperations();

  // Load packages for the selected mailbox
  useEffect(() => {
    loadPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMailbox.id]);

  // Filter packages when search/filter changes
  useEffect(() => {
    let filtered = packages.slice();

    // Status filter
    if (statusFilter === 'available') {
      filtered = filtered.filter((pkg) => ['received', 'ready_for_pickup'].includes(pkg.status));
    } else if (statusFilter === 'picked_up') {
      filtered = filtered.filter((pkg) => pkg.status === 'picked_up');
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (pkg) =>
          pkg.tracking_number.toLowerCase().includes(query) ||
          (pkg.carrier ? pkg.carrier.toLowerCase() : '').includes(query) ||
          (pkg.recipient_name ? pkg.recipient_name.toLowerCase() : '').includes(query)
      );
    }

    // Tenant filter (if specific tenant selected)
    if (selectedTenant) {
      filtered = filtered.filter((pkg) => pkg.tenant_id === selectedTenant.id);
    }

    setFilteredPackages(filtered);
  }, [packages, searchQuery, statusFilter, selectedTenant]);

  const loadPackages = async () => {
    setIsLoading(true);
    try {
      if (isOnline) {
        const response = await fetch(`http://localhost:3001/api/packages/mailbox/${selectedMailbox.id}`);
        if (!response.ok) {
          throw new Error(`Failed to load packages: ${response.status}`);
        }
        const data = await response.json();
        setPackages(data);
      } else {
        // TODO: Load from offline cache
        setPackages([]);
        onError?.('Offline mode - package list not available');
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to load packages');
      setPackages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePackageSelection = (pkg: Package) => {
    if (pkg.status === 'picked_up') return; // Can't pick up already picked up packages

    setWorkflow((prev) => ({
      ...prev,
      selectedPackages: prev.selectedPackages.find((p) => p.id === pkg.id)
        ? prev.selectedPackages.filter((p) => p.id !== pkg.id)
        : [...prev.selectedPackages, pkg],
    }));
  };

  const startPickupProcess = () => {
    if (workflow.selectedPackages.length === 0) {
      onError?.('Please select at least one package');
      return;
    }
    setWorkflow((prev) => ({ ...prev, step: 'verify' }));
  };

  const proceedToSignature = () => {
    if (!workflow.pickupPerson.trim()) {
      onError?.('Please enter the pickup person name');
      return;
    }

    setWorkflow((prev) => ({ ...prev, step: 'signature', idVerified: true }));
  };

  const handleSignatureChange = (signature: SignatureData | null) => {
    setWorkflow((prev) => ({
      ...prev,
      signature: signature,
    }));
  };

  const confirmPickup = async () => {
    if (!workflow.signature) {
      onError?.('Signature is required');
      return;
    }

    if (!selectedTenant) {
      onError?.('Select a tenant before confirming pickup.');
      return;
    }

    try {
      const pickupData = {
        package_ids: workflow.selectedPackages.map((p) => p.id),
        tenant_id: selectedTenant.id,
        pickup_person_name: workflow.pickupPerson,
        signature_data: workflow.signature.dataURL,
      };

      if (isOnline) {
        const response = await fetch('http://localhost:3001/api/pickups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pickupData),
        });

        if (!response.ok) {
          throw new Error(`Pickup failed: ${response.status}`);
        }

        const result = await response.json();
        try {
          onSuccess?.(result);
        } catch (cbErr) {
          console.warn('Pickup onSuccess handler threw:', cbErr);
        }
      } else {
        const queueId = queuePackagePickup(pickupData, selectedMailbox.id.toString());
        try {
          onSuccess?.({ ...pickupData, queueId, offline: true });
        } catch (cbErr) {
          console.warn('Pickup onSuccess handler threw (offline):', cbErr);
        }
      }

      // Reset workflow
      setWorkflow({
        step: 'list',
        selectedPackages: [],
        signature: null,
        pickupPerson: selectedTenant?.name || '',
        idVerified: false,
      });

      // Reload packages to reflect pickup
      loadPackages();
    } catch (error) {
      console.error('Pickup error:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to process pickup');
    }
  };

  const cancelPickup = () => {
    setWorkflow({
      step: 'list',
      selectedPackages: [],
      signature: null,
      pickupPerson: selectedTenant?.name || '',
      idVerified: false,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 0',
        }}
        data-testid="pickup-loading"
      >
        <div style={{ textAlign: 'center' }}>
          <div 
            style={{
              width: '3rem',
              height: '3rem',
              border: '3px solid #3b82f6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }}
          ></div>
          <p style={{ 
            color: 'var(--color-gray-600)',
            fontSize: '1rem',
            fontWeight: '500'
          }}>
            Loading packages...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pickup-root">
      {workflow.step === 'list' && (
        <>
          {/* Search and Filter Controls */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid #e2e8f0',
              boxShadow: 'var(--shadow-md)',
            }}
            data-testid="pickup-step-list"
          >
            {/* Section Header */}
            <div 
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                padding: '1rem 1.5rem',
                borderTopLeftRadius: 'var(--radius-lg)',
                borderTopRightRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>✅</span>
                <h4 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '600', 
                  color: 'white',
                  margin: 0
                }}>
                  Available Packages
                </h4>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }} data-testid="pickup-status-filter">
                {(['all', 'available', 'picked_up'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    data-testid={`pickup-filter-${filter}`}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      border: 'none',
                      cursor: 'pointer',
                      background: statusFilter === filter 
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : 'rgba(255, 255, 255, 0.9)',
                      color: statusFilter === filter ? 'white' : '#374151',
                      boxShadow: statusFilter === filter ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {filter === 'all' ? '📋 All' : filter === 'available' ? '✅ Available' : '📦 Picked Up'}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div style={{ padding: '1.5rem 1.5rem 0' }}>
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search by tracking number, carrier, or recipient..."
                className="input-field"
                tabIndex={1}
                data-testid="pickup-search-input"
                style={{ width: '100%' }}
              />
            </div>

            {/* Package List */}
            <div style={{ padding: '1.5rem' }}>
              {filteredPackages.length === 0 ? (
                <div 
                  style={{ 
                    textAlign: 'center', 
                    padding: '3rem 0',
                    color: 'var(--color-gray-500)'
                  }} 
                  data-testid="pickup-no-packages"
                >
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
                  <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.5rem' }}>No packages found</p>
                  {statusFilter === 'available' && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-400)' }}>
                      No packages ready for pickup
                    </p>
                  )}
                </div>
              ) : (
                <div 
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid #cbd5e1',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                    background: 'white',
                  }}
                  data-testid="pickup-table-container"
                >
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table 
                      style={{ 
                        width: '100%', 
                        tableLayout: 'fixed',
                        fontSize: '0.875rem'
                      }}
                      data-testid="pickup-table"
                    >
                      <colgroup>
                        <col style={{ width: '42%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '14%' }} />
                      </colgroup>
                      <thead 
                        style={{
                          background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                          color: 'var(--color-gray-700)',
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          fontWeight: '600',
                        }}
                      >
                        <tr>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }} data-testid="pickup-col-tracking">Tracking</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }} data-testid="pickup-col-status">Status</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }} data-testid="pickup-col-carrier">Carrier</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }} data-testid="pickup-col-received">Received</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }} data-testid="pickup-col-pickup-date">Pick up date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPackages.map((pkg, index) => {
                          const isSelected = workflow.selectedPackages.find((p) => p.id === pkg.id);
                          const canSelect = ['received', 'ready_for_pickup'].includes(pkg.status);
                          const dot = STATUS_DOT_CLASS[pkg.status] || 'bg-gray-300';
                          const label = pkg.status === 'picked_up' ? 'Picked Up' : STATUS_SHORT[pkg.status] || pkg.status;
                          return (
                            <tr
                              key={pkg.id}
                              style={{
                                background: isSelected 
                                  ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                                  : index % 2 === 0 ? 'white' : '#f8fafc',
                                opacity: !canSelect ? 0.6 : 1,
                                cursor: canSelect ? 'pointer' : 'default',
                                borderBottom: index < filteredPackages.length - 1 ? '1px solid #e2e8f0' : 'none',
                                transition: 'all 0.2s ease',
                              }}
                              onClick={() => canSelect && togglePackageSelection(pkg)}
                              title={pkg.notes ? `Notes: ${pkg.notes}` : undefined}
                              data-testid={`pickup-row-${pkg.id}`}
                              onMouseEnter={(e) => {
                                if (canSelect && !isSelected) {
                                  e.currentTarget.style.background = '#f1f5f9';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (canSelect && !isSelected) {
                                  e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f8fafc';
                                }
                              }}
                            >
                              <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {canSelect && (
                                    <input
                                      type="checkbox"
                                      checked={!!isSelected}
                                      onChange={() => {}}
                                      aria-label={`Select ${pkg.tracking_number}`}
                                      data-testid={`pickup-select-${pkg.id}`}
                                      style={{
                                        width: '1.125rem',
                                        height: '1.125rem',
                                        cursor: 'pointer',
                                        accentColor: '#3b82f6',
                                      }}
                                    />
                                  )}
                                  <span 
                                    style={{ 
                                      fontFamily: 'var(--font-mono)',
                                      color: 'var(--color-gray-900)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      fontWeight: '500'
                                    }}
                                    title={pkg.tracking_number}
                                  >
                                    {pkg.tracking_number}
                                  </span>
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                                  <span className={`inline-block w-2 h-2 rounded-full ${dot}`}></span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-700)', fontWeight: '500' }}>
                                    {label}
                                  </span>
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle', color: 'var(--color-gray-700)', whiteSpace: 'nowrap' }}>
                                {pkg.carrier ? pkg.carrier.toUpperCase() : 'N/A'}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle', color: 'var(--color-gray-700)', whiteSpace: 'nowrap' }}>
                                {formatDate(pkg.received_at)}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle', color: 'var(--color-gray-700)', whiteSpace: 'nowrap' }}>
                                {pkg.status === 'picked_up' ? (pkg.pickup_date ? formatDate(pkg.pickup_date) : 'Picked up') : 'Due for pickup'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Packages Summary */}
            {workflow.selectedPackages.length > 0 && (
              <div 
                style={{
                  margin: '1.5rem',
                  marginTop: '0',
                  padding: '1.25rem 1.5rem',
                  background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                  border: '2px solid #93c5fd',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                }}
                data-testid="pickup-selection-summary"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <p style={{ 
                      fontWeight: '600', 
                      color: '#1e40af',
                      fontSize: '1rem',
                      marginBottom: '0.5rem'
                    }}>
                      ✓ {workflow.selectedPackages.length} package{workflow.selectedPackages.length !== 1 ? 's' : ''} selected for pickup
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#1e40af', fontFamily: 'var(--font-mono)' }}>
                      {workflow.selectedPackages.map((p) => p.tracking_number).join(', ')}
                    </p>
                  </div>
                  <button 
                    onClick={startPickupProcess} 
                    className="btn btn-primary" 
                    tabIndex={2} 
                    data-testid="pickup-proceed"
                    style={{
                      padding: '0.75rem 1.75rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Proceed to Pickup →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {workflow.step === 'verify' && (
        <div 
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '2px solid #e2e8f0',
            boxShadow: 'var(--shadow-md)',
          }}
          data-testid="pickup-step-verify"
        >
          {/* Section Header */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: '1rem 1.5rem',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>🔍</span>
            <h4 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              color: 'white',
              margin: 0
            }}>
              Verify Pickup Information
            </h4>
          </div>

          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Pickup Person Input */}
            <div>
              <label 
                htmlFor="pickup_person" 
                style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '600', 
                  color: 'var(--color-gray-700)', 
                  marginBottom: '0.5rem'
                }}
              >
                👤 Person Picking Up Packages *
              </label>
              <input
                id="pickup_person"
                type="text"
                value={workflow.pickupPerson}
                onChange={(e) => setWorkflow((prev) => ({ ...prev, pickupPerson: e.target.value }))}
                className="input-field"
                placeholder="Full name of person picking up"
                autoFocus
                data-testid="pickup-person-input"
                style={{ width: '100%' }}
              />
            </div>

            {/* Package List */}
            <div 
              style={{
                background: 'white',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '2px solid #cbd5e1',
                boxShadow: 'var(--shadow-sm)',
              }}
              data-testid="pickup-verify-list"
            >
              <h5 style={{ 
                fontWeight: '600', 
                color: 'var(--color-gray-900)', 
                marginBottom: '1rem',
                fontSize: '1rem'
              }}>
                📦 Packages to be picked up ({workflow.selectedPackages.length})
              </h5>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {workflow.selectedPackages.map((pkg, index) => (
                  <li 
                    key={pkg.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: index % 2 === 0 ? '#f8fafc' : 'white',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-gray-900)' }}>
                      {pkg.tracking_number}
                    </span>
                    <span style={{ color: 'var(--color-gray-600)' }}>
                      {pkg.carrier ? pkg.carrier.toUpperCase() : 'N/A'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={proceedToSignature}
                disabled={!workflow.pickupPerson.trim()}
                className="btn btn-primary"
                data-testid="pickup-continue-signature"
                style={{
                  padding: '0.75rem 1.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
              >
                Continue to Signature →
              </button>
              <button 
                onClick={cancelPickup} 
                className="btn btn-secondary" 
                data-testid="pickup-back-to-list"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
              >
                ← Back to List
              </button>
            </div>
          </div>
        </div>
      )}

      {workflow.step === 'signature' && (
        <div 
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '2px solid #e2e8f0',
            boxShadow: 'var(--shadow-md)',
          }}
          data-testid="pickup-step-signature"
        >
          {/* Section Header */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              padding: '1rem 1.5rem',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>✍️</span>
            <h4 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              color: 'white',
              margin: 0
            }}>
              Digital Signature Required
            </h4>
          </div>

          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Instructions */}
            <div 
              style={{
                background: 'white',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '2px solid #cbd5e1',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <p style={{ color: 'var(--color-gray-700)', fontSize: '0.9375rem', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--color-gray-900)' }}>{workflow.pickupPerson}</strong>, please sign below to confirm pickup of{' '}
                <strong>{workflow.selectedPackages.length}</strong> package{workflow.selectedPackages.length !== 1 ? 's' : ''}.
              </p>
            </div>

            {/* Signature Pad */}
            <div data-testid="pickup-signature-pad">
              <SignaturePad onSignatureChange={handleSignatureChange} width={500} height={200} className="w-full" />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  if (!workflow.signature) {
                    onError?.('Please provide a signature before confirming.');
                    return;
                  }
                  setWorkflow((prev) => ({ ...prev, step: 'confirm' }));
                }}
                disabled={!workflow.signature}
                className="btn btn-primary"
                data-testid="pickup-confirm-signature"
                style={{
                  padding: '0.75rem 1.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  opacity: !workflow.signature ? 0.5 : 1,
                }}
              >
                ✓ Confirm Signature
              </button>
              <button
                onClick={() => setWorkflow((prev) => ({ ...prev, step: 'verify' }))}
                className="btn btn-secondary"
                data-testid="pickup-back-to-verify"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {workflow.step === 'confirm' && workflow.signature && (
        <div data-testid="pickup-verification">
          <SignatureVerification
            signature={workflow.signature}
            recipientName={workflow.pickupPerson}
            onConfirm={confirmPickup}
            onRetry={() => setWorkflow((prev) => ({ ...prev, step: 'signature', signature: null }))}
          />
        </div>
      )}
    </div>
  );
};

export default PackagePickup;