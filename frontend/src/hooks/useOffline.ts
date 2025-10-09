/**
 * React hooks for offline functionality in E3 Package Manager
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineService, type CachedMailbox } from '../services/offlineService';

export interface OfflineStatus {
  isOnline: boolean;
  queuedOperationsCount: number;
  lastSync: Date | null;
  cachedMailboxesCount: number;
}

/**
 * Hook for monitoring offline status and sync state
 */
export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    queuedOperationsCount: 0,
    lastSync: null,
    cachedMailboxesCount: 0,
  });

  const updateStatus = useCallback(() => {
    const stats = offlineService.getCacheStats();
    setStatus({
      isOnline: stats.isOnline,
      queuedOperationsCount: stats.queuedOperationsCount,
      lastSync: stats.lastSync,
      cachedMailboxesCount: stats.cachedMailboxesCount,
    });
  }, []);

  useEffect(() => {
    // Initial status
    updateStatus();

    // Network listeners
    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();
    
    // Custom event listeners for offline operations
    const handleOperationQueued = () => updateStatus();
    const handleSyncComplete = () => updateStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-operation-queued', handleOperationQueued);
    window.addEventListener('offline-sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-operation-queued', handleOperationQueued);
      window.removeEventListener('offline-sync-complete', handleSyncComplete);
    };
  }, [updateStatus]);

  return status;
}

/**
 * Hook for offline-capable mailbox search
 */
export function useOfflineMailboxSearch() {
  const [cachedResults, setCachedResults] = useState<CachedMailbox[]>([]);
  
  const searchOffline = useCallback((query: string) => {
    if (!query.trim()) {
      setCachedResults([]);
      return;
    }
    
    const results = offlineService.searchCachedMailboxes(query);
    setCachedResults(results);
  }, []);

  const cacheMailboxes = useCallback((mailboxes: CachedMailbox[]) => {
    offlineService.cacheMailboxData(mailboxes);
  }, []);

  return {
    cachedResults,
    searchOffline,
    cacheMailboxes,
  };
}

/**
 * Hook for queuing operations when offline
 */
export function useOfflineOperations() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queuePackageIntake = useCallback((packageData: any, mailboxId: string, tenantId?: string) => {
    return offlineService.queueOperation({
      type: 'package_intake',
      data: packageData,
      mailboxId,
      tenantId,
    });
  }, []);

  const queuePackagePickup = useCallback((pickupData: any, mailboxId: string) => {
    return offlineService.queueOperation({
      type: 'package_pickup',
      data: pickupData,
      mailboxId,
    });
  }, []);

  const queueSignatureCapture = useCallback((signatureData: any, mailboxId: string) => {
    return offlineService.queueOperation({
      type: 'signature_capture',
      data: signatureData,
      mailboxId,
    });
  }, []);

  const syncQueuedOperations = useCallback(async () => {
    if (isOnline) {
      await offlineService.syncQueuedOperations();
    }
  }, [isOnline]);

  return {
    isOnline,
    queuePackageIntake,
    queuePackagePickup,
    queueSignatureCapture,
    syncQueuedOperations,
  };
}

/**
 * Hook for showing offline notifications
 */
export function useOfflineNotifications() {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'queued' | 'synced' | 'error';
    message: string;
    timestamp: Date;
  }>>([]);

  useEffect(() => {
    const handleOperationQueued = (event: CustomEvent) => {
      const { count } = event.detail;
      setNotifications(prev => [...prev, {
        id: `queued-${Date.now()}`,
        type: 'queued',
        message: `Operation queued for sync (${count} pending)`,
        timestamp: new Date(),
      }]);
    };

    const handleSyncComplete = (event: CustomEvent) => {
      const { count } = event.detail;
      setNotifications(prev => [...prev, {
        id: `synced-${Date.now()}`,
        type: 'synced',
        message: `${count} operations synced successfully`,
        timestamp: new Date(),
      }]);
    };

    window.addEventListener('offline-operation-queued', handleOperationQueued as EventListener);
    window.addEventListener('offline-sync-complete', handleSyncComplete as EventListener);

    return () => {
      window.removeEventListener('offline-operation-queued', handleOperationQueued as EventListener);
      window.removeEventListener('offline-sync-complete', handleSyncComplete as EventListener);
    };
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => 
        Date.now() - n.timestamp.getTime() < 5000
      ));
    }, 1000);

    return () => clearTimeout(timer);
  }, [notifications]);

  return {
    notifications,
    dismissNotification,
  };
}