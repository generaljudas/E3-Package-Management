import { useState, useCallback, useEffect, useRef } from 'react';
import type { Mailbox } from '../types';
import { mailboxApi } from '../services/api';

interface MailboxCacheSnapshot {
  mailboxes: Mailbox[];
  lastFetched: number;
}

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
let mailboxCache: MailboxCacheSnapshot | null = null;
let mailboxCachePromise: Promise<Mailbox[]> | null = null;

export function invalidateMailboxCache() {
  console.debug('Invalidating mailbox cache');
  mailboxCache = null;
  mailboxCachePromise = null;
}

export function useMailboxCache() {
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadMailboxes = useCallback(async (): Promise<Mailbox[]> => {
    if (
      mailboxCache &&
      Date.now() - mailboxCache.lastFetched < CACHE_DURATION_MS
    ) {
      return mailboxCache.mailboxes;
    }

    if (mailboxCachePromise) {
      return mailboxCachePromise;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
    }

    mailboxCachePromise = (async () => {
      try {
        const response = await mailboxApi.getAll();
        const mailboxes = response.mailboxes ?? [];
        mailboxCache = {
          mailboxes,
          lastFetched: Date.now(),
        };
        return mailboxes;
      } finally {
        mailboxCachePromise = null;
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    try {
      return await mailboxCachePromise;
    } catch (error) {
      mailboxCache = null;
      throw error;
    }
  }, []);

  const searchMailboxes = useCallback(async (query: string): Promise<Mailbox[]> => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const mailboxes = await loadMailboxes();
    const searchTerm = trimmedQuery.toLowerCase();
    const startTime = performance.now();

    const results = mailboxes
      .filter((mailbox) => {
        const mailboxNumber = mailbox.mailbox_number.toLowerCase();
        const defaultTenant = mailbox.default_tenant_name?.toLowerCase() ?? '';
        return (
          mailboxNumber.includes(searchTerm) ||
          defaultTenant.includes(searchTerm)
        );
      })
      .sort((a, b) => {
        const mailboxA = a.mailbox_number.toLowerCase();
        const mailboxB = b.mailbox_number.toLowerCase();

        if (mailboxA === searchTerm) return -1;
        if (mailboxB === searchTerm) return 1;

        const aStarts = mailboxA.startsWith(searchTerm);
        const bStarts = mailboxB.startsWith(searchTerm);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        const aNumber = Number.parseInt(a.mailbox_number, 10);
        const bNumber = Number.parseInt(b.mailbox_number, 10);
        if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
          return aNumber - bNumber;
        }

        return mailboxA.localeCompare(mailboxB);
      })
      .slice(0, 10);

    const duration = performance.now() - startTime;
    if (duration > 10) {
      console.warn(`Slow mailbox search (${Math.round(duration)}ms) for query: "${trimmedQuery}"`);
    }

    return results;
  }, [loadMailboxes]);

  const findMailboxByNumber = useCallback(async (mailboxNumber: string): Promise<Mailbox | undefined> => {
    const mailboxes = await loadMailboxes();
    return mailboxes.find((mailbox) => mailbox.mailbox_number === mailboxNumber);
  }, [loadMailboxes]);

  return {
    loadMailboxes,
    searchMailboxes,
    findMailboxByNumber,
    isLoading,
  };
}
