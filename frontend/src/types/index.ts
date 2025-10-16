// Core data types for E3 Package Manager (Updated Model)

export interface Mailbox {
  id: number;
  mailbox_number: string;
  default_tenant_id?: number;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at?: string;
  
  // Joined fields
  default_tenant_name?: string;
  tenants?: Tenant[];
}

export interface Tenant {
  id: number;
  mailbox_id: number;
  name: string;
  phone?: string;
  email?: string;
  contact_info?: Record<string, unknown>;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at?: string;
  
  // Joined fields
  mailbox_number?: string;
}

export interface Package {
  id: number;
  mailbox_id: number;
  tenant_id?: number; // Nullable - can be reassigned
  tracking_number: string;
  status: PackageStatus;
  high_value: boolean;
  pickup_by?: string;
  carrier?: string;
  size_category: SizeCategory;
  notes?: string;
  received_at: string;
  picked_up_at?: string;
  pickup_date?: string; // Alias for picked_up_at from backend
  created_at: string;
  updated_at?: string;
  
  // Joined fields
  mailbox_number?: string;
  tenant_name?: string;
  tenant_phone?: string;
  tenant_email?: string;
}

export type PackageStatus = 'received' | 'ready_for_pickup' | 'picked_up' | 'returned_to_sender';
export type SizeCategory = 'small' | 'medium' | 'large' | 'oversized';
export type CarrierCode = 'UPS' | 'FedEx' | 'USPS';

export interface Signature {
  id: number;
  package_id: number;
  signature_data?: string;
  blob_url?: string;
  signed_at: string;
  created_at: string;
  
  // Joined fields
  tracking_number?: string;
  mailbox_number?: string;
  tenant_name?: string;
}

export interface SignatureWithDetails extends Signature {
  status: string;
  pickup_date: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  success?: boolean;
}

export interface MailboxesResponse {
  mailboxes: Mailbox[];
  count: number;
  cached_at: string;
}

export interface MailboxSearchResponse {
  mailboxes: Mailbox[];
  query: string;
  count: number;
}

export interface TenantSearchResponse {
  tenants: Array<Pick<Tenant, 'id' | 'mailbox_number' | 'name' | 'phone' | 'email'>>;
  query: string;
  count: number;
}

export interface TenantsResponse {
  tenants: Tenant[];
  count: number;
  mailbox_id?: number;
}

