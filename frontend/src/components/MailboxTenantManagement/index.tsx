import React, { useState, useEffect, useCallback } from 'react';
import type { Mailbox, Tenant } from '../../types';
import { useMailboxes } from './hooks/useMailboxes';
import { useTenants } from './hooks/useTenants';
import { MailboxSearch } from './MailboxSearch';
import { MailboxList } from './MailboxList';
import { MailboxForm } from './MailboxForm';
import { MailboxDetail } from './MailboxDetail';
import { TenantForm } from './TenantForm';
import { invalidateMailboxCache } from '../MailboxLookup';

interface MailboxTenantManagementProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  onRegisterBackHandler?: (handler: () => boolean) => void;
}

type ViewMode = 'search' | 'list' | 'view-mailbox' | 'add-mailbox' | 'edit-tenant' | 'add-tenant';

interface ViewState {
  mode: ViewMode;
  selectedMailbox: Mailbox | null;
  selectedTenant: Tenant | null;
}

const MailboxTenantManagement: React.FC<MailboxTenantManagementProps> = ({ 
  onError, 
  onSuccess,
  onRegisterBackHandler
}) => {
  // State management
  const [viewState, setViewState] = useState<ViewState>({
    mode: 'search',
    selectedMailbox: null,
    selectedTenant: null,
  });

  // Custom hooks
  const mailboxHook = useMailboxes(onError, onSuccess);
  const tenantHook = useTenants(onError, onSuccess);
  const { loadTenants } = tenantHook;
  const { resetForm: resetTenantForm } = tenantHook;
  const selectedMailboxId = viewState.selectedMailbox?.id;

  const handleBackToMailbox = useCallback(() => {
    resetTenantForm();
    setViewState((prev) => ({
      ...prev,
      mode: 'view-mailbox',
      selectedTenant: null,
    }));
  }, [resetTenantForm]);

  // Load tenants when a mailbox is selected
  useEffect(() => {
    if (!selectedMailboxId) {
      return;
    }

    void loadTenants(selectedMailboxId);
  }, [selectedMailboxId, loadTenants]);

  // Register back handler with parent
  useEffect(() => {
    if (!onRegisterBackHandler) return;

    const handleBack = (): boolean => {
      switch (viewState.mode) {
        case 'search':
          return false; // Let parent close the tool
        
        case 'list':
        case 'add-mailbox':
          handleBackToSearch();
          return true;
        
        case 'view-mailbox':
          // Go back to list view instead of search
          setViewState({ mode: 'list', selectedMailbox: null, selectedTenant: null });
          return true;
        
        case 'add-tenant':
        case 'edit-tenant':
          handleBackToMailbox();
          return true;
        
        default:
          return false;
      }
    };

    onRegisterBackHandler(handleBack);
  }, [viewState.mode, onRegisterBackHandler, handleBackToMailbox]);

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
    resetTenantForm();
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
  const handleCreateMailbox = async (mailboxNumber: string, tenants: Array<{name: string, email: string, phone: string}>) => {
    console.log('Creating mailbox:', mailboxNumber, 'with tenants:', tenants);
    
    const mailbox = await mailboxHook.createMailbox(mailboxNumber);
    
    if (!mailbox) {
      console.error('Mailbox creation failed - no mailbox returned');
      throw new Error('Mailbox creation failed'); // Throw error so form doesn't clear
    }
    
    console.log('Mailbox created successfully:', mailbox);
    
    // If mailbox was created and we have tenants to add
    if (tenants.length > 0) {
      let firstTenantId: number | null = null;
      
      // Add each tenant to the newly created mailbox
      for (let i = 0; i < tenants.length; i++) {
        const tenant = tenants[i];
        try {
          console.log(`Adding tenant ${i + 1}:`, tenant);
          const createdTenant = await tenantHook.createTenant(mailbox.id, mailbox.mailbox_number, tenant);
          console.log('Tenant created:', createdTenant);
          
          // Store the first tenant's ID
          if (i === 0 && createdTenant) {
            firstTenantId = createdTenant.id;
          }
        } catch (error) {
          console.error('Error adding tenant:', error);
        }
      }
      
      // Set the first tenant as default if we have one
      if (firstTenantId !== null) {
        console.log('Setting default tenant:', firstTenantId, 'for mailbox:', mailbox.id);
        // Small delay to ensure tenant is fully committed to database
        await new Promise(resolve => setTimeout(resolve, 100));
        await tenantHook.setDefaultTenant(mailbox.id, firstTenantId);
        console.log('Default tenant API call completed');
      }
    }
    
    console.log('Navigating back to search');
    
    // Invalidate the mailbox cache so new mailbox appears in package intake
    invalidateMailboxCache();
    
    handleBackToSearch();
  };

  const handleDeleteMailbox = async (mailbox: Mailbox) => {
    if (!window.confirm(`Are you sure you want to delete Mailbox ${mailbox.mailbox_number}? This will also delete all associated tenants.`)) {
      return;
    }
    await mailboxHook.deleteMailbox(mailbox.id);
    
    // Invalidate the mailbox cache so deletion is reflected in package intake
    invalidateMailboxCache();
    
    // Go back to the list view and reload mailboxes
    setViewState({ mode: 'list', selectedMailbox: null, selectedTenant: null });
    await mailboxHook.loadMailboxes();
  };

  // Tenant operations
  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewState.selectedMailbox) return;

    const isFirstTenant = tenantHook.tenants.length === 0;
    
    const createdTenant = await tenantHook.createTenant(
      viewState.selectedMailbox.id,
      viewState.selectedMailbox.mailbox_number,
      tenantHook.tenantForm
    );
    
    // If this is the first tenant, set it as default
    if (isFirstTenant && createdTenant) {
      try {
        await tenantHook.setDefaultTenant(viewState.selectedMailbox.id, createdTenant.id);
      } catch (error) {
        console.error('Error setting default tenant:', error);
      }
    }
    
  resetTenantForm();
    setViewState({ ...viewState, mode: 'view-mailbox' });
    await tenantHook.loadTenants(viewState.selectedMailbox.id);
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewState.selectedTenant || !viewState.selectedMailbox) return;

    await tenantHook.updateTenant(viewState.selectedTenant.id, tenantHook.tenantForm);
    resetTenantForm();
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
