interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
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
        {icon}
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
        {title}
      </h3>
      <p 
        data-testid="app-empty-state-description"
        style={{
          color: '#6b7280',
          fontSize: '1rem'
        }}
      >
        {description}
      </p>
    </div>
  );
}
