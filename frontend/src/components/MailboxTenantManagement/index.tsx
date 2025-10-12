import React, { useState, useEffect } from 'react';
import type { Mailbox, Tenant } from '../../types';
import { useMailboxes } from './hooks/useMailboxes';
import { useTenants } from './hooks/useTenants';
import { MailboxSearch } from './MailboxSearch';
import { MailboxList } from './MailboxList';
import { MailboxForm } from './MailboxForm';
import { MailboxDetail } from './MailboxDetail';
import { TenantForm } from './TenantForm';

interface MailboxTenantManagementProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

type ViewMode = 'search' | 'list' | 'view-mailbox' | 'add-mailbox' | 'edit-tenant' | 'add-tenant';

interface ViewState {
  mode: ViewMode;
  selectedMailbox: Mailbox | null;
  selectedTenant: Tenant | null;
}

const MailboxTenantManagement: React.FC<MailboxTenantManagementProps> = ({ onError, onSuccess }) => {
  // State management
  const [viewState, setViewState] = useState<ViewState>({
    mode: 'search',
    selectedMailbox: null,
    selectedTenant: null,
  });

  // Custom hooks
  const mailboxHook = useMailboxes(onError, onSuccess);
  const tenantHook = useTenants(onError, onSuccess);

  // Load tenants when a mailbox is selected
  useEffect(() => {
    if (viewState.selectedMailbox) {
      tenantHook.loadTenants(viewState.selectedMailbox.id);
    }
  }, [viewState.selectedMailbox?.id]);

  // Navigation handlers
  const handleViewMailbox = (mailbox: Mailbox) => {
    setViewState({
      mode: 'view-mailbox',
      selectedMailbox: mailbox,
      selectedTenant: null,
    });
  };

  const handleBackToSearch = () => {
    setViewState({
      mode: 'search',
      selectedMailbox: null,
      selectedTenant: null,
    });
  };

  const handleViewAll = async () => {
    setViewState({ ...viewState, mode: 'list' });
    await mailboxHook.loadMailboxes();
  };

  const handleShowAddMailbox = () => {
    setViewState({ ...viewState, mode: 'add-mailbox' });
  };

  const handleShowAddTenant = () => {
    tenantHook.resetForm();
    setViewState({ ...viewState, mode: 'add-tenant' });
  };

  const handleShowEditTenant = (tenant: Tenant) => {
    tenantHook.populateForm(tenant);
    setViewState({
      ...viewState,
      mode: 'edit-tenant',
      selectedTenant: tenant,
    });
  };

  // Mailbox operations
  const handleCreateMailbox = async (mailboxNumber: string) => {
    await mailboxHook.createMailbox(mailboxNumber);
    handleBackToSearch();
  };

  const handleDeleteMailbox = async (mailbox: Mailbox) => {
    if (!window.confirm(`Are you sure you want to delete Mailbox ${mailbox.mailbox_number}? This will also delete all associated tenants.`)) {
      return;
    }
    await mailboxHook.deleteMailbox(mailbox.id);
    handleBackToSearch();
  };

  // Tenant operations
  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewState.selectedMailbox) return;

    await tenantHook.createTenant(viewState.selectedMailbox.id, tenantHook.tenantForm);
    tenantHook.resetForm();
    setViewState({ ...viewState, mode: 'view-mailbox' });
    await tenantHook.loadTenants(viewState.selectedMailbox.id);
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewState.selectedTenant || !viewState.selectedMailbox) return;

    await tenantHook.updateTenant(viewState.selectedTenant.id, tenantHook.tenantForm);
    tenantHook.resetForm();
    setViewState({ ...viewState, mode: 'view-mailbox', selectedTenant: null });
    await tenantHook.loadTenants(viewState.selectedMailbox.id);
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!window.confirm(`Are you sure you want to delete tenant "${tenant.name}"?`)) {
      return;
    }
    if (!viewState.selectedMailbox) return;

    await tenantHook.deleteTenant(tenant.id);
    await tenantHook.loadTenants(viewState.selectedMailbox.id);
  };

  const handleBackToMailbox = () => {
    tenantHook.resetForm();
    setViewState({ ...viewState, mode: 'view-mailbox', selectedTenant: null });
  };

  // Render appropriate view based on state
  switch (viewState.mode) {
    case 'search':
      return (
        <MailboxSearch
          onViewMailbox={handleViewMailbox}
          onAddMailbox={handleShowAddMailbox}
          onViewAll={handleViewAll}
          searchMailboxes={mailboxHook.searchMailboxes}
          isSearching={mailboxHook.loading}
        />
      );

    case 'list':
      return (
        <MailboxList
          mailboxes={mailboxHook.mailboxes}
          loading={mailboxHook.loading}
          onViewMailbox={handleViewMailbox}
          onAddMailbox={handleShowAddMailbox}
        />
      );

    case 'add-mailbox':
      return (
        <MailboxForm
          onSubmit={handleCreateMailbox}
          onCancel={handleBackToSearch}
          loading={mailboxHook.loading}
        />
      );

    case 'view-mailbox':
      if (!viewState.selectedMailbox) return null;
      return (
        <MailboxDetail
          mailbox={viewState.selectedMailbox}
          tenants={tenantHook.tenants}
          onBack={handleBackToSearch}
          onDeleteMailbox={handleDeleteMailbox}
          onAddTenant={handleShowAddTenant}
          onEditTenant={handleShowEditTenant}
          onDeleteTenant={handleDeleteTenant}
        />
      );

    case 'add-tenant':
    case 'edit-tenant':
      return (
        <TenantForm
          mode={viewState.mode === 'add-tenant' ? 'add' : 'edit'}
          formData={tenantHook.tenantForm}
          loading={tenantHook.loading}
          onFormChange={tenantHook.setTenantForm}
          onSubmit={viewState.mode === 'add-tenant' ? handleAddTenant : handleEditTenant}
          onCancel={handleBackToMailbox}
        />
      );

    default:
      return null;
  }
};

export default MailboxTenantManagement;
