import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MailboxLookup from './components/MailboxLookup';
import PackageIntake from './components/PackageIntake';
import PackagePickup from './components/PackagePickup';
import Tools from './components/Tools';
import { OfflineStatusBar, OfflineDebugPanel } from './components/OfflineStatusBar';
import TestIdOverlay from './components/TestIdOverlay';
// import { useOfflineStatus } from './hooks/useOffline';
import { useGlobalKeyboardShortcuts } from './hooks/useFocus';
import type { Mailbox, Tenant, ToastMessage } from './types';

// Modern Toast Notification
function Toast({ message, type, onClose }: ToastMessage & { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, message.includes('error') ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [onClose, message]);

  const styles: Record<ToastMessage['type'], { background: string; icon: string }> = {
    success: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      icon: '✓'
    },
    error: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      icon: '✕'
    },
    warning: {
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      icon: '⚠'
    },
    info: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      icon: 'ℹ'
    }
  };

  const style = styles[type];

  return (
    <div 
      data-testid={`toast-${type}`}
      style={{
        background: style.background,
        color: 'white',
        padding: '1rem 1.5rem',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        minWidth: '300px',
        maxWidth: '500px',
        animation: 'slideInRight 0.3s ease-out'
      }}
    >
      <div 
        data-testid="toast-icon"
        style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          width: '32px',
          height: '32px',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {style.icon}
      </div>
      <span 
        data-testid="toast-message"
        style={{
          flex: 1,
          fontWeight: '600',
          fontSize: '0.95rem',
          lineHeight: 1.5
        }}
      >{message}</span>
      <button
        data-testid="toast-close-button"
        onClick={onClose}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          color: 'white',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
          fontWeight: 'bold',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
      >
        ×
      </button>
    </div>
  );
}

// Main dashboard component
function Dashboard() {
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [currentView, setCurrentView] = useState<'intake' | 'pickup' | 'tools'>('intake');
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
      
      {/* Modern Header */}
      <header 
        data-testid="app-header"
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center gap-3" data-testid="app-header-branding">
              <div 
                data-testid="app-logo"
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: 'white',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
                }}
              >
                E3
              </div>
              <div data-testid="app-header-title">
                <h1 
                  data-testid="app-title"
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: '700',
                    color: 'white',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.2
                  }}
                >
                  Package Manager
                </h1>
                <span 
                  data-testid="app-subtitle"
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.75)',
                    fontWeight: '500'
                  }}
                >
                  Staff Dashboard
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-6" data-testid="app-header-status">
              <div 
                data-testid="app-current-datetime"
                style={{
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: '500'
                }}
              >
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div 
                data-testid="app-online-status-badge"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '20px',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div 
                  data-testid="app-online-indicator"
                  style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#10b981',
                    borderRadius: '50%',
                    boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
                  }}
                ></div>
                <span data-testid="app-online-text" style={{ color: 'white', fontSize: '0.875rem', fontWeight: '600' }}>Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} data-testid="app-main-container">
        {/* Modern Navigation Tabs */}
        <div 
          data-testid="app-navigation-tabs"
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(0, 0, 0, 0.05)'
          }}
        >
          <nav style={{ display: 'flex', gap: '8px' }} data-testid="app-navigation-buttons">
            {[
              { id: 'intake', label: '📦 Package Intake', icon: '📦' },
              { id: 'pickup', label: '✅ Package Pickup', icon: '✅' },
              { id: 'tools', label: '🛠️ Tools', icon: '🛠️' },
            ].map(tab => {
              const isActive = currentView === tab.id;
              return (
                <button
                  key={tab.id}
                  data-testid={`app-nav-tab-${tab.id}`}
                  onClick={() => setCurrentView(tab.id as any)}
                  style={{
                    flex: 1,
                    padding: '1.25rem 1.5rem',
                    borderRadius: '12px',
                    fontSize: '1.125rem',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isActive 
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                      : 'transparent',
                    color: isActive ? 'white' : '#4b5563',
                    boxShadow: isActive 
                      ? '0 4px 12px rgba(59, 130, 246, 0.3)'
                      : 'none',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f3f4f6';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Modern Mailbox Selection Card */}
        <div 
          data-testid="app-mailbox-selection-card"
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ marginBottom: '1.5rem' }} data-testid="app-mailbox-selection-header">
            <h2 
              data-testid="app-mailbox-selection-title"
              style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}
            >
              Select Mailbox & Tenant
            </h2>
            <p 
              data-testid="app-mailbox-selection-description"
              style={{ color: '#6b7280', fontSize: '0.875rem' }}
            >
              Search for a mailbox by number or tenant name to begin
            </p>
          </div>
          <MailboxLookup
            onMailboxSelect={handleMailboxSelect}
            onTenantChange={handleTenantChange}
            onDefaultTenantUpdate={(success, message) => {
              showToast(success ? 'success' : 'error', message);
            }}
            placeholder="Type mailbox number (e.g., 145) or tenant name..."
            autoFocus={true}
          />
        </div>

        {/* Main Content Area */}
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
            <div 
              data-testid="app-empty-state"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: '6rem',
                paddingBottom: '6rem',
                textAlign: 'center'
              }}
            >
              <div 
                data-testid="app-empty-state-icon"
                style={{
                  width: '120px',
                  height: '120px',
                  background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '4rem',
                  marginBottom: '2rem'
                }}
              >
                📫
              </div>
              <h3 
                data-testid="app-empty-state-title"
                style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#1f2937',
                  marginBottom: '0.75rem'
                }}
              >
                Select a mailbox to get started
              </h3>
              <p 
                data-testid="app-empty-state-description"
                style={{
                  color: '#6b7280',
                  fontSize: '1rem'
                }}
              >
                Choose a mailbox above to begin managing packages
              </p>
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

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 space-y-2 z-50" data-testid="app-toast-container">
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
      
      {/* Test ID Overlay */}
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
