export type ViewType = 'intake' | 'pickup' | 'tools';

export interface NavigationTab {
  id: ViewType;
  label: string;
  icon: string;
}

interface NavigationTabsProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  tabs: NavigationTab[];
}

export function NavigationTabs({ currentView, onViewChange, tabs }: NavigationTabsProps) {
  return (
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
        {tabs.map(tab => {
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`app-nav-tab-${tab.id}`}
              onClick={() => onViewChange(tab.id)}
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
  );
}
