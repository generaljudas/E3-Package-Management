import { useState, useEffect, useRef } from 'react';
import type { 
  Mailbox, 
  Tenant, 
  ReportsResponse,
  PickupHistoryResponse,
  AuditLogResponse
} from '../types';
import { reportsApi } from '../services/api';

interface ReportsProps {
  selectedMailbox?: Mailbox | null;
  selectedTenant?: Tenant | null;
  onError: (error: string) => void;
}

type ReportTab = 'statistics' | 'pickups' | 'audit';

interface DateRange {
  start_date: string;
  end_date: string;
}

// Statistics Dashboard Component
function StatisticsDashboard({ 
  mailboxId, 
  dateRange, 
  onError 
}: { 
  mailboxId?: number; 
  dateRange: DateRange; 
  onError: (error: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportsResponse | null>(null);

  useEffect(() => {
    loadStatistics();
  }, [mailboxId, dateRange]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.getStatistics({
        mailbox_id: mailboxId,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
      });
      setData(response);
    } catch (error) {
      console.error('Error loading statistics:', error);
      onError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="reports-statistics-loading">
        <div className="text-blue-600">Loading statistics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid="reports-statistics-empty">
        No statistics available
      </div>
    );
  }

  const { statistics } = data;

  return (
  <div className="space-y-6" data-testid="reports-statistics">
      {/* Overview Cards */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="reports-overview-cards">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">
            {statistics.overview.total_packages}
          </div>
          <div className="text-sm text-gray-600">Total Packages</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">
            {statistics.overview.packages_picked_up}
          </div>
          <div className="text-sm text-gray-600">Picked Up</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-orange-600">
            {statistics.overview.packages_ready + statistics.overview.packages_received}
          </div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-purple-600">
            {statistics.overview.high_value_packages}
          </div>
          <div className="text-sm text-gray-600">High Value</div>
        </div>
      </div>

      {/* Carrier Distribution */}
  <div className="bg-white rounded-lg border border-gray-200 p-6" data-testid="reports-carriers">
  <h3 className="text-lg font-semibold mb-4">Carrier Distribution</h3>
        <div className="space-y-3">
          {statistics.carriers.map((carrier, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <span className="font-medium">{carrier.carrier}</span>
                  <span className="text-sm text-gray-500">
                    {carrier.pickup_rate}% pickup rate
                  </span>
                </div>
                <div className="mt-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(carrier.package_count / statistics.overview.total_packages) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div className="ml-4 text-right">
                <div className="font-semibold">{carrier.package_count}</div>
                <div className="text-xs text-gray-500">packages</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Mailboxes */}
      {statistics.top_mailboxes.length > 0 && (
  <div className="bg-white rounded-lg border border-gray-200 p-6" data-testid="reports-top-mailboxes">
          <h3 className="text-lg font-semibold mb-4">Most Active Mailboxes</h3>
          <div className="space-y-2">
            {statistics.top_mailboxes.slice(0, 5).map((mailbox, index) => (
              <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded">
                <div>
                  <div className="font-medium">Mailbox {mailbox.mailbox_number}</div>
                  <div className="text-sm text-gray-500">
                    {mailbox.default_tenant_name || 'No default tenant'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{mailbox.total_packages}</div>
                  <div className="text-xs text-gray-500">
                    {mailbox.pending_packages} pending
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Trends */}
      {statistics.daily_trends.length > 0 && (
  <div className="bg-white rounded-lg border border-gray-200 p-6" data-testid="reports-daily-trends">
          <h3 className="text-lg font-semibold mb-4">Daily Activity</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {statistics.daily_trends.slice(0, 14).map((day, index) => (
              <div key={index} className="flex items-center justify-between p-2 text-sm">
                <div className="font-medium">
                  {new Date(day.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="flex space-x-4 text-xs">
                  <span className="text-blue-600">
                    {day.packages_received} received
                  </span>
                  <span className="text-green-600">
                    {day.packages_picked_up} picked up
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Pickup History Component
function PickupHistory({ 
  mailboxId, 
  tenantId, 
  dateRange, 
  onError 
}: { 
  mailboxId?: number; 
  tenantId?: number;
  dateRange: DateRange; 
  onError: (error: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PickupHistoryResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    loadPickupHistory();
  }, [mailboxId, tenantId, dateRange, currentPage]);

  const loadPickupHistory = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.getPickupHistory({
        mailbox_id: mailboxId,
        tenant_id: tenantId,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        limit: 25,
        offset: currentPage * 25,
      });
      setData(response);
    } catch (error) {
      console.error('Error loading pickup history:', error);
      onError('Failed to load pickup history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="reports-pickups-loading">
        <div className="text-blue-600">Loading pickup history...</div>
      </div>
    );
  }

  if (!data || data.pickups.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid="reports-pickups-empty">
        No pickup history found for the selected criteria
      </div>
    );
  }

  return (
  <div className="space-y-4" data-testid="reports-pickups">
      {/* Summary */}
  <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="reports-pickups-summary">
        <div className="text-sm text-gray-600">
          Showing {data.pickups.length} of {data.pagination.total} pickup events
        </div>
      </div>

      {/* Pickup Events */}
  <div className="space-y-3" data-testid="reports-pickups-list">
        {data.pickups.map((pickup) => (
          <div 
            key={pickup.pickup_event_id} 
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-semibold text-gray-900">
                  Mailbox {pickup.mailbox_number}
                  {pickup.tenant_name && (
                    <span className="ml-2 text-gray-600">→ {pickup.tenant_name}</span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(pickup.pickup_timestamp).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-blue-600">
                  {pickup.package_count} packages
                </div>
                {pickup.high_value_count > 0 && (
                  <div className="text-xs text-orange-600">
                    {pickup.high_value_count} high-value
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-700">Pickup Person:</div>
                <div>{pickup.pickup_person_name}</div>
                {pickup.staff_initials && (
                  <div className="text-gray-500 mt-1">
                    Staff: {pickup.staff_initials}
                  </div>
                )}
              </div>
              <div>
                <div className="font-medium text-gray-700">Tracking Numbers:</div>
                <div className="text-xs space-y-1 max-h-20 overflow-y-auto">
                  {pickup.tracking_numbers.map((tracking, index) => (
                    <div key={index} className="font-mono">
                      {tracking} 
                      {pickup.carriers[index] && (
                        <span className="ml-2 text-gray-500">
                          ({pickup.carriers[index]})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {pickup.signature_count > 0 && (
              <div className="mt-3 text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                ✓ Signature captured ({pickup.signature_count} signatures)
              </div>
            )}

            {pickup.pickup_notes && (
              <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                <span className="font-medium">Notes:</span> {pickup.pickup_notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {data.pagination.total > 25 && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4" data-testid="reports-pickups-pagination">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage + 1} of {Math.ceil(data.pagination.total / 25)}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!data.pagination.has_more}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// Audit Log Component  
function AuditLog({ 
  mailboxId, 
  dateRange, 
  onError 
}: { 
  mailboxId?: number; 
  dateRange: DateRange; 
  onError: (error: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    loadAuditLog();
  }, [mailboxId, dateRange, currentPage, actionFilter]);

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.getAuditLog({
        mailbox_id: mailboxId,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        action_type: actionFilter === 'all' ? undefined : actionFilter as any,
        limit: 50,
        offset: currentPage * 50,
      });
      setData(response);
    } catch (error) {
      console.error('Error loading audit log:', error);
      onError('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="reports-audit-loading">
        <div className="text-blue-600">Loading audit log...</div>
      </div>
    );
  }

  if (!data || data.audit_log.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid="reports-audit-empty">
        No audit log entries found for the selected criteria
      </div>
    );
  }

  const getActionIcon = (_: string) => {
    return '';
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'package_intake': return 'text-blue-600 bg-blue-50';
      case 'pickup': return 'text-green-600 bg-green-50';
      case 'status_change': return 'text-orange-600 bg-orange-50';
      case 'tenant_update': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
  <div className="space-y-4" data-testid="reports-audit">
      {/* Filters */}
  <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="reports-audit-filters">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {data.audit_log.length} of {data.pagination.total} log entries
          </div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(0);
            }}
            className="text-sm border border-gray-300 rounded px-3 py-1 bg-white"
          >
            <option value="all">All Actions</option>
            <option value="package_intake">Package Intake</option>
            <option value="pickup">Pickups</option>
            <option value="status_change">Status Changes</option>
            <option value="tenant_update">Tenant Updates</option>
          </select>
        </div>
      </div>

      {/* Log Entries */}
  <div className="space-y-2" data-testid="reports-audit-list">
        {data.audit_log.map((entry, index) => (
          <div 
            key={index} 
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start space-x-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${getActionColor(entry.action_type)}`}>
                {getActionIcon(entry.action_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">
                    {entry.description}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  Mailbox {entry.mailbox_number}
                  {entry.tenant_name && (
                    <span className="ml-1">→ {entry.tenant_name}</span>
                  )}
                  {entry.tracking_number && (
                    <span className="ml-1 font-mono">({entry.tracking_number})</span>
                  )}
                </div>
                {entry.details && (
                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    {entry.details}
                    {entry.staff_initials && (
                      <span className="ml-2">Staff: {entry.staff_initials}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {data.pagination.total > 50 && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4" data-testid="reports-audit-pagination">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage + 1} of {Math.ceil(data.pagination.total / 50)}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!data.pagination.has_more}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// Main Reports Component
export default function Reports({ selectedMailbox, selectedTenant, onError }: ReportsProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>('statistics');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
    };
  });

  const tabsRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== tabsRef.current) return;
      
      const tabs: ReportTab[] = ['statistics', 'pickups', 'audit'];
      const currentIndex = tabs.indexOf(activeTab);
      
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveTab(tabs[(currentIndex + 1) % tabs.length]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const tabs = [
    { id: 'statistics' as const, label: 'Statistics', icon: '', desc: 'Package & mailbox stats' },
    { id: 'pickups' as const, label: 'Pickup History', icon: '', desc: 'All pickup events' },
    { id: 'audit' as const, label: 'Audit Log', icon: '', desc: 'System activity log' },
  ];

  return (
    <div className="space-y-8" data-testid="reports-root">
      {/* Header with Date Range */}
  <div className="bg-white rounded-lg border border-gray-200 p-6" data-testid="reports-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reports Dashboard</h2>
            <p className="text-gray-600 mt-1">
              {selectedMailbox ? `Mailbox ${selectedMailbox.mailbox_number}` : 'All mailboxes'}
              {selectedTenant && ` → ${selectedTenant.name}`}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4" data-testid="reports-date-range">
            <div className="flex items-center space-x-2 text-sm">
              <label className="text-gray-600">From:</label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                className="border border-gray-300 rounded px-3 py-1"
                data-testid="reports-date-from"
              />
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <label className="text-gray-600">To:</label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
                className="border border-gray-300 rounded px-3 py-1"
                data-testid="reports-date-to"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
  <div className="bg-white rounded-lg border border-gray-200" data-testid="reports-tabs">
        <div 
          ref={tabsRef}
          className="border-b border-gray-200"
          tabIndex={0}
          role="tablist"
          aria-label="Reports navigation"
        >
          <nav className="-mb-px flex" data-testid="reports-tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
                data-testid={`reports-tab-${tab.id}`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
                <div className="text-xs opacity-75 mt-1">{tab.desc}</div>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
  <div className="p-6" data-testid="reports-content">
          {activeTab === 'statistics' && (
            <StatisticsDashboard
              mailboxId={selectedMailbox?.id}
              dateRange={dateRange}
              onError={onError}
            />
          )}
          
          {activeTab === 'pickups' && (
            <PickupHistory
              mailboxId={selectedMailbox?.id}
              tenantId={selectedTenant?.id}
              dateRange={dateRange}
              onError={onError}
            />
          )}
          
          {activeTab === 'audit' && (
            <AuditLog
              mailboxId={selectedMailbox?.id}
              dateRange={dateRange}
              onError={onError}
            />
          )}
        </div>
      </div>

      {/* Keyboard Help */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-blue-800">
          <div className="font-medium mb-1">Keyboard Navigation:</div>
          <div>• Focus tabs and use <strong>← →</strong> arrow keys to switch between reports</div>
          <div>• Use date inputs to filter data by time period</div>
        </div>
      </div>
    </div>
  );
}