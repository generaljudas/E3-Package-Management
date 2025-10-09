/**
 * Package Intake Interface for E3 Package Manager
 * Main component for scanning and registering new packages
 */

import React, { useState, useEffect, useRef } from 'react';
import BarcodeScanner, { type BarcodeScanResult } from './BarcodeScanner';
import { useOfflineOperations } from '../hooks/useOffline';
import type { Mailbox, Tenant } from '../types';

interface PackageIntakeProps {
  selectedMailbox: Mailbox;
  selectedTenant?: Tenant | null;
  onSuccess?: (packageData: any) => void;
  onError?: (error: string) => void;
}

// SIMPLIFIED MODEL: Only tracking number needed during intake
// Mailbox and tenant come from context
interface PackageFormData {
  tracking_number: string;
}





export const PackageIntake: React.FC<PackageIntakeProps> = ({
  selectedMailbox,
  selectedTenant,
  onSuccess,
  onError,
}) => {
  const trackingNumberRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const [formData, setFormData] = useState<PackageFormData>({
    tracking_number: '',
  });
  // Batch state: array of scanned tracking numbers
  const [batch, setBatch] = useState<string[]>([]);

  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isOnline, queuePackageIntake } = useOfflineOperations();

  // Detect carrier from tracking number with certainty based on simple heuristics
  // - UPS: starts with "1Z"
  // - FedEx: starts with "9"
  // - USPS: 20-22 digits (all numeric)
  // If multiple rules match (e.g., starts with 9 and 20-22 digits), return undefined (not certain)
  const detectCarrier = (raw: string): 'UPS' | 'FedEx' | 'USPS' | undefined => {
    const normalized = raw.replace(/[^A-Za-z0-9]/g, '');
    const upper = normalized.toUpperCase();
    const isDigits = /^[0-9]+$/.test(normalized);
    const len = normalized.length;

    const ups = upper.startsWith('1Z');
    const fedex = upper.startsWith('9');
    const usps = isDigits && len >= 20 && len <= 22;

    const matches = [ups ? 'UPS' : null, fedex ? 'FedEx' : null, usps ? 'USPS' : null].filter(Boolean) as Array<'UPS'|'FedEx'|'USPS'>;
    if (matches.length === 1) return matches[0];
    return undefined;
  };

  // Auto-focus tracking number field on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      trackingNumberRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleBarcodeScan = (result: BarcodeScanResult) => {
    // Only add if not already in batch
    if (!batch.includes(result.code)) {
      setBatch(prev => [...prev, result.code]);
      setFormData({ tracking_number: '' }); // Clear input for next scan
      // Auto-focus for continuous scanning
      setTimeout(() => trackingNumberRef.current?.focus(), 100);
    }
  };

  const handleInputChange = (value: string) => {
    setFormData({ tracking_number: value });
  };

  // Keyboard: Ctrl/Cmd+Enter submits
  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Add formData to batch manually (for manual entry)
  const addToBatch = () => {
    const trimmed = formData.tracking_number.trim();
    if (!trimmed) return;
    if (batch.includes(trimmed)) {
      onError?.('Tracking number already in batch');
      return;
    }
    setBatch(prev => [...prev, trimmed]);
    setFormData({ tracking_number: '' });
    // Auto-focus for next scan
    setTimeout(() => trackingNumberRef.current?.focus(), 50);
  };

  const removeFromBatch = (tracking_number: string) => {
    setBatch(prev => prev.filter(t => t !== tracking_number));
  };



  const handleSubmit = async () => {
    // Ensure a tenant is selected (required for intake)
    if (!selectedTenant) {
      onError?.('Select a tenant before registering packages.');
      return;
    }

    // Build the effective batch: use existing batch or the current input if batch is empty
    const trimmedInput = formData.tracking_number.trim();
    const effectiveBatch = batch.length > 0 ? batch : (trimmedInput ? [trimmedInput] : []);
    if (effectiveBatch.length === 0) {
      onError?.('Scan or enter at least one package.');
      return;
    }

    setIsSubmitting(true);

    try {
      // SIMPLIFIED: Only send tracking_number and tenant_id
      // Backend will auto-populate mailbox_id from tenant
      // All other fields get backend defaults
      const batchWithMeta = effectiveBatch.map(trackingNumber => {
        const carrier = detectCarrier(trackingNumber);
        const payload: any = {
          tracking_number: trackingNumber,
          tenant_id: selectedTenant?.id || null,
        };
        if (carrier) payload.carrier = carrier;
        return payload;
      });

      if (isOnline) {
        let anyError = false;
        let errorMsg = '';
        for (const packageData of batchWithMeta) {
          const response = await fetch('http://localhost:3001/api/packages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(packageData),
          });
          if (!response.ok) {
            anyError = true;
            try {
              const err = await response.json();
              errorMsg += `Tracking ${packageData.tracking_number}: ${err.error || response.status}\n`;
            } catch {
              errorMsg += `Tracking ${packageData.tracking_number}: Server error ${response.status}\n`;
            }
          }
        }
        if (anyError) {
          throw new Error(errorMsg.trim());
        }
        onSuccess?.({ batch: batchWithMeta });
      } else {
        // Queue for offline sync
        for (const packageData of batchWithMeta) {
          queuePackageIntake(packageData, selectedMailbox.id.toString(), selectedTenant?.id?.toString());
        }
        onSuccess?.({ batch: batchWithMeta, offline: true });
      }

      // Reset batch and form
      setBatch([]);
      setFormData({ tracking_number: '' });

    } catch (error) {
      console.error('Package intake error:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to register package');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">📥 Package Intake</h3>
        <div className="text-sm text-blue-700">
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
              Working offline - package will be synced when connection returns
            </div>
          )}
        </div>
      </div>

      {/* Barcode Scanner Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-gray-900">1. Scan Package Barcode</h4>
          <button
            onClick={() => setIsScannerActive(!isScannerActive)}
            className={`btn ${isScannerActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'}`}
          >
            {isScannerActive ? 'Stop Scanner' : 'Start Scanner'}
          </button>
        </div>
        <BarcodeScanner
          isActive={isScannerActive}
          onScan={handleBarcodeScan}
          onError={(error) => onError?.(error)}
          className="mb-4"
        />
        <div className="mt-4 flex space-x-2">
          <input
            ref={trackingNumberRef}
            id="tracking_number"
            type="text"
            value={formData.tracking_number}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan or type tracking number"
            className="input-field flex-1"
            autoComplete="off"
            tabIndex={1}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addToBatch}
            disabled={!formData.tracking_number.trim() || batch.includes(formData.tracking_number.trim())}
          >
            Add
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">Scan or enter each package, then click Add or scan next.</div>
        {/* Batch List */}
        {batch.length > 0 && (
          <div className="mt-6">
            <h5 className="font-semibold text-gray-800 mb-2">Batch to Register:</h5>
            <ul className="divide-y divide-gray-200 bg-gray-50 rounded border border-gray-200">
              {batch.map(trackingNumber => (
                <li key={trackingNumber} className="flex items-center justify-between px-4 py-2">
                  <span className="font-mono">{trackingNumber}</span>
                  <button
                    type="button"
                    className="text-red-600 hover:underline text-xs ml-2"
                    onClick={() => removeFromBatch(trackingNumber)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={() => {
            setFormData({ tracking_number: '' });
            setBatch([]);
          }}
          className="btn btn-secondary"
          disabled={isSubmitting}
        >
          Clear Form
        </button>
        <button
          ref={submitButtonRef}
          onClick={handleSubmit}
          disabled={isSubmitting || (batch.length === 0 && !formData.tracking_number.trim())}
          className="btn btn-primary flex items-center"
          tabIndex={4}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              {isOnline ? 'Registering...' : 'Queueing...'}
            </>
          ) : (
            <>
              {batch.length > 0 ? `✓ Register Batch (${batch.length})` : '✓ Register Package'}
              {!isOnline && <span className="ml-2 text-xs">(Offline)</span>}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PackageIntake;