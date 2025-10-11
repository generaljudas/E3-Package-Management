import React, { useState } from 'react';
import Reports from './Reports';
import type { Mailbox, Tenant } from '../types';

type ToolId = 'reports' | 'exports' | 'admin';

interface ToolsProps {
  selectedMailbox: Mailbox;
  selectedTenant?: Tenant | null;
  onError?: (error: string) => void;
}

const toolTabs: Array<{ id: ToolId; label: string; available: boolean }> = [
  { id: 'reports', label: 'Reports', available: true },
  { id: 'exports', label: 'Exports', available: false },
  { id: 'admin', label: 'Admin Tools', available: false },
];

const Tools: React.FC<ToolsProps> = ({ selectedMailbox, selectedTenant, onError }) => {
  const [activeTool, setActiveTool] = useState<ToolId>('reports');

  return (
    <div className="space-y-8" data-testid="tools-root">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900" data-testid="tools-header">Tools</h3>
        <span className="text-sm text-gray-500">Select a tool below</span>
      </div>

      {/* Tool tabs */}
      <div className="flex gap-2" data-testid="tools-tabs">
        {toolTabs.map((tab) => {
          const isActive = activeTool === tab.id;
          const common = 'px-3 py-2 rounded text-sm font-medium transition-colors';
          if (!tab.available) {
            return (
              <button
                key={tab.id}
                className={`${common} bg-gray-100 text-gray-400 cursor-not-allowed`}
                title={`${tab.label} — coming soon`}
                disabled
              >
                {tab.label}
              </button>
            );
          }
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTool(tab.id)}
              className={`${common} ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              data-testid={`tools-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tool content */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white" data-testid="tools-content">
        {activeTool === 'reports' && (
          <Reports
            selectedMailbox={selectedMailbox}
            selectedTenant={selectedTenant || null}
            onError={(e) => onError?.(e)}
          />
        )}

        {activeTool !== 'reports' && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-2">&nbsp;</div>
            <p>{toolTabs.find(t => t.id === activeTool)?.label} will be available soon.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tools;
