/**
 * Offline Sync Service for E3 Package Manager
 * Handles caching tenant data and queueing operations when offline
 */

import type {
  OfflineQueueItem,
  OfflineOperation,
  OfflinePackageIntakePayload,
  PickupRequest,
  SignatureCapturePayload,
} from '../types';

function assertNever(value: never): never {
  throw new Error(`Unknown operation type encountered during offline sync: ${String(value)}`);
}

export interface CachedTenant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cached_at: number;
}

export interface CachedMailbox {
  id: string;
  mailbox_number: string;
  default_tenant_id?: string;
  tenants: CachedTenant[];
  cached_at: number;
}

class OfflineService {
  private readonly CACHE_KEYS = {
    MAILBOXES: 'e3_cached_mailboxes',
    OPERATIONS_QUEUE: 'e3_operations_queue',
    LAST_SYNC: 'e3_last_sync',
  };

  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private operationQueue: OfflineQueueItem[] = [];
  private isOnline = navigator.onLine;

  constructor() {
    this.initializeService();
    this.setupNetworkListeners();
    this.loadOperationQueue();
  }

  private initializeService() {
    // Initialize storage if needed
    if (!localStorage.getItem(this.CACHE_KEYS.MAILBOXES)) {
      localStorage.setItem(this.CACHE_KEYS.MAILBOXES, JSON.stringify({}));
    }
    if (!localStorage.getItem(this.CACHE_KEYS.OPERATIONS_QUEUE)) {
      localStorage.setItem(this.CACHE_KEYS.OPERATIONS_QUEUE, JSON.stringify([]));
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncQueuedOperations();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private loadOperationQueue() {
    try {
      const queueData = localStorage.getItem(this.CACHE_KEYS.OPERATIONS_QUEUE);
      if (queueData) {
        this.operationQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Error loading operation queue:', error);
      this.operationQueue = [];
    }
  }

  private saveOperationQueue() {
    try {
      localStorage.setItem(
        this.CACHE_KEYS.OPERATIONS_QUEUE, 
        JSON.stringify(this.operationQueue)
      );
    } catch (error) {
      console.error('Error saving operation queue:', error);
    }
  }

  /**
   * Cache mailbox and tenant data for offline access
   */
  cacheMailboxData(mailboxes: CachedMailbox[]) {
    try {
      const cached: { [key: string]: CachedMailbox } = {};
      const now = Date.now();

      mailboxes.forEach(mailbox => {
        cached[mailbox.mailbox_number] = {
          ...mailbox,
          cached_at: now,
        };
      });

      localStorage.setItem(this.CACHE_KEYS.MAILBOXES, JSON.stringify(cached));
      localStorage.setItem(this.CACHE_KEYS.LAST_SYNC, now.toString());
    } catch (error) {
      console.error('Error caching mailbox data:', error);
    }
  }

  /**
   * Get cached mailbox data
   */
  getCachedMailboxes(): CachedMailbox[] {
    try {
      const cachedData = localStorage.getItem(this.CACHE_KEYS.MAILBOXES);
      if (!cachedData) return [];

      const cached: { [key: string]: CachedMailbox } = JSON.parse(cachedData);
      const now = Date.now();

      return Object.values(cached).filter(mailbox => {
        return (now - mailbox.cached_at) < this.CACHE_DURATION;
      });
    } catch (error) {
      console.error('Error retrieving cached mailboxes:', error);
      return [];
    }
  }

  /**
   * Search cached mailboxes by number
   */
  searchCachedMailboxes(query: string): CachedMailbox[] {
    const cached = this.getCachedMailboxes();
    const lowerQuery = query.toLowerCase();

    return cached.filter(mailbox =>
      mailbox.mailbox_number.toLowerCase().includes(lowerQuery) ||
      mailbox.tenants.some(tenant => 
        tenant.name.toLowerCase().includes(lowerQuery) ||
        tenant.email.toLowerCase().includes(lowerQuery)
      )
    ).slice(0, 10); // Limit results
  }

  /**
   * Queue an operation for later sync when online
   */
  queueOperation(operation: OfflineOperation) {
    const queuedOp: OfflineQueueItem = {
      ...operation,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.operationQueue.push(queuedOp);
    this.saveOperationQueue();

    // Show user notification about queued operation
    this.notifyOperationQueued(queuedOp);

    return queuedOp.id;
  }

  /**
   * Get queued operations count
   */
  getQueuedOperationsCount(): number {
    return this.operationQueue.length;
  }

  /**
   * Get all queued operations
   */
  getQueuedOperations(): OfflineQueueItem[] {
    return [...this.operationQueue];
  }

  /**
   * Sync queued operations when online
   */
  async syncQueuedOperations() {
    if (!this.isOnline || this.operationQueue.length === 0) return;

    const operations = [...this.operationQueue];
    const synced: string[] = [];

    for (const operation of operations) {
      try {
        await this.syncOperation(operation);
        synced.push(operation.id);
      } catch (error) {
        console.error('Error syncing operation:', operation.id, error);
        // Keep failed operations in queue
        break;
      }
    }

    // Remove successfully synced operations
    this.operationQueue = this.operationQueue.filter(op => !synced.includes(op.id));
    this.saveOperationQueue();

    if (synced.length > 0) {
      this.notifySyncComplete(synced.length);
    }
  }

  private async syncOperation(operation: OfflineQueueItem) {
    const baseUrl = 'http://localhost:3001/api';

    switch (operation.type) {
      case 'package_intake':
        await fetch(`${baseUrl}/packages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.data as OfflinePackageIntakePayload),
        });
        return;

      case 'package_pickup':
        await fetch(`${baseUrl}/pickups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.data as PickupRequest),
        });
        return;

      case 'signature_capture':
        await fetch(`${baseUrl}/signatures`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.data as SignatureCapturePayload),
        });
        return;
    }

    assertNever(operation);
  }

  private notifyOperationQueued(operation: OfflineQueueItem) {
    // Show toast notification
    const event = new CustomEvent('offline-operation-queued', {
      detail: { operation, count: this.operationQueue.length }
    });
    window.dispatchEvent(event);
  }

  private notifySyncComplete(count: number) {
    const event = new CustomEvent('offline-sync-complete', {
      detail: { count }
    });
    window.dispatchEvent(event);
  }

  /**
   * Check if service is online
   */
  isServiceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Clear all cached data (for testing/reset)
   */
  clearCache() {
    localStorage.removeItem(this.CACHE_KEYS.MAILBOXES);
    localStorage.removeItem(this.CACHE_KEYS.OPERATIONS_QUEUE);
    localStorage.removeItem(this.CACHE_KEYS.LAST_SYNC);
    this.operationQueue = [];
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const lastSync = localStorage.getItem(this.CACHE_KEYS.LAST_SYNC);
    const cachedMailboxes = this.getCachedMailboxes();
    
    return {
      lastSync: lastSync ? new Date(parseInt(lastSync)) : null,
      cachedMailboxesCount: cachedMailboxes.length,
      queuedOperationsCount: this.operationQueue.length,
      isOnline: this.isOnline,
    };
  }
}

// Export singleton instance
export const offlineService = new OfflineService();