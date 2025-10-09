import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MailboxLookup from './components/MailboxLookup';
import PackageIntake from './components/PackageIntake';
import PackagePickup from './components/PackagePickup';
import Reports from './components/Reports';
import { OfflineStatusBar, OfflineDebugPanel } from './components/OfflineStatusBar';
// import { useOfflineStatus } from './hooks/useOffline';
import { useGlobalKeyboardShortcuts } from './hooks/useFocus';
import type { Mailbox, Tenant, ToastMessage } from './types';

// Toast notification component
function Toast({ message, type, onClose }: ToastMessage & { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, message.includes('error') ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type} animate-slide-up`}>
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200 text-lg font-bold"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Main dashboard component
function Dashboard() {
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [currentView, setCurrentView] = useState<'intake' | 'pickup' | 'reports'>('intake');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const mailboxLookupRef = useRef<HTMLInputElement>(null);
  const packageIntakeRef = useRef<HTMLInputElement>(null);

  const showToast = (type: ToastMessage['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    onFocusPackageIntake: () => {
      if (selectedMailbox && currentView === 'intake') {
        packageIntakeRef.current?.focus();
      } else if (selectedMailbox) {
        setCurrentView('intake');
      }
    },
    onFocusMailboxLookup: () => {
      mailboxLookupRef.current?.focus();
    },
  });

  const handleMailboxSelect = (mailbox: Mailbox, defaultTenant?: Tenant) => {
    setSelectedMailbox(mailbox);
    setSelectedTenant(defaultTenant || null);
    
    const tenantInfo = defaultTenant ? ` → ${defaultTenant.name}` : '';
    showToast('success', `Selected: Mailbox ${mailbox.mailbox_number}${tenantInfo}`);
  };

  const handleTenantChange = (tenant: Tenant | null) => {
    setSelectedTenant(tenant);
    if (tenant && selectedMailbox) {
      showToast('info', `Switched to: ${tenant.name} (Mailbox ${selectedMailbox.mailbox_number})`);
    }
  };

  // const clearSelection = () => {
  //   setSelectedMailbox(null);
  //   setSelectedTenant(null);
  // };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline Status Bar */}
      <OfflineStatusBar />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                📦 E3 Package Manager
              </h1>
              <span className="ml-3 text-sm text-gray-500 font-mono">
                Staff Dashboard
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div className="w-2 h-2 bg-green-500 rounded-full" title="System Online"></div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Tenant Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-4 text-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  Select Mailbox & Tenant
                </h2>
                {selectedMailbox && currentView === 'intake' && (
                  <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                    Press Tab → Start scanning packages
                  </div>
                )}
              </div>
              
              <MailboxLookup
                onMailboxSelect={handleMailboxSelect}
                onTenantChange={handleTenantChange}
                onDefaultTenantUpdate={(success, message) => {
                  showToast(success ? 'success' : 'error', message);
                }}
                placeholder="Type mailbox number (e.g., 145)"
                autoFocus={true}
              />
              
              {/* Keyboard shortcuts moved to bottom-center */}
            </div>
          </div>

          {/* Right Column - Main Action Area */}
          <div className="lg:col-span-2">
            {/* Navigation Buttons */}
            <div className="bg-white rounded-lg shadow-sm mb-6 p-4">
              <nav className="flex gap-3" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                {[ 
                  { id: 'intake', label: 'Package Intake' },
                  { id: 'pickup', label: 'Package Pickup' },
                  { id: 'reports', label: 'Reports' },
                ].map(tab => {
                  const isActive = currentView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setCurrentView(tab.id as any)}
                      className={`flex-1 py-4 px-6 rounded-lg transition-colors text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 ${
                        isActive
                          ? 'bg-blue-700 text-white shadow-md'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              {!selectedMailbox ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📬</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a Mailbox First
                  </h3>
                  <p className="text-gray-500">
                    Use the mailbox lookup on the left to get started
                  </p>
                  <div className="mt-4 text-sm text-gray-400">
                    <p>✨ New mailbox-first workflow:</p>
                    <p>• Type mailbox number → auto-select default tenant</p>
                    <p>• Switch tenants when needed</p>
                    <p>• Packages always tied to correct mailbox</p>
                  </div>
                </div>
              ) : (
                <div>
                  {currentView === 'intake' && (
                    <PackageIntake
                      selectedMailbox={selectedMailbox}
                      selectedTenant={selectedTenant}
                      onSuccess={(packageData) => {
                        if (packageData.offline) {
                          const count = packageData.batch?.length || 1;
                          showToast('info', `${count} package${count > 1 ? 's' : ''} queued for sync`);
                        } else {
                          const count = packageData.batch?.length || 1;
                          showToast('success', `✅ ${count} package${count > 1 ? 's' : ''} registered successfully`);
                        }
                      }}
                      onError={(error) => showToast('error', error)}
                    />
                  )}

                  {currentView === 'pickup' && (
                    <PackagePickup
                      selectedMailbox={selectedMailbox}
                      selectedTenant={selectedTenant}
                      onSuccess={(pickupData) => {
                        const count =
                          (pickupData && pickupData.pickup_summary && pickupData.pickup_summary.packages_picked_up) ??
                          (Array.isArray(pickupData?.packages) ? pickupData.packages.length : undefined) ??
                          (Array.isArray(pickupData?.package_ids) ? pickupData.package_ids.length : undefined) ??
                          0;

                        const plural = count === 1 ? '' : 's';
                        if (pickupData.offline) {
                          showToast('info', `Pickup queued for sync: ${count} package${plural}`);
                        } else {
                          showToast('success', `Pickup completed: ${count} package${plural}`);
                        }
                      }}
                      onError={(error) => showToast('error', error)}
                    />
                  )}

                  {currentView === 'reports' && (
                    <Reports
                      selectedMailbox={selectedMailbox}
                      selectedTenant={selectedTenant}
                      onError={(error) => showToast('error', error)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Keyboard shortcuts helper removed */}
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
      
      {/* Offline Debug Panel (dev only) */}
      <OfflineDebugPanel />
    </div>
  );
}

// Main App component
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
