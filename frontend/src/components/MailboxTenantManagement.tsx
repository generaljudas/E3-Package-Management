import React, { useState, useEffect } from 'react';
import type { Mailbox, Tenant } from '../types';
import { mailboxApi, tenantApi } from '../services/api';

interface MailboxTenantManagementProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

type ViewMode = 'list' | 'view-mailbox' | 'add-mailbox' | 'edit-tenant' | 'add-tenant';

interface ViewState {
  mode: ViewMode;
  selectedMailbox: Mailbox | null;
  selectedTenant: Tenant | null;
}

const MailboxTenantManagement: React.FC<MailboxTenantManagementProps> = ({ onError, onSuccess }) => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({
    mode: 'list',
    selectedMailbox: null,
    selectedTenant: null,
  });

  // Form states
  const [newMailboxNumber, setNewMailboxNumber] = useState('');
  const [tenantForm, setTenantForm] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Load all mailboxes on mount
  useEffect(() => {
    loadMailboxes();
  }, []);

  // Load tenants when a mailbox is selected
  useEffect(() => {
    if (viewState.selectedMailbox) {
      loadTenants(viewState.selectedMailbox.id);
    }
  }, [viewState.selectedMailbox]);

  const loadMailboxes = async () => {
    setLoading(true);
    try {
      const response = await mailboxApi.getAll();
      setMailboxes(response.mailboxes);
    } catch (error) {
      console.error('Error loading mailboxes:', error);
      onError?.('Failed to load mailboxes');
    } finally {
      setLoading(false);
    }
  };

  const loadTenants = async (mailboxId: number) => {
    setLoading(true);
    try {
      const response = await tenantApi.getByMailboxId(mailboxId);
      setTenants(response.tenants);
    } catch (error) {
      console.error('Error loading tenants:', error);
      onError?.('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleViewMailbox = (mailbox: Mailbox) => {
    setViewState({
      mode: 'view-mailbox',
      selectedMailbox: mailbox,
      selectedTenant: null,
    });
  };

  const handleBackToList = () => {
    setViewState({
      mode: 'list',
      selectedMailbox: null,
      selectedTenant: null,
    });
    setTenants([]);
  };

  const handleAddMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMailboxNumber.trim()) {
      onError?.('Please enter a mailbox number');
      return;
    }

    setLoading(true);
    try {
      await mailboxApi.create({ mailbox_number: newMailboxNumber });
      onSuccess?.(`Mailbox ${newMailboxNumber} created successfully`);
      setNewMailboxNumber('');
      setViewState({ mode: 'list', selectedMailbox: null, selectedTenant: null });
      loadMailboxes();
    } catch (error) {
      console.error('Error creating mailbox:', error);
      onError?.('Failed to create mailbox');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMailbox = async (mailbox: Mailbox) => {
    if (!window.confirm(`Are you sure you want to delete Mailbox ${mailbox.mailbox_number}? This will also delete all associated tenants.`)) {
      return;
    }

    setLoading(true);
    try {
      await mailboxApi.delete(mailbox.id);
      onSuccess?.(`Mailbox ${mailbox.mailbox_number} deleted successfully`);
      handleBackToList();
      loadMailboxes();
    } catch (error) {
      console.error('Error deleting mailbox:', error);
      onError?.('Failed to delete mailbox');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewState.selectedMailbox) return;
    if (!tenantForm.name.trim()) {
      onError?.('Please enter a tenant name');
      return;
    }

    setLoading(true);
    try {
      await tenantApi.create({
        mailbox_id: viewState.selectedMailbox.id,
        name: tenantForm.name,
        email: tenantForm.email || undefined,
        phone: tenantForm.phone || undefined,
      });
      onSuccess?.(`Tenant ${tenantForm.name} added successfully`);
      setTenantForm({ name: '', email: '', phone: '' });
      setViewState({ ...viewState, mode: 'view-mailbox' });
      loadTenants(viewState.selectedMailbox.id);
    } catch (error) {
      console.error('Error adding tenant:', error);
      onError?.('Failed to add tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewState.selectedTenant) return;
    if (!tenantForm.name.trim()) {
      onError?.('Please enter a tenant name');
      return;
    }

    setLoading(true);
    try {
      await tenantApi.update(viewState.selectedTenant.id, {
        name: tenantForm.name,
        email: tenantForm.email || undefined,
        phone: tenantForm.phone || undefined,
      });
      onSuccess?.(`Tenant ${tenantForm.name} updated successfully`);
      setTenantForm({ name: '', email: '', phone: '' });
      setViewState({ ...viewState, mode: 'view-mailbox', selectedTenant: null });
      if (viewState.selectedMailbox) {
        loadTenants(viewState.selectedMailbox.id);
      }
    } catch (error) {
      console.error('Error updating tenant:', error);
      onError?.('Failed to update tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!window.confirm(`Are you sure you want to delete tenant "${tenant.name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await tenantApi.deactivate(tenant.id);
      onSuccess?.(`Tenant ${tenant.name} deleted successfully`);
      if (viewState.selectedMailbox) {
        loadTenants(viewState.selectedMailbox.id);
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      onError?.('Failed to delete tenant');
    } finally {
      setLoading(false);
    }
  };

  const startEditTenant = (tenant: Tenant) => {
    setTenantForm({
      name: tenant.name,
      email: tenant.email || '',
      phone: tenant.phone || '',
    });
    setViewState({
      ...viewState,
      mode: 'edit-tenant',
      selectedTenant: tenant,
    });
  };

  const startAddTenant = () => {
    setTenantForm({ name: '', email: '', phone: '' });
    setViewState({
      ...viewState,
      mode: 'add-tenant',
    });
  };

  // Render loading state
  if (loading && viewState.mode === 'list' && mailboxes.length === 0) {
    return (
      <div className="text-center py-12" data-testid="mailbox-management-loading">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">Loading mailboxes...</p>
      </div>
    );
  }

  // Render mailbox list view
  if (viewState.mode === 'list') {
    return (
      <div className="space-y-6" data-testid="mailbox-management-list">
        <div className="flex items-center justify-between">
          <h4 className="text-xl font-semibold text-gray-900">All Mailboxes</h4>
          <button
            onClick={() => setViewState({ ...viewState, mode: 'add-mailbox' })}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            data-testid="add-mailbox-button"
          >
            + Add New Mailbox
          </button>
        </div>

        {mailboxes.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-600 mb-4">No mailboxes found</p>
            <button
              onClick={() => setViewState({ ...viewState, mode: 'add-mailbox' })}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Create your first mailbox
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mailboxes.map((mailbox) => (
              <button
                key={mailbox.id}
                onClick={() => handleViewMailbox(mailbox)}
                className="bg-white border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg rounded-lg p-6 transition-all text-left"
                data-testid={`mailbox-card-${mailbox.mailbox_number}`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className="text-3xl">📬</div>
                  <div>
                    <h5 className="text-lg font-bold text-gray-900">
                      Mailbox {mailbox.mailbox_number}
                    </h5>
                    <p className="text-sm text-gray-500">
                      ID: {mailbox.id}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-600 mt-3">
                  Click to view tenants →
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render add mailbox form
  if (viewState.mode === 'add-mailbox') {
    return (
      <div className="space-y-6" data-testid="mailbox-management-add">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBackToList}
            className="text-blue-600 hover:text-blue-800 font-medium"
            data-testid="back-to-list-button"
          >
            ← Back to Mailboxes
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md">
          <h4 className="text-xl font-semibold text-gray-900 mb-4">Add New Mailbox</h4>
          <form onSubmit={handleAddMailbox} className="space-y-4">
            <div>
              <label htmlFor="mailbox-number" className="block text-sm font-medium text-gray-700 mb-2">
                Mailbox Number *
              </label>
              <input
                id="mailbox-number"
                type="text"
                value={newMailboxNumber}
                onChange={(e) => setNewMailboxNumber(e.target.value)}
                placeholder="e.g., 101"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                data-testid="mailbox-number-input"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
                data-testid="submit-mailbox-button"
              >
                {loading ? 'Creating...' : 'Create Mailbox'}
              </button>
              <button
                type="button"
                onClick={handleBackToList}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                data-testid="cancel-mailbox-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render mailbox detail view with tenants
  if (viewState.mode === 'view-mailbox' && viewState.selectedMailbox) {
    return (
      <div className="space-y-6" data-testid="mailbox-management-detail">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToList}
              className="text-blue-600 hover:text-blue-800 font-medium"
              data-testid="back-to-list-button"
            >
              ← Back to Mailboxes
            </button>
            <div className="flex items-center space-x-3">
              <div className="text-3xl">📬</div>
              <h4 className="text-xl font-semibold text-gray-900">
                Mailbox {viewState.selectedMailbox.mailbox_number}
              </h4>
            </div>
          </div>
          <button
            onClick={() => handleDeleteMailbox(viewState.selectedMailbox!)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
            data-testid="delete-mailbox-button"
          >
            🗑️ Delete Mailbox
          </button>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-lg font-semibold text-gray-900">Tenants</h5>
            <button
              onClick={startAddTenant}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
              data-testid="add-tenant-button"
            >
              + Add Tenant
            </button>
          </div>

          {tenants.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-5xl mb-4">👤</div>
              <p className="text-gray-600 mb-4">No tenants in this mailbox</p>
              <button
                onClick={startAddTenant}
                className="text-green-600 hover:text-green-800 font-medium"
              >
                Add the first tenant
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tenants.map((tenant) => {
                // Check if this tenant is the default for the mailbox
                const isDefault = viewState.selectedMailbox?.default_tenant_id === tenant.id;
                
                return (
                  <div
                    key={tenant.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    data-testid={`tenant-card-${tenant.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h6 className="font-semibold text-gray-900">{tenant.name}</h6>
                        {tenant.email && (
                          <p className="text-sm text-gray-600 mt-1">📧 {tenant.email}</p>
                        )}
                        {tenant.phone && (
                          <p className="text-sm text-gray-600 mt-1">📱 {tenant.phone}</p>
                        )}
                        {isDefault && (
                          <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                            Default Tenant
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => startEditTenant(tenant)}
                          className="text-blue-600 hover:text-blue-800 px-3 py-1 text-sm font-medium"
                          data-testid={`edit-tenant-${tenant.id}`}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(tenant)}
                          className="text-red-600 hover:text-red-800 px-3 py-1 text-sm font-medium"
                          data-testid={`delete-tenant-${tenant.id}`}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render add/edit tenant form
  if ((viewState.mode === 'add-tenant' || viewState.mode === 'edit-tenant') && viewState.selectedMailbox) {
    const isEdit = viewState.mode === 'edit-tenant';
    return (
      <div className="space-y-6" data-testid={isEdit ? 'mailbox-management-edit-tenant' : 'mailbox-management-add-tenant'}>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setViewState({ ...viewState, mode: 'view-mailbox', selectedTenant: null })}
            className="text-blue-600 hover:text-blue-800 font-medium"
            data-testid="back-to-mailbox-button"
          >
            ← Back to Mailbox
          </button>
          <h4 className="text-xl font-semibold text-gray-900">
            {isEdit ? 'Edit Tenant' : 'Add New Tenant'}
          </h4>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md">
          <form onSubmit={isEdit ? handleEditTenant : handleAddTenant} className="space-y-4">
            <div>
              <label htmlFor="tenant-name" className="block text-sm font-medium text-gray-700 mb-2">
                Tenant Name *
              </label>
              <input
                id="tenant-name"
                type="text"
                value={tenantForm.name}
                onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                placeholder="e.g., John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                data-testid="tenant-name-input"
              />
            </div>
            <div>
              <label htmlFor="tenant-email" className="block text-sm font-medium text-gray-700 mb-2">
                Email (Optional)
              </label>
              <input
                id="tenant-email"
                type="email"
                value={tenantForm.email}
                onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                placeholder="e.g., john@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="tenant-email-input"
              />
            </div>
            <div>
              <label htmlFor="tenant-phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone (Optional)
              </label>
              <input
                id="tenant-phone"
                type="tel"
                value={tenantForm.phone}
                onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                placeholder="e.g., (555) 123-4567"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="tenant-phone-input"
              />
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400"
                data-testid="submit-tenant-button"
              >
                {loading ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Tenant' : 'Add Tenant')}
              </button>
              <button
                type="button"
                onClick={() => setViewState({ ...viewState, mode: 'view-mailbox', selectedTenant: null })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                data-testid="cancel-tenant-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return null;
};

export default MailboxTenantManagement;
