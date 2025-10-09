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

// status label map previously used for badges, retained via compact helpers below

// Compact presentation helpers
const STATUS_SHORT: Record<string, string> = {
  received: 'Received',
  ready_for_pickup: 'Ready',
  picked_up: 'Pick',
  returned: 'Ret',
  returned_to_sender: 'RTS',
};

const STATUS_DOT_CLASS: Record<string, string> = {
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
  }, [selectedMailbox.id]);

  // Filter packages when search/filter changes
  useEffect(() => {
    let filtered = packages.slice();

    // Status filter
    if (statusFilter === 'available') {
      filtered = filtered.filter(pkg => ['received', 'ready_for_pickup'].includes(pkg.status));
    } else if (statusFilter === 'picked_up') {
      filtered = filtered.filter(pkg => pkg.status === 'picked_up');
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pkg =>
        pkg.tracking_number.toLowerCase().includes(query) ||
        (pkg.carrier ? pkg.carrier.toLowerCase() : '').includes(query) ||
        (pkg.recipient_name ? pkg.recipient_name.toLowerCase() : '').includes(query)
      );
    }

    // Tenant filter (if specific tenant selected)
    if (selectedTenant) {
      filtered = filtered.filter(pkg => pkg.tenant_id === selectedTenant.id);
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

    setWorkflow(prev => ({
      ...prev,
      selectedPackages: prev.selectedPackages.find(p => p.id === pkg.id)
        ? prev.selectedPackages.filter(p => p.id !== pkg.id)
        : [...prev.selectedPackages, pkg]
    }));
  };

  const startPickupProcess = () => {
    if (workflow.selectedPackages.length === 0) {
      onError?.('Please select at least one package');
      return;
    }

    setWorkflow(prev => ({ ...prev, step: 'verify' }));
  };

  const proceedToSignature = () => {
    if (!workflow.pickupPerson.trim()) {
      onError?.('Please enter the pickup person name');
      return;
    }

    setWorkflow(prev => ({ 
      ...prev, 
      step: 'signature',
      idVerified: true 
    }));
  };

  const handleSignatureComplete = (signature: SignatureData) => {
    setWorkflow(prev => ({
      ...prev,
      signature,
      step: 'confirm'
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
        package_ids: workflow.selectedPackages.map(p => p.id),
        tenant_id: selectedTenant.id,
        pickup_person_name: workflow.pickupPerson,
        signature_data: workflow.signature.dataURL,
        // Optional:
        // notes: undefined,
        // staff_initials: undefined,
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
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading packages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-green-900 mb-2">
          📤 Package Pickup
        </h3>
        <div className="text-sm text-green-700">
          <p>
            <strong>Mailbox:</strong> {selectedMailbox.mailbox_number}
            {selectedTenant && (
              <span className="ml-4">
                <strong>Tenant:</strong> {selectedTenant.name}
              </span>
            )}
          </p>
          {!isOnline && (
            <div className="mt-2 flex items-center text-orange-600">
              <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
              Working offline - pickups will be synced when connection returns
            </div>
          )}
        </div>
      </div>

      {workflow.step === 'list' && (
        <>
          {/* Search and Filter Controls */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900">Available Packages</h4>
              <div className="flex items-center space-x-4">
                <div className="flex space-x-2">
                  {(['all', 'available', 'picked_up'] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        statusFilter === filter
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {filter === 'all' ? 'All' : 
                       filter === 'available' ? 'Available' : 'Picked Up'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by tracking number, carrier, or recipient..."
                className="input-field"
                tabIndex={1}
              />
            </div>

            {/* Package List - Chart/Table style (ultra-compact) */}
            <div>
              {filteredPackages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📦</div>
                  <p>No packages found</p>
                  {statusFilter === 'available' && (
                    <p className="text-sm mt-1">No packages ready for pickup</p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 overflow-x-auto w-full">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col style={{ width: '38%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-2 py-2 text-left">Tracking</th>
                        <th className="px-2 py-2 text-left">Status</th>
                        <th className="px-2 py-2 text-left hidden sm:table-cell">Carrier</th>
                        <th className="px-2 py-2 text-left hidden md:table-cell">Size</th>
                        <th className="px-2 py-2 text-left">Received</th>
                        <th className="px-2 py-2 text-left">Pick up date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredPackages.map((pkg) => {
                        const isSelected = workflow.selectedPackages.find(p => p.id === pkg.id);
                        const canSelect = ['received', 'ready_for_pickup'].includes(pkg.status);
                        const dot = STATUS_DOT_CLASS[pkg.status] || 'bg-gray-300';
                        const label = pkg.status === 'picked_up' ? 'Picked Up' : (STATUS_SHORT[pkg.status] || pkg.status);
                        return (
                          <tr
                            key={pkg.id}
                            className={`${isSelected ? 'bg-blue-50' : ''} ${!canSelect ? 'opacity-60' : 'hover:bg-gray-50'} cursor-pointer`}
                            onClick={() => canSelect && togglePackageSelection(pkg)}
                            title={pkg.notes ? `Notes: ${pkg.notes}` : undefined}
                          >
                            <td className="px-2 py-1 align-middle whitespace-nowrap">
                              <span className="inline-flex items-center gap-2">
                                {canSelect && (
                                  <input
                                    type="checkbox"
                                    checked={!!isSelected}
                                    onChange={() => {}}
                                    aria-label={`Select ${pkg.tracking_number}`}
                                  />
                                )}
                                <span className="font-mono text-gray-900 truncate" title={pkg.tracking_number}>{pkg.tracking_number}</span>
                              </span>
                            </td>
                            <td className="px-2 py-1 align-middle whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                <span className={`inline-block w-2 h-2 rounded-full ${dot}`}></span>
                                <span className="text-xs text-gray-700">{label}</span>
                              </span>
                            </td>
                            <td className="px-2 py-1 align-middle hidden sm:table-cell text-gray-700 whitespace-nowrap">{pkg.carrier ? pkg.carrier.toUpperCase() : 'N/A'}</td>
                            <td className="px-2 py-1 align-middle hidden md:table-cell text-gray-700 whitespace-nowrap">{pkg.size ? pkg.size.replace('_', ' ') : 'N/A'}</td>
                            <td className="px-2 py-1 align-middle text-gray-700 whitespace-nowrap">{formatDate(pkg.received_at)}</td>
                            <td className="px-2 py-1 align-middle text-gray-700 whitespace-nowrap">
                              {pkg.status === 'picked_up'
                                ? (pkg.pickup_date ? formatDate(pkg.pickup_date) : 'Picked up')
                                : 'Due for pickup'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Selected Packages Summary */}
            {workflow.selectedPackages.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-900">
                      {workflow.selectedPackages.length} package{workflow.selectedPackages.length !== 1 ? 's' : ''} selected for pickup
                    </p>
                    <p className="text-sm text-blue-700">
                      Tracking: {workflow.selectedPackages.map(p => p.tracking_number).join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={startPickupProcess}
                    className="btn btn-primary"
                    tabIndex={2}
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
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            Verify Pickup Information
          </h4>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="pickup_person" className="block text-sm font-medium text-gray-700 mb-1">
                Person Picking Up Packages *
              </label>
              <input
                id="pickup_person"
                type="text"
                value={workflow.pickupPerson}
                onChange={(e) => setWorkflow(prev => ({ ...prev, pickupPerson: e.target.value }))}
                className="input-field"
                placeholder="Full name of person picking up"
                autoFocus
              />
            </div>

            <div className="bg-gray-50 p-4 rounded border">
              <h5 className="font-medium text-gray-900 mb-2">
                Packages to be picked up ({workflow.selectedPackages.length}):
              </h5>
              <ul className="space-y-1 text-sm text-gray-600">
                {workflow.selectedPackages.map(pkg => (
                  <li key={pkg.id} className="flex justify-between">
                    <span>{pkg.tracking_number}</span>
                    <span>{pkg.carrier ? pkg.carrier.toUpperCase() : 'N/A'}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={proceedToSignature}
                disabled={!workflow.pickupPerson.trim()}
                className="btn btn-primary"
              >
                Continue to Signature →
              </button>
              <button
                onClick={cancelPickup}
                className="btn bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                ← Back to List
              </button>
            </div>
          </div>
        </div>
      )}

      {workflow.step === 'signature' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            Digital Signature Required
          </h4>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              <strong>{workflow.pickupPerson}</strong>, please sign below to confirm pickup of {workflow.selectedPackages.length} package{workflow.selectedPackages.length !== 1 ? 's' : ''}.
            </p>

            <SignaturePad
              onSignatureComplete={handleSignatureComplete}
              width={500}
              height={200}
              className="w-full"
            />

            <div className="flex space-x-3">
              <button
                onClick={() => setWorkflow(prev => ({ ...prev, step: 'verify' }))}
                className="btn bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {workflow.step === 'confirm' && workflow.signature && (
        <SignatureVerification
          signature={workflow.signature}
          recipientName={workflow.pickupPerson}
          onConfirm={confirmPickup}
          onRetry={() => setWorkflow(prev => ({ ...prev, step: 'signature', signature: null }))}
        />
      )}
    </div>
  );
};

export default PackagePickup;