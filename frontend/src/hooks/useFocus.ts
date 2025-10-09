/**
 * Custom hook for managing keyboard focus flow in E3 Package Manager
 */

import { useEffect, useRef } from 'react';

interface UseFocusFlowOptions {
  trigger?: boolean;
  delay?: number;
}

/**
 * Hook to manage focus flow between different sections of the app
 */
export function useFocusFlow(options: UseFocusFlowOptions = {}) {
  const { trigger = false, delay = 100 } = options;
  const targetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (trigger && targetRef.current) {
      const timer = setTimeout(() => {
        targetRef.current?.focus();
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [trigger, delay]);

  return targetRef;
}

/**
 * Hook to handle global keyboard shortcuts for the package manager
 */
export function useGlobalKeyboardShortcuts(handlers: {
  onFocusPackageIntake?: () => void;
  onFocusMailboxLookup?: () => void;
  onToggleScanner?: () => void;
  onSubmitPackage?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement || 
          e.target instanceof HTMLSelectElement) {
        return;
      }

      // Alt + P - Focus Package Intake
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        handlers.onFocusPackageIntake?.();
      }

      // Alt + M - Focus Mailbox Lookup
      if (e.altKey && e.key === 'm') {
        e.preventDefault();
        handlers.onFocusMailboxLookup?.();
      }

      // Alt + S - Toggle Scanner
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        handlers.onToggleScanner?.();
      }

      // Ctrl + Enter - Submit Package (global)
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handlers.onSubmitPackage?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

/**
 * Hook to create focus traps for modals/dropdowns
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);
  const firstFocusableRef = useRef<HTMLElement>(null);
  const lastFocusableRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstFocusableRef.current = firstElement;
    lastFocusableRef.current = lastElement;

    // Focus first element when trap becomes active
    firstElement.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
}