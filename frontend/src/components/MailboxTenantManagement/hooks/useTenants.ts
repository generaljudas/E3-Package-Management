import { useState } from 'react';
import type { Tenant } from '../../../types';
import { tenantApi } from '../../../services/api';

interface TenantFormData {
  name: string;
  email: string;
  phone: string;
}

interface UseTenantsReturn {
  tenants: Tenant[];
  loading: boolean;
  tenantForm: TenantFormData;
  setTenantForm: (form: TenantFormData) => void;
  loadTenants: (mailboxId: number) => Promise<void>;
  createTenant: (mailboxId: number, mailboxNumber: string, data: TenantFormData) => Promise<Tenant | null>;
  updateTenant: (tenantId: number, data: TenantFormData) => Promise<void>;
  deleteTenant: (tenantId: number) => Promise<void>;
  setDefaultTenant: (mailboxId: number, tenantId: number) => Promise<void>;
  resetForm: () => void;
  populateForm: (tenant: Tenant) => void;
}

const initialFormState: TenantFormData = {
  name: '',
  email: '',
  phone: '',
};

export const useTenants = (
  onError?: (error: string) => void,
  onSuccess?: (message: string) => void
): UseTenantsReturn => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantForm, setTenantForm] = useState<TenantFormData>(initialFormState);

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

  const createTenant = async (mailboxId: number, mailboxNumber: string, data: TenantFormData): Promise<Tenant | null> => {
    if (!data.name.trim()) {
      onError?.('Please enter a tenant name');
      return null;
    }

    setLoading(true);
    try {
      const response = await tenantApi.create({
        mailbox_id: mailboxId,
        mailbox_number: mailboxNumber,
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
      });
      onSuccess?.(`Tenant ${data.name} added successfully`);
      return response.tenant;
    } catch (error) {
      console.error('Error adding tenant:', error);
      onError?.('Failed to add tenant');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTenant = async (tenantId: number, data: TenantFormData) => {
    if (!data.name.trim()) {
      onError?.('Please enter a tenant name');
      return;
    }

    setLoading(true);
    try {
      await tenantApi.update(tenantId, {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
      });
      onSuccess?.(`Tenant ${data.name} updated successfully`);
    } catch (error) {
      console.error('Error updating tenant:', error);
      onError?.('Failed to update tenant');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteTenant = async (tenantId: number) => {
    setLoading(true);
    try {
      await tenantApi.deactivate(tenantId);
      onSuccess?.('Tenant deleted successfully');
    } catch (error) {
      console.error('Error deleting tenant:', error);
      onError?.('Failed to delete tenant');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const setDefaultTenant = async (mailboxId: number, tenantId: number) => {
    setLoading(true);
    try {
      await tenantApi.setDefaultTenant(mailboxId, tenantId);
      onSuccess?.('Default tenant set successfully');
    } catch (error) {
      console.error('Error setting default tenant:', error);
      onError?.('Failed to set default tenant');
      throw error; // Re-throw so caller knows it failed
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTenantForm(initialFormState);
  };

  const populateForm = (tenant: Tenant) => {
    setTenantForm({
      name: tenant.name,
      email: tenant.email || '',
      phone: tenant.phone || '',
    });
  };

  return {
    tenants,
    loading,
    tenantForm,
    setTenantForm,
    loadTenants,
    createTenant,
    updateTenant,
    deleteTenant,
    setDefaultTenant,
    resetForm,
    populateForm,
  };
};
