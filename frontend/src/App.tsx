import { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PackageIntake from './components/PackageIntake';
import PackagePickup from './components/PackagePickup';
import Tools from './components/Tools';
import { OfflineStatusBar, OfflineDebugPanel } from './components/OfflineStatusBar';
import TestIdOverlay from './components/TestIdOverlay';
import { AppHeader } from './components/AppHeader';
import { NavigationTabs } from './components/NavigationTabs';
import type { ViewType } from './components/NavigationTabs';
import { MailboxSelectionCard } from './components/MailboxSelectionCard';
import { EmptyState } from './components/EmptyState';
import { ToastContainer } from './components/Toast';
import { useGlobalKeyboardShortcuts } from './hooks/useFocus';
import { useToast } from './hooks/useToast';
import { NAVIGATION_TABS, EMPTY_STATE } from './constants/navigation';
import type { Mailbox, Tenant } from './types';

// Main dashboard component
function Dashboard() {
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('intake');
  
  const mailboxLookupRef = useRef<HTMLInputElement>(null);
  const packageIntakeRef = useRef<HTMLInputElement>(null);

  const { toasts, showToast, removeToast } = useToast();

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

  const handleClearSelection = () => {
    setSelectedMailbox(null);
    setSelectedTenant(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <OfflineStatusBar />
      <AppHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} data-testid="app-main-container">
        <NavigationTabs 
          currentView={currentView}
          onViewChange={setCurrentView}
          tabs={NAVIGATION_TABS}
        />
        
        <MailboxSelectionCard
          onMailboxSelect={handleMailboxSelect}
          onTenantChange={handleTenantChange}
          onDefaultTenantUpdate={(success: boolean, message: string) => {
            showToast(success ? 'success' : 'error', message);
          }}
          onClearSelection={handleClearSelection}
        />

        <div 
          data-testid="app-main-content-area"
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            minHeight: '500px'
          }}
        >
          {!selectedMailbox ? (
            <EmptyState
              icon={EMPTY_STATE.icon}
              title={EMPTY_STATE.title}
              description={EMPTY_STATE.description}
            />
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

                  {currentView === 'tools' && (
                    <Tools
                      selectedMailbox={selectedMailbox}
                      selectedTenant={selectedTenant}
                      onError={(error) => showToast('error', error)}
                    />
                  )}
                </div>
              )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      <OfflineDebugPanel />
      <TestIdOverlay />
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
