// API service for E3 Package Manager
// Handles all communication with the backend API

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generic API request function with error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    headers: { ...defaultHeaders, ...options.headers },
    ...options,
  };

  const startTime = performance.now();
  
  try {
    const response = await fetch(url, config);
    const duration = performance.now() - startTime;
    
    // Log slow requests (> 300ms)
    if (duration > 300) {
  console.warn(`Slow API request (${Math.round(duration)}ms): ${endpoint}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        errorData.details
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Network or other errors
    throw new ApiError(0, error instanceof Error ? error.message : 'Network error');
  }
}

// Tenant API methods
export const tenantApi = {
  // Get all active tenants (for preloading)
  async getAll() {
    return apiRequest<import('../types').TenantsResponse>('/tenants');
  },

  // Search tenants by mailbox number or name
  async search(query: string) {
    const encodedQuery = encodeURIComponent(query);
    return apiRequest<import('../types').TenantSearchResponse>(`/tenants/search?q=${encodedQuery}`);
  },

  // Get tenant by exact mailbox number
  async getByMailbox(mailboxNumber: string) {
    const encoded = encodeURIComponent(mailboxNumber);
    return apiRequest<{ tenant: import('../types').Tenant }>(`/tenants/mailbox/${encoded}`);
  },

  // Get tenant by ID
  async getById(id: number) {
    return apiRequest<{ tenant: import('../types').Tenant }>(`/tenants/${id}`);
  },

  // Create new tenant
  async create(tenant: Omit<import('../types').Tenant, 'id' | 'active' | 'created_at' | 'updated_at'>) {
    return apiRequest<{ tenant: import('../types').Tenant; message: string }>('/tenants', {
      method: 'POST',
      body: JSON.stringify(tenant),
    });
  },

  // Update tenant
  async update(id: number, updates: Partial<import('../types').Tenant>) {
    return apiRequest<{ tenant: import('../types').Tenant; message: string }>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Deactivate tenant
  async deactivate(id: number) {
    return apiRequest<{ message: string }>(`/tenants/${id}`, {
      method: 'DELETE',
    });
  },
};

// Package API methods
export const packageApi = {
  // Get packages with filtering
  async getAll(params?: {
    tenant_id?: number;
    status?: string;
    tracking_number?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const query = searchParams.toString();
    return apiRequest<import('../types').PackagesResponse>(`/packages${query ? `?${query}` : ''}`);
  },

  // Get packages for specific tenant
  async getByTenant(tenantId: number, status?: string) {
    const statusParam = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiRequest<{ packages: import('../types').Package[]; tenant_id: number; count: number }>
      (`/packages/tenant/${tenantId}${statusParam}`);
  },

  // Get package by tracking number
  async getByTracking(trackingNumber: string) {
    const encoded = encodeURIComponent(trackingNumber);
    return apiRequest<{ package: import('../types').Package }>(`/packages/tracking/${encoded}`);
  },

  // Create new package (intake)
  async create(packageData: import('../types').PackageIntakeRequest) {
    return apiRequest<{ 
      package: import('../types').Package & { tenant_name: string; tenant_mailbox: string }; 
      message: string;
    }>('/packages', {
      method: 'POST',
      body: JSON.stringify(packageData),
    });
  },

  // Update package status
  async updateStatus(id: number, status: import('../types').PackageStatus, notes?: string) {
    return apiRequest<{ package: import('../types').Package; message: string }>(`/packages/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  },

  // Update package details
  async update(id: number, updates: Partial<import('../types').Package>) {
    return apiRequest<{ package: import('../types').Package; message: string }>(`/packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Delete package
  async delete(id: number) {
    return apiRequest<{ message: string }>(`/packages/${id}`, {
      method: 'DELETE',
    });
  },
};

// Pickup API methods
export const pickupApi = {
  // Get pickup events (audit trail)
  async getAll(params?: {
    tenant_id?: number;
    days?: number;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const query = searchParams.toString();
    return apiRequest<{
      pickup_events: import('../types').PickupEvent[];
      filters: any;
      pagination: any;
    }>(`/pickups${query ? `?${query}` : ''}`);
  },

  // Process package pickup
  async processPickup(pickupData: import('../types').PickupRequest) {
    return apiRequest<import('../types').PickupResponse>('/pickups', {
      method: 'POST',
      body: JSON.stringify(pickupData),
    });
  },

  // Get pickup event by ID
  async getById(id: number) {
    return apiRequest<{ pickup_event: import('../types').PickupEvent }>(`/pickups/${id}`);
  },

  // Update multiple packages to ready_for_pickup
  async bulkUpdateStatus(packageIds: number[], status: 'ready_for_pickup' | 'returned_to_sender', notes?: string) {
    return apiRequest<{
      message: string;
      updated_packages: Array<{ id: number; tracking_number: string; status: string }>;
      requested_count: number;
      updated_count: number;
    }>('/pickups/bulk-status', {
      method: 'POST',
      body: JSON.stringify({
        package_ids: packageIds,
        status,
        notes,
      }),
    });
  },
};

// Signature API methods
export const signatureApi = {
  // Get signature by ID
  async getById(id: number) {
    return apiRequest<{ signature: import('../types').Signature }>(`/signatures/${id}`);
  },

  // Get signature by pickup event ID
  async getByPickupEvent(pickupEventId: number) {
    return apiRequest<{ signature: import('../types').Signature }>(`/signatures/pickup-event/${pickupEventId}`);
  },

  // Get signature image URL
  getImageUrl(id: number): string {
    return `${API_BASE_URL}/signatures/image/${id}`;
  },

  // Delete signature
  async delete(id: number) {
    return apiRequest<{ message: string }>(`/signatures/${id}`, {
      method: 'DELETE',
    });
  },
};

// Health check
export const healthApi = {
  async check() {
    return apiRequest<{
      status: string;
      timestamp: string;
      version: string;
    }>('/health', { 
      // Use a shorter timeout for health checks
      signal: AbortSignal.timeout(5000) 
    });
  },
};

// Reports API methods
export const reportsApi = {
  // Get statistics dashboard data
  async getStatistics(params?: {
    start_date?: string;
    end_date?: string;
    mailbox_id?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const query = searchParams.toString();
    return apiRequest<import('../types').ReportsResponse>(`/reports/statistics${query ? `?${query}` : ''}`);
  },

  // Get pickup history
  async getPickupHistory(params?: {
    start_date?: string;
    end_date?: string;
    mailbox_id?: number;
    tenant_id?: number;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const query = searchParams.toString();
    return apiRequest<import('../types').PickupHistoryResponse>(`/reports/pickups${query ? `?${query}` : ''}`);
  },

  // Get audit log
  async getAuditLog(params?: {
    start_date?: string;
    end_date?: string;
    action_type?: 'package_intake' | 'pickup' | 'status_change' | 'tenant_update';
    mailbox_id?: number;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const query = searchParams.toString();
    return apiRequest<import('../types').AuditLogResponse>(`/reports/audit${query ? `?${query}` : ''}`);
  },

  // Get mailbox summary
  async getMailboxSummary(mailboxId: number, days?: number) {
    const query = days ? `?days=${days}` : '';
    return apiRequest<{
      mailbox: import('../types').Mailbox & { 
        default_tenant_name?: string; 
        default_tenant_phone?: string;
        default_tenant_email?: string;
      };
      summary: {
        period_days: number;
        statistics: import('../types').PackageStatistics & { associated_tenants: number };
        recent_packages: Array<import('../types').Package & { tenant_name?: string }>;
      };
      generated_at: string;
    }>(`/reports/mailbox/${mailboxId}/summary${query}`);
  },
};

// Export all APIs
export const api = {
  tenant: tenantApi,
  package: packageApi,
  pickup: pickupApi,
  signature: signatureApi,
  health: healthApi,
  reports: reportsApi,
};

export default api;