import type { Mailbox, Tenant } from '../types';

interface ReportsProps {
  selectedMailbox?: Mailbox | null;
  selectedTenant?: Tenant | null;
  onError: (error: string) => void;
}

export default function Reports({ selectedMailbox, selectedTenant }: ReportsProps) {
  return (
    <div className="space-y-8" data-testid="reports-root">
      {/* Placeholder for Reports functionality */}
      <div 
        className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-dashed border-blue-300 p-12"
        data-testid="reports-placeholder"
      >
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Reports Dashboard</h2>
          <p className="text-gray-600 mb-6">
            This area is reserved for custom reports and analytics
          </p>
          
          {selectedMailbox && (
            <div className="inline-block bg-white rounded-lg border border-blue-200 px-4 py-2 text-sm text-gray-700">
              <span className="font-medium">Selected:</span> Mailbox {selectedMailbox.mailbox_number}
              {selectedTenant && <span className="ml-2">→ {selectedTenant.name}</span>}
            </div>
          )}
          
          <div className="mt-8 text-sm text-gray-500 italic">
            Define your report requirements here...
          </div>
        </div>
      </div>
    </div>
  );
}