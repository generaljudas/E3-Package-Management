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
    <div className="space-y-6" data-testid="intake-root">
      {/* Barcode Scanner Section */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid #e2e8f0',
          boxShadow: 'var(--shadow-md)',
        }}
        data-testid="intake-scanner-section"
      >
        {/* Section Header */}
        <div 
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
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
            <span style={{ fontSize: '1.5rem' }}>📦</span>
            <h4 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              color: 'white',
              margin: 0
            }}>
              Scan Package Barcode
            </h4>
          </div>
          <button
            onClick={() => setIsScannerActive(!isScannerActive)}
            className="btn"
            style={{
              background: isScannerActive 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
            data-testid="intake-scanner-toggle"
          >
            {isScannerActive ? '⏹ Stop Scanner' : '▶ Start Scanner'}
          </button>
        </div>

        {/* Scanner Content */}
        <div style={{ padding: '1.5rem' }}>
          <BarcodeScanner
            isActive={isScannerActive}
            onScan={handleBarcodeScan}
            onError={(error) => onError?.(error)}
            className="mb-4"
          />
          
          {/* Tracking Number Input */}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            <input
              ref={trackingNumberRef}
              id="tracking_number"
              type="text"
              value={formData.tracking_number}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan or type tracking number"
              className="input-field"
              style={{ flex: '1' }}
              autoComplete="off"
              tabIndex={1}
              data-testid="intake-tracking-input"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addToBatch}
              disabled={!formData.tracking_number.trim() || batch.includes(formData.tracking_number.trim())}
              data-testid="intake-add-to-batch"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              ➕ Add
            </button>
          </div>
          
          <div style={{ 
            marginTop: '0.75rem', 
            fontSize: '0.875rem', 
            color: 'var(--color-gray-600)',
            fontStyle: 'italic'
          }}>
            💡 Scan or enter each package, then click Add or scan next
          </div>

          {/* Batch List */}
          {batch.length > 0 && (
            <div 
              style={{ marginTop: '1.5rem' }} 
              data-testid="intake-batch-list"
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>📋</span>
                <h5 style={{ 
                  fontWeight: '600', 
                  color: 'var(--color-gray-900)',
                  fontSize: '1rem',
                  margin: 0
                }}>
                  Batch to Register ({batch.length})
                </h5>
              </div>
              <ul 
                style={{
                  background: 'white',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid #cbd5e1',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {batch.map((trackingNumber, index) => (
                  <li 
                    key={trackingNumber} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.875rem 1.25rem',
                      borderBottom: index < batch.length - 1 ? '1px solid #e2e8f0' : 'none',
                      background: index % 2 === 0 ? 'white' : '#f8fafc',
                      transition: 'background 0.2s ease',
                    }}
                    data-testid={`intake-batch-item-${trackingNumber}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ 
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}>
                        {index + 1}
                      </span>
                      <span style={{ 
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: 'var(--color-gray-900)'
                      }}>
                        {trackingNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      style={{
                        color: '#ef4444',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        border: 'none',
                        background: 'transparent',
                      }}
                      onClick={() => removeFromBatch(trackingNumber)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fee2e2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      🗑 Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: '0.75rem',
        paddingTop: '0.5rem'
      }}>
        <button
          onClick={() => {
            setFormData({ tracking_number: '' });
            setBatch([]);
          }}
          className="btn btn-secondary"
          disabled={isSubmitting}
          data-testid="intake-clear-form"
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: '600',
          }}
        >
          🗑 Clear Form
        </button>
        <button
          ref={submitButtonRef}
          onClick={handleSubmit}
          disabled={isSubmitting || (batch.length === 0 && !formData.tracking_number.trim())}
          className="btn btn-primary"
          tabIndex={4}
          data-testid="intake-submit"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 2rem',
            fontSize: '0.875rem',
            fontWeight: '600',
          }}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {isOnline ? 'Registering...' : 'Queueing...'}
            </>
          ) : (
            <>
              ✓ {batch.length > 0 ? `Register Batch (${batch.length})` : 'Register Package'}
              {!isOnline && <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(Offline)</span>}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PackageIntake;