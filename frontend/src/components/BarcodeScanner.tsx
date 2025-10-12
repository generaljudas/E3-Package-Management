/**
 * Barcode Scanner Component for E3 Package Manager
 * Uses QuaggaJS for camera-based barcode scanning
 */

import React, { useRef, useEffect, useState } from 'react';
// @ts-ignore - QuaggaJS doesn't have great TypeScript support
import Quagga from 'quagga';

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
  onError,
  isActive,
  className = '',
}) => {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isActive && !isInitialized && scannerRef.current) {
      initializeScanner();
    } else if (!isActive && isInitialized) {
      stopScanner();
    }

    return () => {
      if (isInitialized) {
        stopScanner();
      }
    };
  }, [isActive, isInitialized]);

  const initializeScanner = () => {
    if (!scannerRef.current) return;

    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerRef.current,
        constraints: {
          width: 640,
          height: 480,
          facingMode: "environment" // Use back camera on mobile
        }
      },
      locator: {
        patchSize: "medium",
        halfSample: true
      },
      numOfWorkers: 2,
      decoder: {
        readers: [
          "code_128_reader",
          "ean_reader", 
          "ean_8_reader",
          "code_39_reader",
          "code_39_vin_reader",
          "codabar_reader",
          "upc_reader",
          "upc_e_reader"
        ]
      },
      locate: true
    }, (err: any) => {
      if (err) {
        console.error('QuaggaJS initialization error:', err);
        const errorMessage = 'Failed to initialize camera. Please check permissions.';
        setError(errorMessage);
        onError?.(errorMessage);
        return;
      }
      
      console.log('QuaggaJS initialized successfully');
      setIsInitialized(true);
      setError(null);
      Quagga.start();
    });

    // Set up detection handler
    Quagga.onDetected((result: any) => {
      const code = result.codeResult.code;
      const format = result.codeResult.format;
      const confidence = result.codeResult.decodedCodes
        .reduce((acc: number, item: any) => acc + item.confidence, 0) / result.codeResult.decodedCodes.length;

      // Only accept high-confidence scans
      if (confidence > 60) {
        onScan({
          code,
          format,
          confidence
        });
      }
    });

    // Handle processing errors
    Quagga.onProcessed((result: any) => {
      if (result && result.boxes) {
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const drawingCanvas = Quagga.canvas.dom.overlay;
        
        if (drawingCtx && drawingCanvas) {
          drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
          
          // Draw bounding boxes
          result.boxes.filter((box: any) => box !== result.box).forEach((box: any) => {
            Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
          });
          
          // Draw the main detection box
          if (result.box) {
            Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "blue", lineWidth: 2 });
          }
          
          // Draw detection line
          if (result.codeResult && result.codeResult.code) {
            Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
          }
        }
      }
    });
  };

  const stopScanner = () => {
    if (isInitialized) {
      Quagga.stop();
      setIsInitialized(false);
    }
  };

  return (
    <div className={`relative ${className}`} data-testid="barcode-scanner-root">
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="barcode-scanner-error">
          <div className="flex">
            <div className="text-red-400" data-testid="barcode-scanner-error-icon">!</div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800" data-testid="barcode-scanner-error-title">
                Camera Error
              </h3>
              <p className="text-sm text-red-600 mt-1" data-testid="barcode-scanner-error-message">
                {error}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  if (isActive) initializeScanner();
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                data-testid="barcode-scanner-retry"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="scanner-container" data-testid="barcode-scanner-container">
          <div 
            ref={scannerRef}
            className="w-full h-64 bg-black rounded-lg overflow-hidden relative"
            data-testid="barcode-scanner-viewport"
          />
          
          {isActive && (
            <div className="scanner-overlay" data-testid="barcode-scanner-overlay">
              <div className="scanner-crosshair" data-testid="barcode-scanner-crosshair"></div>
              <div 
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded"
                data-testid="barcode-scanner-instruction"
              >
                Position barcode in the viewfinder
              </div>
            </div>
          )}
        </div>
      )}

      {!isActive && !error && (
        <div 
          className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg h-64 flex items-center justify-center"
          data-testid="barcode-scanner-inactive"
        >
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2" data-testid="barcode-scanner-inactive-icon">&nbsp;</div>
            <p data-testid="barcode-scanner-inactive-title">Camera scanner ready</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;