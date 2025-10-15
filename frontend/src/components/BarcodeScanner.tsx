/**
 * Barcode Scanner Component for E3 Package Manager
 * Optimized for handheld USB barcode scanners (keyboard emulation)
 * Scanners type directly into the input field and auto-submit on Enter
 */

import React, { useRef, useEffect, useState } from 'react';

export interface BarcodeScanResult {
  code: string;
  format: string;
  confidence: number;
}

interface BarcodeScannerProps {
  onScan: (result: BarcodeScanResult) => void;
  onError?: (error: string) => void;
  isActive: boolean;
  className?: string;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  isActive,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Auto-focus the input when scanner becomes active
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  // Handle barcode input submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedCode = inputValue.trim();
    if (trimmedCode) {
      // Simulate a barcode scan result
      onScan({
        code: trimmedCode,
        format: 'manual-entry',
        confidence: 100
      });
      
      // Clear the input for next scan
      setInputValue('');
      
      // Keep focus for rapid scanning
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className={`relative ${className}`} data-testid="barcode-scanner-root">
      {isActive ? (
        <div className="scanner-container" data-testid="barcode-scanner-container">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">📦</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Barcode Scanner Ready
              </h3>
              <p className="text-sm text-gray-600">
                Scan with your handheld scanner or type tracking number
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="barcode-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking Number
                </label>
                <input
                  ref={inputRef}
                  id="barcode-input"
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="Scan or type tracking number..."
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  data-testid="barcode-scanner-input"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                data-testid="barcode-scanner-submit"
              >
                Submit Tracking Number
              </button>
            </form>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>💡 Tip:</strong> Handheld USB scanners will automatically type into this field and press Enter.
                No camera permission needed!
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div 
          className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg h-64 flex items-center justify-center"
          data-testid="barcode-scanner-inactive"
        >
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2" data-testid="barcode-scanner-inactive-icon">📦</div>
            <p data-testid="barcode-scanner-inactive-title">Scanner ready for handheld devices</p>
            <p className="text-sm mt-1">No camera required</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;