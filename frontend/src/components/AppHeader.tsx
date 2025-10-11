export function AppHeader() {
  return (
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
              />
              <span 
                data-testid="app-online-text" 
                style={{ 
                  color: 'white', 
                  fontSize: '0.875rem', 
                  fontWeight: '600' 
                }}
              >
                Online
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
