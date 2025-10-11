/**
 * Offline Status Component - Shows connection status and sync information
 */

import React from 'react';
import { useOfflineStatus, useOfflineNotifications } from '../hooks/useOffline';

export const OfflineStatusBar: React.FC = () => {
  const status = useOfflineStatus();
  const { notifications, dismissNotification } = useOfflineNotifications();

  if (status.isOnline && status.queuedOperationsCount === 0) {
    return null; // Don't show anything when online with no queued operations
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50" data-testid="offline-status-root">
      {/* Main status bar */}
      {!status.isOnline && (
        <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-medium" data-testid="offline-status-banner">
          <span className="inline-flex items-center">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            Working Offline
            {status.queuedOperationsCount > 0 && (
              <span className="ml-2 bg-red-700 px-2 py-1 rounded text-xs" data-testid="offline-queued-count">
                {status.queuedOperationsCount} operations pending sync
              </span>
            )}
          </span>
        </div>
      )}

      {/* Sync pending indicator when online */}
      {status.isOnline && status.queuedOperationsCount > 0 && (
        <div className="bg-yellow-600 text-white px-4 py-2 text-center text-sm font-medium" data-testid="offline-syncing-banner">
          <span className="inline-flex items-center">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-spin"></div>
            Syncing {status.queuedOperationsCount} operations...
          </span>
        </div>
      )}

      {/* Notifications */}
      <div className="fixed top-16 right-4 space-y-2 z-50" data-testid="offline-notifications">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium
              cursor-pointer transition-all duration-300 animate-slide-up
              ${notification.type === 'queued' ? 'bg-yellow-600' : ''}
              ${notification.type === 'synced' ? 'bg-green-600' : ''}
              ${notification.type === 'error' ? 'bg-red-600' : ''}
            `}
            onClick={() => dismissNotification(notification.id)}
            data-testid={`offline-notification-${notification.id}`}
          >
            <div className="flex items-center justify-between">
              <span>{notification.message}</span>
              <button
                className="ml-3 text-white hover:text-gray-200"
                onClick={() => dismissNotification(notification.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const OfflineDebugPanel: React.FC = () => {
  const status = useOfflineStatus();

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white border border-gray-300 rounded-lg p-3 text-xs text-gray-600 shadow-lg max-w-sm">
      <h4 className="font-semibold text-gray-800 mb-2">Offline Status (Dev)</h4>
      <div className="space-y-1">
        <div>
          Status: <span className={status.isOnline ? 'text-green-600' : 'text-red-600'}>
            {status.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div>Queued Operations: {status.queuedOperationsCount}</div>
        <div>Cached Mailboxes: {status.cachedMailboxesCount}</div>
        <div>
          Last Sync: {status.lastSync 
            ? status.lastSync.toLocaleString() 
            : 'Never'
          }
        </div>
      </div>
    </div>
  );
};