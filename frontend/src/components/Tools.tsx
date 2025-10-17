import React, { useState, useRef } from 'react';
import Reports from './Reports';
import MailboxTenantManagement from './MailboxTenantManagement';
import SignatureRetrieval from './SignatureRetrieval';
import { invalidateMailboxCache } from './MailboxLookup';
import type { Mailbox, Tenant } from '../types';

type ToolId = 'signature-retrieval' | 'mailbox-management' | 'reports';

interface ToolsProps {
  selectedMailbox?: Mailbox | null;
  selectedTenant?: Tenant | null;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

interface ToolCategory {
  name: string;
  tools: Array<{ id: ToolId; label: string; available: boolean }>;
}

const toolCategories: ToolCategory[] = [
  {
    name: 'Signature Retrieval',
    tools: [
      { id: 'signature-retrieval', label: 'View Package Signatures', available: true },
    ],
  },
  {
    name: 'Mailbox Tenant Management',
    tools: [
      { id: 'mailbox-management', label: 'Manage Mailboxes & Tenants', available: true },
    ],
  },
  {
    name: 'Other',
    tools: [
      { id: 'reports', label: 'Reports', available: true },
    ],
  },
];

const Tools: React.FC<ToolsProps> = ({ selectedMailbox, selectedTenant, onError, onSuccess }) => {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [isReloadingCache, setIsReloadingCache] = useState(false);
  const mailboxManagementBackHandler = useRef<(() => boolean) | null>(null);

  // Get icon and description for each tool
  const toolInfo: Record<ToolId, { icon: string; description: string }> = {
    'signature-retrieval': {
      icon: '✍️',
      description: 'View and retrieve signatures for picked up packages'
    },
    'mailbox-management': {
      icon: '📬',
      description: 'Add, edit, or remove mailboxes and their tenants'
    },
    'reports': {
      icon: '📊',
      description: 'Generate statistics, pickup history, and audit logs'
    }
  };

  const handleBack = () => {
    // If we're in mailbox management and it has a back handler, call it
    if (activeTool === 'mailbox-management' && mailboxManagementBackHandler.current) {
      const handled = mailboxManagementBackHandler.current();
      if (handled) {
        return; // Child component handled the back navigation
      }
    }
    
    // Otherwise, go back to tools list
    setActiveTool(null);
  };

  const registerBackHandler = (handler: () => boolean) => {
    mailboxManagementBackHandler.current = handler;
  };

  const handleReloadCache = async () => {
    setIsReloadingCache(true);
    try {
      invalidateMailboxCache();
      onSuccess?.('Mailbox cache cleared and will reload on next search');
    } catch (error) {
      onError?.('Failed to reload cache');
    } finally {
      setIsReloadingCache(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="tools-root">
      {activeTool && (
        <button
          onClick={handleBack}
          data-testid="tools-back-button"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.25)';
          }}
        >
          <span style={{ fontSize: '1rem' }}>←</span>
          <span>Back</span>
        </button>
      )}

      {/* Cache Reload Button - Only show when no tool is active */}
      {!activeTool && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            onClick={handleReloadCache}
            disabled={isReloadingCache}
            data-testid="tools-reload-cache-button"
            style={{
              background: isReloadingCache 
                ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '0.75rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: isReloadingCache ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isReloadingCache ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isReloadingCache) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.25)';
            }}
          >
            <span style={{ fontSize: '1.125rem' }}>🔄</span>
            <span>{isReloadingCache ? 'Reloading...' : 'Reload Mailbox Cache'}</span>
          </button>
        </div>
      )}

      {/* Show all tools in a single grid when no tool is active */}
      {!activeTool && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="tools-categories">
          {toolCategories.flatMap((category) => 
            category.tools.map((tool) => {
              const info = toolInfo[tool.id];
              
              if (!tool.available) {
                return (
                  <div
                    key={tool.id}
                    className="relative bg-gray-50 border-2 border-gray-200 rounded-lg p-6 cursor-not-allowed opacity-60"
                    title={`${tool.label} — coming soon`}
                    data-testid={`tools-tab-${tool.id}`}
                  >
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="text-5xl" style={{ filter: 'grayscale(100%)' }}>{info.icon}</div>
                      <h5 className="text-lg font-semibold text-gray-500">{tool.label}</h5>
                      <p className="text-sm text-gray-400 leading-relaxed">{info.description}</p>
                      <span className="absolute top-2 right-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full font-medium">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                );
              }
              
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className="bg-white border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg rounded-lg p-6 transition-all duration-200 hover:scale-105"
                  data-testid={`tools-tab-${tool.id}`}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="text-5xl">{info.icon}</div>
                    <h5 className="text-lg font-semibold text-gray-900">{tool.label}</h5>
                    <p className="text-sm text-gray-600 leading-relaxed">{info.description}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Show active tool content */}
      {activeTool && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white" data-testid="tools-content">
          {activeTool === 'reports' && (
            <Reports
              selectedMailbox={selectedMailbox}
              selectedTenant={selectedTenant || null}
              onError={(e) => onError?.(e)}
            />
          )}

          {activeTool === 'signature-retrieval' && (
            <SignatureRetrieval
              onError={(e) => onError?.(e)}
              onSuccess={(message) => onSuccess?.(message)}
            />
          )}

          {activeTool === 'mailbox-management' && (
            <MailboxTenantManagement
              onError={(e) => onError?.(e)}
              onSuccess={(message) => onSuccess?.(message)}
              onRegisterBackHandler={registerBackHandler}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Tools;
