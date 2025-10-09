import React, { useEffect, useState } from 'react';

type Shortcut = {
  keys: string | string[];
  action: string;
};

interface KeyboardShortcutsProps {
  enabled?: boolean; // when false, hides the trigger button
  label?: string; // custom label for the trigger button
}

// Simple helper to render keycaps consistently
function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-2 py-1 bg-gray-100 border border-gray-300 rounded-md font-mono text-xs text-gray-800 shadow-inner">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcuts({ enabled = true, label = 'Keyboard shortcuts' }: KeyboardShortcutsProps) {
  const [open, setOpen] = useState(false);

  // Keyboard listener for toggling help with '?' or F1, close with Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const targetIsInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement)?.isContentEditable;

      // Toggle with '?' (Shift + '/') or F1 when not typing in a field
      if (!targetIsInput && (e.key === '?' || e.key === 'F1')) {
        e.preventDefault();
        setOpen(prev => !prev);
        return;
      }
      // Close with Escape
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const generalShortcuts: Shortcut[] = [
    { keys: '?', action: 'Open shortcuts help' },
    { keys: ['Alt', 'M'], action: 'Focus mailbox search' },
    { keys: ['Alt', 'P'], action: 'Focus package intake' },
    { keys: ['Alt', 'S'], action: 'Toggle barcode scanner' },
  ];

  const intakeShortcuts: Shortcut[] = [
    { keys: 'Tab', action: 'Jump to package intake (when mailbox selected)' },
    { keys: 'Enter', action: 'Next field / confirm' },
    { keys: ['Ctrl', 'Enter'], action: 'Submit package' },
  ];

  const Section = ({ title, items }: { title: string; items: Shortcut[] }) => (
    <div>
      <h4 className="text-sm font-semibold text-gray-800 mb-2">{title}</h4>
      <ul className="space-y-2">
        {items.map((s, idx) => (
          <li key={idx} className="flex items-center justify-between gap-4">
            <div className="text-gray-700 text-sm">{s.action}</div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {Array.isArray(s.keys) ? (
                s.keys.map((k, i) => (
                  <React.Fragment key={`${k}-${i}`}>
                    <Keycap>{k}</Keycap>
                    {i < s.keys.length - 1 && <span className="text-gray-400 text-xs px-1">+</span>}
                  </React.Fragment>
                ))
              ) : (
                <Keycap>{s.keys}</Keycap>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="mt-8">
      {enabled && (
        <div className="relative flex justify-end">
          <button
            type="button"
            aria-label="Open keyboard shortcuts"
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border border-blue-700/50 px-3 py-2"
            onClick={() => setOpen(v => !v)}
          >
            <span className="text-base">⌨️</span>
            <span className="text-sm font-medium">{label}</span>
          </button>

          {open && (
            <div
              className="absolute right-0 bottom-full mb-2 z-50 w-[min(90vw,680px)] bg-white rounded-xl shadow-2xl ring-1 ring-black/5"
              role="region"
              aria-label="Keyboard Shortcuts"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <h3 className="text-base md:text-lg font-semibold text-gray-900">Keyboard Shortcuts</h3>
                <button
                  className="text-gray-500 hover:text-gray-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Section title="General" items={generalShortcuts} />
                  <Section title="Intake" items={intakeShortcuts} />
                </div>
                <div className="mt-6 text-xs text-gray-500">
                  Tip: Press <Keycap>?</Keycap> to toggle this panel. Press <Keycap>Esc</Keycap> to close.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
