/**
 * Digital Signature Capture Component for E3 Package Manager
 * Uses HTML5 Canvas for smooth signature drawing with touch/mouse support
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

export interface SignatureData {
  dataURL: string;
  isEmpty: boolean;
  timestamp: Date;
  /** How the signature was captured. The stored record must reflect this
   *  honestly — see docs/SIGNATURE_POLICY.md §5. */
  method: 'drawn' | 'typed';
  /** For typed signatures, the raw typed name — the text IS the signature;
   *  the rendered image is only a view of it. */
  typedName?: string;
}

interface SignaturePadProps {
  onSignatureChange?: (signature: SignatureData | null) => void;
  width?: number;
  height?: number;
  strokeWidth?: number;
  strokeColor?: string;
  backgroundColor?: string;
  className?: string;
  disabled?: boolean;
  clearOnStart?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureChange,
  width = 400,
  height = 200,
  strokeWidth = 2,
  strokeColor = '#000000',
  backgroundColor = '#ffffff',
  className = '',
  disabled = false,
  clearOnStart = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');

  // Initialize/clear canvas background when size or background changes (and on mount).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with background color (changing width/height will reset the bitmap as well)
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (clearOnStart) {
      setIsEmpty(true);
      onSignatureChange?.(null);
    }
  }, [width, height, backgroundColor, clearOnStart, onSignatureChange]);

  // Update stroke style without clearing existing drawing when pen style changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
  }, [strokeColor, strokeWidth]);

  const getSignatureData = useCallback((): SignatureData | null => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return null;

    return {
      dataURL: canvas.toDataURL('image/png'),
      isEmpty: false,
      timestamp: new Date(),
      method: 'drawn',
    };
  }, [isEmpty]);

  // Typed-name signature: render the name onto the canvas as an honest
  // "view" of the signature (plain font + a "Typed signature" annotation —
  // never disguised as handwriting), and report the raw text alongside it.
  const applyTypedName = useCallback((name: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const trimmed = name.trim();
    if (!trimmed) {
      setIsEmpty(true);
      onSignatureChange?.(null);
      return;
    }

    ctx.fillStyle = strokeColor;
    ctx.font = '600 28px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(trimmed, width / 2, height / 2 - 8, width - 32);
    ctx.font = '400 12px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Typed signature', width / 2, height / 2 + 24);

    setIsEmpty(false);
    onSignatureChange?.({
      dataURL: canvas.toDataURL('image/png'),
      isEmpty: false,
      timestamp: new Date(),
      method: 'typed',
      typedName: trimmed,
    });
  }, [backgroundColor, width, height, strokeColor, onSignatureChange]);

  const switchMode = (nextMode: 'draw' | 'type') => {
    if (mode === nextMode || disabled) return;
    setMode(nextMode);
    setTypedName('');
    // Switching input methods discards any pending signature — the signer
    // starts over deliberately in the new mode.
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
    setIsEmpty(true);
    setIsDrawing(false);
    setLastPosition(null);
    onSignatureChange?.(null);
  };

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    setIsEmpty(true);
    setIsDrawing(false);
    setLastPosition(null);
    setTypedName('');
    onSignatureChange?.(null);
  }, [width, height, backgroundColor, onSignatureChange]);

  const getEventPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      // Mouse event
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled || mode !== 'draw') return;

    e.preventDefault();
    const position = getEventPosition(e);
    setIsDrawing(true);
    setLastPosition(position);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || !lastPosition) return;

    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const currentPosition = getEventPosition(e);

    ctx.beginPath();
    ctx.moveTo(lastPosition.x, lastPosition.y);
    ctx.lineTo(currentPosition.x, currentPosition.y);
    ctx.stroke();

    setLastPosition(currentPosition);
    // Mark canvas as non-empty on first stroke segment
    if (isEmpty) {
      setIsEmpty(false);
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;

    e.preventDefault();
    setIsDrawing(false);
    setLastPosition(null);
    // Don't auto-complete when the pointer is released; allow multiple strokes.
    // Instead, notify parent that the signature content changed so they can enable a manual confirm.
    if (!isEmpty) {
      const signatureData = getSignatureData();
      if (signatureData) {
        onSignatureChange?.(signatureData);
      }
    }
  };

  return (
    <div className={`signature-pad-container ${className}`} data-testid="signature-pad-root">
      {/* Draw / Type mode toggle — typed names are legally equivalent
          signatures here; see docs/SIGNATURE_POLICY.md */}
      <div className="flex gap-2 mb-3" data-testid="signature-mode-toggle">
        {(['draw', 'type'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            disabled={disabled}
            aria-pressed={mode === m}
            data-testid={`signature-mode-${m}`}
            style={{
              padding: '0.375rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: mode === m ? '2px solid #2563eb' : '2px solid #e5e7eb',
              background: mode === m ? '#eff6ff' : 'white',
              color: mode === m ? '#1e40af' : '#6b7280',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {m === 'draw' ? 'Draw signature' : 'Type name to sign'}
          </button>
        ))}
      </div>

      {mode === 'type' && (
        <div className="mb-3" data-testid="signature-typed-section">
          <label
            htmlFor="typed-signature-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Type your full name to sign
          </label>
          <input
            id="typed-signature-name"
            type="text"
            value={typedName}
            onChange={(e) => {
              setTypedName(e.target.value);
              applyTypedName(e.target.value);
            }}
            onKeyDown={(e) => {
              // Enter must never auto-sign; adoption happens via the
              // explicit confirm button in the pickup flow.
              if (e.key === 'Enter') e.preventDefault();
            }}
            disabled={disabled}
            autoComplete="name"
            className="input-field"
            style={{ width: `${width}px`, maxWidth: '100%' }}
            data-testid="typed-signature-input"
          />
          <p className="text-sm text-gray-600 mt-1" data-testid="typed-signature-acknowledgment">
            By typing my name and confirming, I acknowledge receipt of the
            package(s) listed above.
          </p>
        </div>
      )}

      <div
        className="relative bg-white border-2 border-gray-300 rounded-lg overflow-hidden"
        data-testid="signature-pad-container"
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={`block cursor-crosshair ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            touchAction: 'none' // Prevent scrolling while drawing
          }}
          role="img"
          aria-label={
            isEmpty
              ? mode === 'draw'
                ? 'Signature area, empty — sign with mouse, touch, or stylus, or switch to typing your name'
                : 'Signature preview, empty — type your name above to sign'
              : mode === 'draw'
                ? 'Signature area — signature captured'
                : `Signature preview — typed signature: ${typedName.trim()}`
          }
          data-testid="signature-pad-canvas"
        />
        
        {isEmpty && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" data-testid="signature-pad-placeholder">
            <div className="text-gray-500 text-center">
                <div className="text-2xl mb-2" aria-hidden="true" data-testid="signature-pad-placeholder-icon">✍️</div>
              <p className="text-sm" data-testid="signature-pad-placeholder-text">
                {mode === 'draw' ? 'Sign here' : 'Signature preview appears here'}
              </p>
            </div>
          </div>
        )}

        {disabled && (
          <div className="absolute inset-0 bg-gray-100 bg-opacity-50 flex items-center justify-center" data-testid="signature-pad-disabled">
            <div className="text-gray-500 text-sm" data-testid="signature-pad-disabled-text">
              Signature disabled
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3" data-testid="signature-pad-controls">
        <div className="text-xs text-gray-500" role="status" data-testid="signature-pad-status">
          {isEmpty ? 'No signature' : 'Signature captured'}
        </div>
        
        <button
          type="button"
          onClick={clearSignature}
          disabled={isEmpty || disabled}
          className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-500 disabled:cursor-not-allowed"
          data-testid="signature-pad-clear"
        >
          Clear Signature
        </button>
      </div>
    </div>
  );
};

/**
 * Signature verification component for confirming signature before submission
 */
interface SignatureVerificationProps {
  signature: SignatureData;
  recipientName: string;
  onConfirm: () => void;
  onRetry: () => void;
  className?: string;
}

export const SignatureVerification: React.FC<SignatureVerificationProps> = ({
  signature,
  recipientName,
  onConfirm,
  onRetry,
  className = '',
}) => {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`} data-testid="signature-verification-root">
      <h4 className="text-lg font-medium text-blue-900 mb-3" data-testid="signature-verification-title">
        Verify Signature
      </h4>
      
      <div className="space-y-4" data-testid="signature-verification-content">
        <div data-testid="signature-verification-details">
          <p className="text-sm text-blue-700 mb-2" data-testid="signature-verification-recipient">
            <strong>Recipient:</strong> {recipientName}
          </p>
          <p className="text-sm text-blue-700 mb-2" data-testid="signature-verification-timestamp">
            <strong>Signed at:</strong> {signature.timestamp.toLocaleString()}
          </p>
          <p className="text-sm text-blue-700 mb-2" data-testid="signature-verification-method">
            <strong>Method:</strong>{' '}
            {signature.method === 'typed'
              ? `Typed name ("${signature.typedName}")`
              : 'Drawn signature'}
          </p>
        </div>

        <div className="bg-white p-3 rounded border" data-testid="signature-verification-preview">
          <p className="text-sm font-medium text-gray-700 mb-2" data-testid="signature-verification-preview-label">Captured Signature:</p>
          <img 
            src={signature.dataURL} 
            alt="Captured signature"
            className="border border-gray-200 rounded max-w-full h-auto"
            style={{ maxHeight: '120px' }}
            data-testid="signature-verification-image"
          />
        </div>

        <div className="flex space-x-3" data-testid="signature-verification-actions">
          <button
            onClick={onConfirm}
            className="flex-1 btn btn-primary"
            data-testid="signature-verification-confirm"
          >
            Confirm Pickup
          </button>
          <button
            onClick={onRetry}
            className="btn bg-gray-200 text-gray-700 hover:bg-gray-300"
            data-testid="signature-verification-retry"
          >
            Sign Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;