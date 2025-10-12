import React, { useState } from 'react';
import Reports from './Reports';
import MailboxTenantManagement from './MailboxTenantManagement';
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
      { id: 'signature-retrieval', label: 'View Package Signatures', available: false },
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

  return (
    <div className="space-y-8" data-testid="tools-root">
      {activeTool && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveTool(null)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            data-testid="tools-back-button"
          >
            ← Back to Tools
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
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-2">✍️</div>
              <p className="font-medium mb-2">Signature Retrieval</p>
              <p className="text-sm">View and retrieve signatures for picked up packages</p>
              <p className="text-xs mt-4 text-gray-400">Coming soon</p>
            </div>
          )}

          {activeTool === 'mailbox-management' && (
            <MailboxTenantManagement
              onError={(e) => onError?.(e)}
              onSuccess={(message) => onSuccess?.(message)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Tools;
