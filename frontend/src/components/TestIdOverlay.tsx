import React, { useEffect, useRef, useState } from 'react';

/**
 * Dev-only overlay to visualize data-testid values.
 * - Floating toggle button to enable/disable
 * - On enable: shows tooltip near cursor with nearest ancestor's data-testid
 * - Highlights the matched element with an outline
 */
const STORAGE_KEY = 'e3_show_testids';

function findNearestTestId(el: Element | null): { el: HTMLElement | null; testId: string | null } {
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement) {
    if (cur instanceof HTMLElement) {
      const tid = cur.getAttribute('data-testid');
      if (tid) return { el: cur, testId: tid };
    }
    cur = cur.parentElement;
  }
  return { el: null, testId: null };
}

const TestIdOverlay: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [label, setLabel] = useState<string>('');
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      // Cleanup highlight when disabling
      if (lastElRef.current) {
        lastElRef.current.style.outline = '';
        lastElRef.current.style.outlineOffset = '';
        lastElRef.current = null;
      }
      setLabel('');
      return;
    }

    const onMove = (e: MouseEvent) => {
      setPos({ x: e.pageX + 12, y: e.pageY + 12 });
      const { el, testId } = findNearestTestId(e.target as Element);

      // Remove previous highlight
      if (lastElRef.current && lastElRef.current !== el) {
        lastElRef.current.style.outline = '';
        lastElRef.current.style.outlineOffset = '';
      }

      if (el && testId) {
        el.style.outline = '2px solid #ec4899'; // pink-500
        el.style.outlineOffset = '2px';
        lastElRef.current = el;
        setLabel(testId);
      } else {
        setLabel('');
        lastElRef.current = null;
      }
    };

    const onLeave = () => {
      if (lastElRef.current) {
        lastElRef.current.style.outline = '';
        lastElRef.current.style.outlineOffset = '';
        lastElRef.current = null;
      }
      setLabel('');
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave, { passive: true });
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (lastElRef.current) {
        lastElRef.current.style.outline = '';
        lastElRef.current.style.outlineOffset = '';
        lastElRef.current = null;
      }
    };
  }, [enabled]);

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        title="Toggle show data-testid labels"
        data-testid="dev-toggle-testids"
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          zIndex: 99999,
          padding: '8px 10px',
          borderRadius: 8,
          background: enabled ? '#16a34a' : '#334155',
          color: 'white',
          fontSize: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {enabled ? 'Test IDs: ON' : 'Test IDs: OFF'}
      </button>

      {/* Floating label near cursor */}
      {enabled && label && (
        <div
          style={{
            position: 'absolute',
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -50%)',
            zIndex: 99998,
            background: 'rgba(17,24,39,0.95)', // gray-900
            color: 'white',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 6,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {label}
        </div>
      )}
    </>
  );
};

export default TestIdOverlay;
