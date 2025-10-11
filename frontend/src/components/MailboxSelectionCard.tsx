import MailboxLookup from './MailboxLookup';
import type { Mailbox, Tenant } from '../types';

interface MailboxSelectionCardProps {
  onMailboxSelect: (mailbox: Mailbox, defaultTenant?: Tenant) => void;
  onTenantChange: (tenant: Tenant | null) => void;
  onDefaultTenantUpdate: (success: boolean, message: string) => void;
}

export function MailboxSelectionCard({
  onMailboxSelect,
  onTenantChange,
  onDefaultTenantUpdate
}: MailboxSelectionCardProps) {
  return (
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
        onMailboxSelect={onMailboxSelect}
        onTenantChange={onTenantChange}
        onDefaultTenantUpdate={onDefaultTenantUpdate}
        placeholder="Type mailbox number (e.g., 145) or tenant name..."
        autoFocus={true}
      />
    </div>
  );
}