export interface PackagesResponse {
  packages: Package[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface PackageIntakeRequest {
  tracking_number: string;
  mailbox_id: number;
  tenant_id?: number; // Optional - can use default tenant
  high_value?: boolean;
  pickup_by?: string;
  carrier?: string;
  size_category?: SizeCategory;
  notes?: string;
}

export interface PickupRequest {
  package_ids: number[];
  mailbox_id: number;
  tenant_id?: number; // Optional - for tenant context
  pickup_person_name: string;
  signature_data?: string;
  notes?: string;
  staff_initials?: string;
}

export interface PickupResponse {
  success: boolean;
  message: string;
  pickup_summary: {
    packages_picked_up: number;
    mailbox_number: string;
    tenant_name?: string;
    pickup_person: string;
    signature_required: boolean;
    signature_captured: boolean;
    signature_ids?: number[];
    staff_initials?: string;
    pickup_timestamp: string;
    cross_tenant_pickup?: boolean;
  };
  packages: Array<{
    id: number;
    tracking_number: string;
    status: PackageStatus;
    tenant_name?: string;
  }>;
}

// UI State types
export interface KeyboardNavigationState {
  currentFocus: string | null;
  isNavigating: boolean;
  lastKeyPressed: string | null;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface AppState {
  currentPage: string;
  isLoading: boolean;
  error: string | null;
  mailboxes: Mailbox[];
  mailboxesLastFetched: string | null;
  selectedMailbox: Mailbox | null;
  selectedTenant: Tenant | null;
  availableTenants: Tenant[];
  scannerActive: boolean;
  offlineQueue: OfflineQueueItem[];
}

// Barcode scanner types
export interface ScanResult {
  text: string;
  format: string;
  timestamp: number;
}

export interface ScannerConfig {
  preferredCamera: 'environment' | 'user';
  decodeFormats: string[];
  scanDelay: number;
  highlightScanRegion: boolean;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: ValidationError[];
  isSubmitting: boolean;
  isDirty: boolean;
}

// Reports types
export interface PackageStatistics {
  total_packages: number;
  packages_received: number;
  packages_ready: number;
  packages_picked_up: number;
  high_value_packages: number;
  active_mailboxes: number;
  active_tenants: number;
}

export interface CarrierStats {
  carrier: string;
  package_count: number;
  picked_up_count: number;
  pickup_rate: number;
}

export interface DailyTrend {
  date: string;
  packages_received: number;
  packages_picked_up: number;
}

export interface TopMailbox {
  mailbox_number: string;
  default_tenant_name?: string;
  total_packages: number;
  picked_up_packages: number;
  pending_packages: number;
  last_package_date: string;
}

export interface ReportsResponse {
  statistics: {
    overview: PackageStatistics;
    carriers: CarrierStats[];
    daily_trends: DailyTrend[];
    top_mailboxes: TopMailbox[];
  };
  filters: {
    start_date: string | null;
    end_date: string | null;
    mailbox_id: number | null;
  };
  generated_at: string;
}

export interface PickupHistoryItem {
  pickup_event_id: number;
  pickup_person_name: string;
  staff_initials?: string;
  pickup_notes?: string;
  pickup_timestamp: string;
  mailbox_number: string;
  tenant_name?: string;
  tenant_phone?: string;
  package_count: number;
  tracking_numbers: string[];
  carriers: string[];
  high_value_count: number;
  signature_count: number;
}

export interface PickupHistoryResponse {
  pickups: PickupHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters: {
    start_date: string | null;
    end_date: string | null;
    mailbox_id: number | null;
    tenant_id: number | null;
  };
}

export interface AuditLogItem {
  action_type: 'package_intake' | 'pickup' | 'status_change' | 'tenant_update';
  timestamp: string;
  mailbox_number: string;
  tenant_name?: string;
  tracking_number: string;
  carrier?: string;
  details?: string;
  staff_initials?: string;
  description: string;
}

export interface AuditLogResponse {
  audit_log: AuditLogItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters: {
    start_date: string;
    end_date: string;
    action_type: string;
    mailbox_id: number | null;
  };
}

// Performance monitoring
export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: string;
  success: boolean;
}

export interface PickupEvent {
  id: number;
  pickup_person_name: string;
  signature_required: boolean;
  signature_captured: boolean;
  notes: string | null;
  staff_initials: string | null;
  pickup_timestamp: string;
  package_id: number;
  tracking_number: string;
  high_value: boolean;
  mailbox_number: string;
  tenant_name: string;
  has_signature: 0 | 1;
}

export interface PickupFilters {
  tenant_id: number | null;
  days: number;
}

export interface PaginationSummary {
  limit: number;
  offset: number;
}

export interface PackageSearchFilters {
  start_date: string | null;
  end_date: string | null;
  mailbox_id: number | null;
  status: string | null;
}

export interface PackageSearchResponse {
  packages: Package[];
  count: number;
  filters: PackageSearchFilters;
}

export interface SignatureCapturePayload {
  package_id: number;
  signature_data: string;
  captured_at?: string;
}

export interface OfflinePackageIntakePayload {
  tracking_number: string;
  tenant_id: number | null;
  mailbox_id?: number;
  carrier?: CarrierCode;
}

export type OfflineOperation =
  | {
      type: 'package_intake';
      data: OfflinePackageIntakePayload;
      mailboxId: string;
      tenantId?: string;
    }
  | {
      type: 'package_pickup';
      data: PickupRequest;
      mailboxId: string;
      tenantId?: string;
    }
  | {
      type: 'signature_capture';
      data: SignatureCapturePayload;
      mailboxId: string;
      tenantId?: string;
    };

export type OfflineQueueItem = OfflineOperation & {
  id: string;
  timestamp: number;
};