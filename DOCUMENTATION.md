# E3 Package Manager - Complete System Documentation

**Version:** 1.1.0-beta  
**Last Updated:** October 16, 2025  
**Platform:** macOS (Apple Silicon)


## Beta Direction Snapshot (October 2025)

The current beta cycle doubles down on reliability and maintainability ahead of performance work. Highlights:

- **Shared mailbox caching:** `useMailboxCache` centralises mailbox hydration, in-memory caching, and cache invalidation so both `MailboxLookup` and management tooling share a single source of truth.
- **Typed offline + API boundaries:** Intake, pickup, and offline hooks now rely on explicit payload types (`OfflinePackageIntakePayload`, `PickupRequest`, `PickupResponse`, etc.), eliminating `any` usage and making queue replay safer.
- **Tenant management cohesion:** `MailboxTenantManagement` and `MailboxLookup` both reuse typed tenant API helpers, keeping default-tenant updates and cache invalidation consistent across views.
- **Performance groundwork:** Debounced search now delegates to the shared cache helper, and the typed service layer unlocks upcoming instrumentation without further refactors.

Near-term beta goals include profiling mailbox search frequency, expanding offline sync telemetry, and layering in lightweight performance diagnostics using the new shared utilities.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [Backend API Reference](#backend-api-reference)
6. [Frontend Structure](#frontend-structure)
7. [Development Setup](#development-setup)
8. [Environment Configuration](#environment-configuration)
9. [Data Flow & Business Logic](#data-flow--business-logic)
10. [Security & Performance](#security--performance)
11. [Testing & Debugging](#testing--debugging)
12. [Deployment Checklist](#deployment-checklist)
13. [Known Issues & Workarounds](#known-issues--workarounds)
14. [Future Enhancement Ideas](#future-enhancement-ideas)

- [Beta Direction Snapshot (October 2025)](#beta-direction-snapshot-october-2025)

---

## System Overview

### Purpose
E3 Package Manager is a comprehensive web application designed for mailbox rental centers to manage package intake, tracking, pickup, and reporting with a mailbox-first architecture.

### Core Features
- **Mailbox-First Workflow**: All operations center around mailbox numbers with tenant associations
- **Package Intake**: **Simplified batch scanning** - tracking number only, maximum speed workflow
- **Package Pickup**: Signature capture for high-value items, bulk pickup processing
- **Reports Dashboard**: Statistics, pickup history, and system audit logs
- **PWA Capabilities**: Offline mode with operation queueing and background sync
- **Multi-Tenant Support**: Multiple tenants per mailbox with default tenant management

### Target Users
- Mailbox rental center staff
- Package receiving operations
- Front desk personnel

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         React Frontend (Vite)                        │  │
│  │  - Components (Intake, Pickup, Reports)              │  │
│  │  - Service Worker (Offline Sync)                     │  │
│  │  - Local Storage (Cache)                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │ HTTP/REST
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend Server (Node.js)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Express.js API Server                        │  │
│  │  - Routes (tenants, packages, pickups, reports)      │  │
│  │  - Validation (express-validator)                    │  │
│  │  - Security (helmet, rate limiting, CORS)            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │ SQL
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (v15.14)                   │
│  - mailboxes, tenants, packages, signatures                │
│  - Indexes for performance optimization                     │
│  - Foreign key constraints for data integrity               │
└─────────────────────────────────────────────────────────────┘
```

### Mailbox-First Data Model

**Philosophy**: Every package must belong to a mailbox. Tenants are associated with mailboxes, not the other way around.

```
Mailbox (Primary Entity)
    ↓
Tenant (Associated with Mailbox)
    ↓
Package (Linked to both Mailbox & Tenant)
    ↓
Pickup Event (Tracks package pickups with signatures)
```

---

## Technology Stack

### Frontend
- **Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.9
- **Language**: TypeScript
- **Styling**: TailwindCSS v4 (via @tailwindcss/postcss) + small custom CSS
- **PWA**: vite-plugin-pwa with Workbox
- **Barcode Scanning**: QuaggaJS
- **Routing**: React Router v7

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Validation**: express-validator
- **Security**: helmet, cors, express-rate-limit
- **Database Client**: pg (node-postgres)
- **Process Manager**: nodemon (development)

### Database
- **System**: PostgreSQL 15.14 (Homebrew)
- **Location**: /opt/homebrew/opt/postgresql@15
- **Database Name**: e3_package_manager
- **User**: e3_user
- **Password**: e3_password (change in production!)

### Development Tools
- **Package Manager**: npm
- **Version Control**: Git
- **IDE**: VS Code (recommended)

---

## Database Schema

### Tables Overview

#### 1. `mailboxes`
Primary entity representing physical mailboxes at the rental center.

```sql
CREATE TABLE mailboxes (
    id SERIAL PRIMARY KEY,
    mailbox_number VARCHAR(50) UNIQUE NOT NULL,
    default_tenant_id INTEGER REFERENCES tenants(id),
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_mailboxes_number ON mailboxes(mailbox_number);
CREATE INDEX idx_mailboxes_active ON mailboxes(active);
```

**Key Points:**
- `mailbox_number` is unique and used for lookup (e.g., "101", "145")
- `default_tenant_id` points to the primary tenant for quick selection
- Soft deletion via `active` flag

#### 2. `tenants`
Individuals or businesses renting mailboxes.

```sql
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    mailbox_number VARCHAR(50), -- Nullable, added for backward compatibility
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_tenants_mailbox_id ON tenants(mailbox_id);
CREATE INDEX idx_tenants_name ON tenants(name);
CREATE INDEX idx_tenants_active ON tenants(active);
```

**Key Points:**
- Multiple tenants can share a mailbox (family members, business partners)
- `mailbox_id` is the foreign key linking to mailboxes
- `mailbox_number` column was added for API compatibility (nullable)

#### 3. `packages`
Package inventory tracking from intake to pickup.

```sql
CREATE TABLE packages (
    id SERIAL PRIMARY KEY,
    mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id),
    tenant_id INTEGER REFERENCES tenants(id),
    tracking_number VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'received' CHECK (status IN ('received', 'ready_for_pickup', 'picked_up', 'returned_to_sender')),
    high_value BOOLEAN DEFAULT FALSE,
    pickup_by VARCHAR(255),
    carrier VARCHAR(100),
    size_category VARCHAR(50) CHECK (size_category IN ('small', 'medium', 'large', 'oversized')),
    notes TEXT,
    received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    picked_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    recipient_name VARCHAR(255),        -- Nullable, added post-deployment
    recipient_phone VARCHAR(50),        -- Nullable, added post-deployment
    received_by VARCHAR(255),           -- Nullable, staff who received package
    pickup_date TIMESTAMPTZ,            -- Nullable, when pickup occurred
    pickup_signature TEXT               -- Nullable, signature data (base64)
);

-- Indexes
CREATE INDEX idx_packages_mailbox_id ON packages(mailbox_id);
CREATE INDEX idx_packages_tenant_id ON packages(tenant_id);
CREATE INDEX idx_packages_tracking_number ON packages(tracking_number);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_received_at ON packages(received_at DESC);
```

**Key Points:**
- `mailbox_id` is **required** (NOT NULL) - enforces mailbox-first model
- `tenant_id` provided at intake is used by the API to infer `mailbox_id` automatically
- `tracking_number` is unique across entire system
- Status workflow: received → ready_for_pickup → picked_up (supports returned_to_sender)
- Optional columns (carrier, size_category, notes, etc.) remain nullable to support simplified intake

#### 4. `signatures`
Digital signatures captured during package pickup.

```sql
CREATE TABLE signatures (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES packages(id),
    pickup_event_id INTEGER REFERENCES pickup_events(id),
    signature_data TEXT,
    blob_url VARCHAR(500),
    signed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_signatures_package_id ON signatures(package_id);
CREATE INDEX idx_signatures_pickup_event_id ON signatures(pickup_event_id);
```

**Key Points:**
- Stores signature as base64 encoded data or blob URL
- Can be linked to individual package or bulk pickup event

#### 5. `pickup_events` (Optional/legacy – may not exist)
Tracks per-package pickup events for audit trail. The backend supports a graceful fallback when this table is absent by updating `packages` directly and recording signatures on each package.

```sql
-- Note: This table is referenced in code but may need to be created
CREATE TABLE pickup_events (
    id SERIAL PRIMARY KEY,
    mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id),
    tenant_id INTEGER REFERENCES tenants(id),
    pickup_person_name VARCHAR(255) NOT NULL,
    staff_initials VARCHAR(10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_pickup_events_mailbox_id ON pickup_events(mailbox_id);
CREATE INDEX idx_pickup_events_created_at ON pickup_events(created_at DESC);
```

### Database Relationships

```
mailboxes (1) ←→ (many) tenants
    │
    └→ default_tenant_id → tenants.id

mailboxes (1) ←→ (many) packages
tenants (1) ←→ (many) packages

packages (1) ←→ (many) signatures
pickup_events (1) ←→ (many) signatures
```

### Performance Targets
- **Mailbox lookup**: <100ms (indexed on mailbox_number)
- **Package list query**: <300ms for 1,000 packages
- **Package intake**: <200ms scan-to-save
- **Pickup processing**: <500ms including signature

---

## Backend API Reference

### Base URL
```
http://localhost:3001/api
```

### Authentication
Currently no authentication (add JWT/session in production).

### Common Response Format
```json
{
  "data": { ... },
  "error": "error message if failed",
  "message": "success message"
}
```

### API Endpoints

#### Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-06T12:00:00Z",
  "version": "1.0.0"
}
```

---

#### Tenants

##### Get All Tenants
```http
GET /api/tenants
```
**Response:**
```json
{
  "tenants": [...],
  "count": 10
}
```

##### Search Tenants
```http
GET /api/tenants/search?q={query}
```
**Query Params:**
- `q`: Search string (mailbox number or name)

##### Get Tenants by Mailbox
```http
GET /api/tenants/mailbox/{mailboxNumber}
```
**Response:**
```json
{
  "mailbox": {
    "id": 1,
    "mailbox_number": "101",
    "default_tenant_id": 1
  },
  "tenants": [...]
}
```

##### Update Default Tenant
```http
PATCH /api/tenants/mailboxes/{mailboxId}/default-tenant
```
**Body:**
```json
{
   "default_tenant_id": 2
}
```

Alternate (by mailbox number):
```http
PATCH /api/tenants/mailboxes/by-number/{mailboxNumber}/default-tenant
```
Use this when only the mailbox number is available. In development, this endpoint will create the mailbox (if missing) and, if the tenant ID doesn’t exist, can also create the tenant when you include an optional `tenant_name`.

Optional body for dev convenience:
```json
{
   "default_tenant_id": 2,
   "tenant_name": "Alice Cooper"
}
```

---

#### Packages

##### Create Package (Intake)
```http
POST /api/packages
```
**Body (Simplified - Only 2 Required Fields):**
```json
{
  "tracking_number": "1Z999AA1234567890",
  "tenant_id": 1
}
```
**Important:** 
- The API automatically retrieves `mailbox_id` from the tenant record
- All other fields (carrier, size_category, high_value, notes) are optional and can be set to defaults
- **Philosophy**: Fast intake now, add details later if needed

**Response:**
```json
{
  "package": {
    "id": 1,
    "tracking_number": "1Z999AA1234567890",
    "mailbox_id": 1,
    "tenant_id": 1,
    "status": "received",
    "tenant_name": "John Smith",
    "tenant_mailbox": "101"
  },
  "message": "Package registered successfully"
}
```

##### Get Package by Tracking Number
```http
GET /api/packages/tracking/{trackingNumber}
```

##### Get Packages by Mailbox
```http
GET /api/packages/mailbox/{mailboxId}?status={status}&limit={limit}
```
**Query Params:**
- `status`: Filter by status (optional)
- `limit`: Max results (default: 100)

##### Update Package Status
```http
PUT /api/packages/{id}/status
```
**Body:**
```json
{
  "status": "picked_up",
  "notes": "Picked up by John Smith"
}
```

---

#### Pickups

##### Create Pickup
```http
POST /api/pickups
```
**Body:**
```json
{
  "package_ids": [1, 2, 3],
  "tenant_id": 1,
  "pickup_person_name": "John Smith",
  "signature_data": "data:image/png;base64,...",
  "staff_initials": "JS",
  "notes": "ID verified"
}
```

**Response (Online):**
```json
{
   "success": true,
   "message": "Package pickup processed successfully",
   "pickup_summary": {
      "packages_picked_up": 3,
      "tenant_name": "John Smith",
      "tenant_mailbox": "101",
      "pickup_person": "John Smith",
      "signature_required": true,
      "signature_captured": true,
      "signature_id": 42,
      "staff_initials": "JS",
      "pickup_timestamp": "2025-10-09T17:00:00.000Z"
   },
   "packages": [
      { "id": 10, "tracking_number": "1Z...", "status": "picked_up" },
      { "id": 11, "tracking_number": "9400...", "status": "picked_up" },
      { "id": 12, "tracking_number": "FDX...", "status": "picked_up" }
   ]
}
```

Notes:
- If the optional `pickup_events` table is present, one event is recorded per package and a single `signature_id` may be returned when a signature is captured.
- If `pickup_events` does not exist, the server skips event creation, updates `packages` directly, and stores signatures linked to each package; in that mode the response includes `signature_ids: number[]` instead of a single `signature_id`.

**Offline-queued (client payload stored locally):**
```json
{
   "offline": true,
   "package_ids": [1, 2, 3],
   "tenant_id": 1,
   "pickup_person_name": "John Smith"
}
```

---

#### Reports

##### Get Statistics
```http
GET /api/reports/statistics?start_date={date}&end_date={date}&mailbox_id={id}
```
**Response:**
```json
{
  "statistics": {
    "overview": {
      "total_packages": 100,
      "packages_received": 50,
      "packages_ready": 30,
      "packages_picked_up": 20,
      "high_value_packages": 5
    },
    "carriers": [...],
    "daily_trends": [...],
    "top_mailboxes": [...]
  }
}
```

##### Get Pickup History
```http
GET /api/reports/pickups?start_date={date}&end_date={date}&mailbox_id={id}&limit={num}&offset={num}
```

##### Get Audit Log
```http
GET /api/reports/audit?start_date={date}&end_date={date}&action_type={type}&limit={num}
```
**Action Types:** `package_intake`, `pickup`, `status_change`, `tenant_update`

---

## Frontend Structure

### Directory Layout
```
frontend/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   └── icons/                 # PWA icons
├── src/
│   ├── components/
│   │   ├── MailboxLookup.tsx      # Mailbox search & tenant selection
│   │   ├── PackageIntake.tsx      # Package registration interface
│   │   ├── PackagePickup.tsx      # Pickup processing with signatures
│   │   ├── Reports.tsx            # Reports dashboard
│   │   ├── BarcodeScanner.tsx     # QuaggaJS wrapper
│   │   ├── SignaturePad.tsx       # Canvas-based signature capture
│   │   └── OfflineStatusBar.tsx   # Online/offline indicator
│   │   └── TestIdOverlay.tsx      # Dev-only overlay to visualize data-testids
│   ├── hooks/
│   │   ├── useOffline.ts          # Offline state management
│   │   ├── useMailboxCache.ts     # Shared mailbox cache + search helpers
│   │   └── useFocus.ts            # Keyboard navigation
│   ├── services/
│   │   ├── api.ts                 # API client with error handling
│   │   └── offlineService.ts      # Offline queue management
│   ├── types/
│   │   └── index.ts               # TypeScript type definitions
│   ├── App.tsx                    # Main application component
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles
└── package.json
```

### Key Components

#### MailboxLookup.tsx
**Purpose:** Search and select mailboxes with tenant management

**Features:**
- Instant search with debounce
- Display default tenant
- Switch between multiple tenants
- Set/update default tenant on-the-fly
- Keyboard navigation (Tab to next field)

**State Management:**
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<Mailbox[]>([]);
const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
```

#### PackageIntake.tsx
**Purpose:** Register new packages with barcode scanning - **simplified intake workflow**

**Features:**
- QuaggaJS barcode scanner integration
- **Batch scanning mode**: Scan multiple packages, then submit all at once
- Only 3 required fields: tracking_number, mailbox_id (from context), tenant_id (from context)
- Keyboard-centric navigation (Tab → Enter workflow)
- Offline queue support
- Duplicate detection
- **No carrier detection, size selection, high-value flags, or notes during intake**
- Focus on maximum intake speed: scan → add to batch → scan next → submit batch

#### PackagePickup.tsx
**Purpose:** Process package pickups with signature capture

**Features:**
- Filter packages by status
- Bulk package selection
- Canvas-based signature capture
- Offline operation support
- Pickup verification

**Workflow:**
1. Search/filter packages
2. Select packages to pick up
3. Enter pickup person name
4. Capture signature (if high-value)
5. Confirm pickup
6. Update package statuses

#### Reports.tsx
**Purpose:** Display statistics, history, and audit logs

**Features:**
- Three-tab interface (Statistics, Pickups, Audit)
- Date range filtering
- Mailbox-specific reports
- Pagination for large datasets
- Visual charts and graphs

---

## Development Setup

### Prerequisites
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install PostgreSQL 15
brew install postgresql@15
```

### Database Setup

#### 1. Start PostgreSQL
```bash
brew services start postgresql@15
```

#### 2. Add PostgreSQL to PATH
```bash
# Add to ~/.zshrc
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Reload shell
source ~/.zshrc
```

#### 3. Create Database and User
```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE e3_package_manager;

# Create user
CREATE USER e3_user WITH PASSWORD 'e3_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE e3_package_manager TO e3_user;
ALTER DATABASE e3_package_manager OWNER TO e3_user;

# Exit
\q
```

#### 4. Run Schema
```bash
cd "/Users/macboundgeneral/E3 Package Manager/backend"
psql -d e3_package_manager -U e3_user -h localhost -f database_schema.sql
```

#### 5. Add Missing Columns (Post-Deployment Fix)
```bash
psql -d e3_package_manager -U e3_user -h localhost -c "
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mailbox_number VARCHAR;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS recipient_name VARCHAR;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS received_by VARCHAR;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS pickup_date TIMESTAMPTZ;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS pickup_signature TEXT;
"
```

### Backend Setup

#### 1. Install Dependencies
```bash
cd "/Users/macboundgeneral/E3 Package Manager/backend"
npm install
```

#### 2. Create .env File
```bash
cat > .env << EOF
# E3 Package Manager Backend Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=e3_package_manager
DB_USER=e3_user
DB_PASSWORD=e3_password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000

# Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
ENABLE_PERFORMANCE_LOGGING=true
SLOW_QUERY_THRESHOLD_MS=100
EOF
```

#### 3. Start Backend
```bash
npm run dev
```

Expected output:
```
🚀 E3 Package Manager API running on port 3001
📊 Health check: http://localhost:3001/health
🌍 Environment: development
✅ Database connected successfully
```

### Frontend Setup

#### 1. Install Dependencies
```bash
cd "/Users/macboundgeneral/E3 Package Manager/frontend"
npm install
```

#### 2. Start Frontend
```bash
npm run dev
```

Expected output:
```
VITE v7.1.9  ready in 77 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Verify Setup

#### 1. Check Database Connection
```bash
psql -d e3_package_manager -U e3_user -h localhost -c "SELECT COUNT(*) FROM mailboxes;"
```
Should return 10 (sample mailboxes).

#### 2. Test Backend API
```bash
curl http://localhost:3001/health
```
Should return:
```json
{"status":"healthy","timestamp":"...","version":"1.0.0"}
```

#### 3. Open Frontend
```
http://localhost:5173
```
Should display the E3 Package Manager interface.

---

## Environment Configuration

### Backend Environment Variables

```bash
# Server Configuration
PORT=3001                          # API server port
NODE_ENV=development               # Environment: development|production
FRONTEND_URL=http://localhost:5173 # CORS allowed origin

# Database Configuration
DB_HOST=localhost                  # PostgreSQL host
DB_PORT=5432                       # PostgreSQL port
DB_NAME=e3_package_manager        # Database name
DB_USER=e3_user                   # Database user
DB_PASSWORD=e3_password           # Database password (CHANGE IN PRODUCTION!)

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000       # 15 minutes in ms
RATE_LIMIT_MAX=1000               # Max requests per window

# Logging
LOG_LEVEL=info                    # Log level: debug|info|warn|error
ENABLE_REQUEST_LOGGING=true       # Log all HTTP requests
ENABLE_PERFORMANCE_LOGGING=true   # Log slow queries
SLOW_QUERY_THRESHOLD_MS=100       # Threshold for slow query logging
```

### Frontend Environment Variables

Create `frontend/.env`:
```bash
VITE_API_URL=http://localhost:3001/api  # Backend API base URL
```

---

## Data Flow & Business Logic

### Package Intake Workflow (Simplified)

```
1. User searches for mailbox (e.g., "106")
   ↓
2. System retrieves mailbox with default tenant
   ↓
3. User confirms or switches tenant (if needed)
   ↓
4. User scans barcode or enters tracking number
   ↓
5. Tracking number added to batch list
   ↓
6. User scans next package (repeat step 4-5) OR clicks "Register Batch"
   ↓
7. Frontend sends batch POST requests to /api/packages with tracking_number + tenant_id only
   ↓
8. Backend retrieves mailbox_id from tenant record
   ↓
9. Backend inserts package with mailbox_id + tenant_id + tracking_number
   ↓
10. Backend sets defaults: status='received', carrier=null, size_category='medium', high_value=false
    ↓
11. Success notification shows count of packages registered
    ↓
12. Batch list clears, ready for next batch
```

**Key Changes:**
- **Batch mode**: Scan multiple packages before submitting
- **Only 2 fields required (API)**: tracking_number (scanned) and tenant_id (from context). The server infers mailbox_id via tenant.
- **No carrier detection or size selection** during intake - focus on speed
- Details can be added later via package editing if needed

#### Keyboard Shortcuts (Staff Productivity)
- Alt+P: Focus Package Intake input
- Alt+M: Focus Mailbox Lookup
- Enter: Next field in sequence
- Ctrl+Enter or Cmd+Enter: Submit package (single) or batch

### Package Pickup Workflow

```
1. User navigates to Package Pickup tab
   ↓
2. System loads packages for selected mailbox
   ↓
3. Filter shows only 'received' and 'ready_for_pickup' packages
   ↓
4. User selects packages via checkboxes
   ↓
5. User clicks "Proceed to Pickup"
   ↓
6. Modal prompts for pickup person name
   ↓
7. If high-value packages: signature capture required
   ↓
8. User draws signature on canvas
   ↓
9. System converts signature to base64
   ↓
10. Frontend sends POST /api/pickups
    ↓
11. Backend attempts to create `pickup_event` records (if table exists); otherwise this step is skipped
   ↓
12. Backend updates all package statuses to 'picked_up'
   ↓
13. Backend stores signature(s) linked to either the pickup event (when present) or directly to each package
    ↓
14. Success notification shows package count
```

### Offline Mode Operation

```
1. Service worker detects offline state
   ↓
2. UI shows offline indicator banner
   ↓
3. User performs operations (intake, pickup)
   ↓
4. Operations queued in localStorage
   ↓
5. Connection restored
   ↓
6. Service worker triggers sync event
   ↓
7. Queue processor sends operations to backend
   ↓
8. Successful operations removed from queue
   ↓
9. Failed operations remain for retry
   ↓
10. UI updated with sync status
```

---

## Security & Performance

### Security Measures Implemented

#### 1. Input Validation
- **express-validator**: All API inputs validated
- **SQL Injection**: Parameterized queries only
- **XSS Protection**: helmet middleware with CSP

#### 2. Rate Limiting
```javascript
// 1000 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});
```

#### 3. CORS Configuration
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
```

#### 4. Database Security
- Dedicated database user (e3_user)
- Limited privileges (no superuser)
- Connection via localhost only

### Performance Optimizations

#### Database Indexes
```sql
-- Mailbox lookup optimization
CREATE INDEX idx_mailboxes_number ON mailboxes(mailbox_number);

-- Package queries optimization
CREATE INDEX idx_packages_mailbox_id ON packages(mailbox_id);
CREATE INDEX idx_packages_tenant_id ON packages(tenant_id);
CREATE INDEX idx_packages_tracking_number ON packages(tracking_number);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_received_at ON packages(received_at DESC);

-- Tenant lookup optimization
CREATE INDEX idx_tenants_mailbox_id ON tenants(mailbox_id);
CREATE INDEX idx_tenants_name ON tenants(name);
```

#### Frontend Optimizations
- React.memo for expensive components
- Debounced search inputs (300ms)
- Lazy loading for routes
- Service worker caching
- Vite code splitting

#### Backend Optimizations
- Connection pooling (pg)
- Query result limiting
- Efficient JOIN queries
- Request logging only in development

---

## Testing & Debugging

### Manual Testing Checklist

#### Package Intake (Simplified Flow)
- [ ] Search for mailbox "101" - shows John Smith
- [ ] Search for mailbox "106" - shows Alice Cooper
- [ ] Switch tenant using radio buttons
- [ ] Set new default tenant
- [ ] Scan barcode (or manually enter tracking)
- [ ] Tracking number appears in batch list
- [ ] Scan multiple tracking numbers (batch mode)
- [ ] Remove tracking from batch if needed
- [ ] Click "Register Batch" button
- [ ] Success message shows count of packages registered
- [ ] Packages appear in pickup list with status 'received'
- [ ] NO carrier detection, size selection, or other fields during intake

#### Package Pickup
- [ ] View packages for selected mailbox
- [ ] Filter by status works
- [ ] Select multiple packages
- [ ] Capture signature for high-value items
- [ ] Confirm pickup
- [ ] Packages marked as picked_up
- [ ] Signature stored correctly

#### Reports
- [ ] Statistics show correct counts
- [ ] Carrier distribution chart accurate
- [ ] Date range filtering works
- [ ] Pickup history pagination works
- [ ] Audit log shows all activities
- [ ] Action type filter works

### Backend Logs

#### Enable Debug Logging
```bash
# In backend/.env
LOG_LEVEL=debug
ENABLE_PERFORMANCE_LOGGING=true
```

#### View Real-Time Logs
```bash
cd backend
npm run dev
# Logs appear in terminal
```

#### Check for Errors
```bash
# Search for database errors
grep "Database query error" backend.log

# Search for 500 errors
grep "Error" backend.log
```

### Database Debugging

#### Check Package Counts
```sql
SELECT 
  status, 
  COUNT(*) as count 
FROM packages 
GROUP BY status;
```

#### Find Missing Mailbox IDs
```sql
SELECT 
  p.id, 
  p.tracking_number 
FROM packages p 
WHERE p.mailbox_id IS NULL;
```

#### Verify Tenant-Mailbox Relationships
```sql
SELECT 
  t.id,
  t.name,
  t.mailbox_id,
  m.mailbox_number
FROM tenants t
LEFT JOIN mailboxes m ON t.mailbox_id = m.id
WHERE m.id IS NULL;  -- Should return 0 rows
```

#### Check for Orphaned Packages
```sql
SELECT 
  p.id,
  p.tracking_number,
  p.mailbox_id,
  p.tenant_id
FROM packages p
LEFT JOIN mailboxes m ON p.mailbox_id = m.id
WHERE m.id IS NULL;  -- Should return 0 rows
```

### Common Issues & Solutions

#### Issue: "Package registered: undefined"
**Cause:** API response structure mismatch in toast notification  
**Solution:** App.tsx now checks for `packageData.package?.tracking_number`

#### Issue: Frontend production build fails (TypeScript)
**Cause:** Type definitions drift in `TenantLookup.tsx` and `services/api.ts` (e.g., NodeJS.Timeout typing, missing exported types such as `TenantSearchResponse`, `PickupEvent`)  
**Status:** Development server works; production build currently fails  
**Workaround:** Develop using `npm run dev`. Fix typings before running `npm run build` for production.

#### Issue: Error 500 on package creation
**Cause:** Missing `mailbox_id` in INSERT statement  
**Solution:** Backend now retrieves mailbox_id from tenant before insert

#### Issue: Columns don't exist errors
**Cause:** Database schema out of sync with code  
**Solution:** Run ALTER TABLE commands to add missing nullable columns

#### Issue: Cannot connect to database
**Cause:** PostgreSQL not running or wrong credentials  
**Solution:**
```bash
# Check PostgreSQL status
brew services list | grep postgresql

# Restart if needed
brew services restart postgresql@15

# Test connection
psql -d e3_package_manager -U e3_user -h localhost -c "SELECT 1;"
```

---

## Deployment Checklist

### Pre-Production Steps

#### 1. Security Hardening
- [ ] Change database password from default
- [ ] Set strong DB_PASSWORD in .env
- [ ] Enable HTTPS (TLS/SSL certificates)
- [ ] Set NODE_ENV=production
- [ ] Configure firewall rules
- [ ] Set up authentication (JWT/sessions)
- [ ] Enable audit logging

#### 2. Database Migration
- [ ] Backup existing data
- [ ] Run database migrations
- [ ] Verify all indexes created
- [ ] Test database performance under load
- [ ] Set up automated backups

#### 3. Frontend Build
```bash
cd frontend
npm run build
# Generates optimized production build in dist/
```

#### 4. Backend Configuration
```bash
# Update backend/.env for production
NODE_ENV=production
PORT=3001
DB_HOST=your-db-host
DB_PASSWORD=strong-password-here
FRONTEND_URL=https://your-domain.com
```

#### 5. Process Management
```bash
# Install PM2 for production
npm install -g pm2

# Start backend with PM2
cd backend
pm2 start src/index.js --name e3-backend

# Auto-restart on system reboot
pm2 startup
pm2 save
```

#### 6. Reverse Proxy (Nginx Example)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Post-Deployment Verification

- [ ] Health check endpoint responds
- [ ] Database connections work
- [ ] Package intake workflow completes
- [ ] Package pickup workflow completes
- [ ] Reports generate correctly
- [ ] Offline mode functions
- [ ] Service worker updates properly

---

## Known Issues & Workarounds

### 1. TailwindCSS v4 configuration
**Issue:** Tailwind v4 requires the @tailwindcss/postcss plugin and updated config shape  
**Status:** TailwindCSS v4 is installed and active; PostCSS is configured  
**Workaround:** Ensure `@tailwindcss/postcss` is in devDependencies and referenced in `postcss.config.js`.

### 2. QuaggaJS Camera Permissions
**Issue:** Camera access requires HTTPS in production  
**Status:** Works on localhost, requires SSL certificate in production  
**Workaround:** Use manual tracking number entry as fallback

### 3. Nullable Columns Added Post-Deployment
**Issue:** Initial schema missing recipient_name, recipient_phone, etc.  
**Status:** Fixed via ALTER TABLE commands  
**Note:** These columns remain nullable for backward compatibility

### 4. PostgreSQL psql Commands Hanging
**Issue:** Long-running psql queries sometimes hang in terminal  
**Status:** Intermittent, possibly terminal-specific  
**Workaround:** Use Ctrl+C to cancel, retry command

### 5. Tenant mailbox_number Column Redundancy
**Issue:** Tenants have both mailbox_id and mailbox_number  
**Status:** mailbox_number added for API compatibility  
**Note:** mailbox_id is the source of truth; mailbox_number is for display

### 6. Frontend TypeScript build failures
**Issue:** `npm run build` in `frontend/` currently fails due to TypeScript errors (unrelated to runtime)  
**Status:** Known; fixes planned for `TenantLookup.tsx` and `services/api.ts` typings  
**Workaround:** Use the Vite dev server (`npm run dev`) for daily usage until typings are corrected.

---

## Future Enhancement Ideas

### High Priority
1. **User Authentication**
   - Staff login system
   - Role-based access control (admin, staff, viewer)
   - Audit trail with user attribution

2. **Email Notifications**
   - Package arrival notifications to tenants
   - Reminder emails for unclaimed packages
   - Daily summary reports for staff

3. **SMS Integration**
   - Text notifications for package arrivals
   - Pickup confirmation codes
   - Two-way SMS for tenant communication

4. **Photo Capture**
   - Package photos during intake
   - Condition documentation
   - Storage in S3 or similar

### Medium Priority
5. **Advanced Reporting**
   - Export reports to PDF/Excel
   - Custom date range analytics
   - Tenant activity reports
   - Revenue tracking (if applicable)

6. **Barcode Printing**
   - Generate internal tracking labels
   - Print recipient labels
   - Integration with label printers

7. **Package Holds**
   - Vacation hold feature
   - Forwarding address management
   - Hold expiration reminders

8. **Multi-Location Support**
   - Multiple rental center locations
   - Location-based user access
   - Cross-location package transfers

### Low Priority
9. **Mobile App**
   - Native iOS/Android apps
   - Push notifications
   - Improved camera scanning

10. **Integration APIs**
    - Carrier tracking API integration (UPS, FedEx, USPS)
    - Real-time tracking updates
    - Automated status synchronization

11. **Customer Portal**
    - Tenant self-service portal
    - Package tracking by tenant
    - Email preferences management

---

## Appendix

### Sample Data

#### Mailboxes
```sql
-- 10 sample mailboxes from 101-110
INSERT INTO mailboxes (mailbox_number, default_tenant_id) VALUES
('101', 1), ('102', 2), ('103', 3), ('104', 4), ('105', 5),
('106', 6), ('107', 7), ('108', 8), ('109', 9), ('110', 10);
```

#### Tenants
```sql
-- Sample tenants linked to mailboxes
('John Smith', '555-0101', 'john@example.com', 1),
('Sarah Johnson', '555-0102', 'sarah@example.com', 2),
('Michael Brown', '555-0103', 'michael@example.com', 3),
-- ... (10 total)
```

#### Packages
```sql
-- Sample packages with various carriers and statuses
('1Z999AA1234567890', 1, 1, 'UPS', 'received'),
('9400111899562512345678', 2, 2, 'USPS', 'ready_for_pickup'),
('FDX123456789012', 3, 3, 'FedEx', 'received'),
-- ... (8 total)
```

### Useful Commands

#### PostgreSQL
```bash
# Connect to database
psql -d e3_package_manager -U e3_user -h localhost

# List tables
\dt

# Describe table
\d packages

# Export data
pg_dump -U e3_user -h localhost e3_package_manager > backup.sql

# Import data
psql -U e3_user -h localhost e3_package_manager < backup.sql

# View table size
SELECT pg_size_pretty(pg_total_relation_size('packages'));
```

#### npm Scripts
```bash
# Backend
npm run dev          # Start development server with nodemon
npm start            # Start production server

# Frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

#### Process Management
```bash
# Kill backend
lsof -ti:3001 | xargs kill -9

# Kill frontend
lsof -ti:5173 | xargs kill -9

# View running processes
ps aux | grep node
```

---

## Version History

### v1.0.1 (October 10, 2025)
- Pickup processing aligned with current schema; supports optional `pickup_events` with graceful fallback
- Success toast after confirming pickup
- Reports: fixed daily trends parameter binding and top mailboxes grouping
- UI: compact selection bar cleanup above action buttons
- Testing & DX: Added dev-only Test ID overlay and expanded data-testid coverage across Intake, Tools, OfflineStatusBar, and Reports
- Documentation: Updated UI Element Identification Guide and clarified pickup workflow

### v1.0.0 (October 6, 2025)
- Initial production release
- Mailbox-first architecture implemented
- Package intake with barcode scanning
- Package pickup with signature capture
- Reports dashboard with statistics
- PWA capabilities with offline mode
- PostgreSQL database integration
- Full CRUD operations for packages

### Database Schema Patches
- **Patch 1** (Oct 6, 2025): Added nullable columns
  - tenants.mailbox_number
  - packages.recipient_name
  - packages.recipient_phone
  - packages.received_by
  - packages.pickup_date
  - packages.pickup_signature

### Bug Fixes
- **Fix 1**: Package creation now retrieves mailbox_id from tenant
- **Fix 2**: Toast notification shows correct tracking number
- **Fix 3**: Resolved TailwindCSS v4 configuration conflicts

---

## Support & Contribution

### Getting Help
1. Check this documentation first
2. Review backend logs for error details
3. Test database queries manually
4. Verify environment variables are set correctly

### Code Style Guidelines
- **TypeScript**: Use explicit types, avoid `any`
- **React**: Functional components with hooks
- **SQL**: Parameterized queries only, no string concatenation
- **Comments**: Document complex logic and business rules
- **Naming**: camelCase for JS/TS, snake_case for SQL

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add feature description"

# Push to remote
git push origin feature/your-feature-name
```

---

## UI Element Identification Guide

This app uses stable data-testid attributes and accessible names to identify UI elements unambiguously across the UI and in tests. Use these steps and IDs to avoid misunderstandings.

### Preferred identification methods
- data-testid: zero-ambiguity selectors for collaboration and tests
  - Example (CSS): [data-testid="pickup-proceed"]
  - Example (Testing Library): screen.getByTestId('pickup-proceed')
- Accessible name + role: aligns with a11y and user-visible labels
  - Example (Testing Library): screen.getByRole('button', { name: /confirm signature/i })

### Safari Web Inspector: how to find an element’s identifier
1. Enable Develop menu if hidden: Safari → Settings → Advanced → Show features for web developers (or Show Develop menu)
2. Right–click the element → Inspect Element
3. In Elements panel, inspect attributes on the node:
   - data-testid="…" (our canonical selector)
   - aria-label / aria-labelledby (accessible naming)
4. Optional Console helpers (with the node selected):
   - $0.getAttribute('data-testid')
   - $0.getAttribute('aria-label')
   - $0.textContent?.trim()

### Key data-testids (Catalog)

MailboxLookup (selection bar)
- mailbox-lookup-root — component root
- mailbox-lookup-input — the mailbox/tenant search input
- mailbox-lookup-dropdown — dropdown container
- mailbox-lookup-option-<mailboxId> — each dropdown option

PackagePickup (pickup workflow)
- pickup-root — component root
- pickup-offline-warning — offline message (when offline)
- pickup-step-list — list step container
- pickup-status-filter — filter button group
- pickup-filter-all | pickup-filter-available | pickup-filter-picked_up — status filters
- pickup-search-input — search input
- pickup-table-container — table wrapper
- pickup-table — table element
- pickup-col-tracking | pickup-col-status | pickup-col-carrier | pickup-col-size | pickup-col-received | pickup-col-pickup-date — column headers
- pickup-no-packages — empty-state message
- pickup-row-<packageId> — table row for a package
- pickup-select-<packageId> — row checkbox
- pickup-selection-summary — selected packages summary
- pickup-proceed — proceed to pickup button
- pickup-step-verify — verify step container
- pickup-person-input — pickup person name input
- pickup-verify-list — verify list of packages
- pickup-continue-signature — continue to signature button
- pickup-back-to-list — back to list button
- pickup-step-signature — signature step container
- pickup-signature-pad — signature canvas container
- pickup-confirm-signature — confirm signature button
- pickup-back-to-verify — back to verify button
- pickup-verification — final confirmation/signature verification container

PackageIntake (intake workflow)
- intake-root — component root
- intake-offline-warning — offline message (when offline)
- intake-scanner-section — barcode scanner wrapper
- intake-scanner-toggle — toggle for scanner on/off
- intake-tracking-input — tracking number input
- intake-add-to-batch — add current tracking to batch button
- intake-batch-list — list of batched tracking numbers
- intake-batch-item-<tracking> — individual batch list item
- intake-clear-form — clear/reset form button
- intake-submit — submit/register batch button

Tools
- tools-root — component root
- tools-header — header container
- tools-tabs — tabs container
- tools-tab-<id> — tab button elements
- tools-content — active tab content wrapper

OfflineStatusBar
- offline-status-root — component root
- offline-status-banner — offline banner when disconnected
- offline-queued-count — count of queued operations
- offline-syncing-banner — syncing status banner
- offline-notifications — notification list wrapper
- offline-notification-<id> — individual notification item

Reports
- reports-root — component root
- reports-header — header container
- reports-date-range — date range wrapper
- reports-date-from — start date input
- reports-date-to — end date input
- reports-tabs — tabs container
- reports-tablist — tablist role container
- reports-tab-<id> — tab button
- reports-content — active tab content wrapper
- reports-statistics-loading | reports-statistics-empty | reports-statistics — statistics tab states
- reports-overview-cards — overview metrics cards
- reports-carriers — carriers distribution
- reports-top-mailboxes — top mailboxes list
- reports-daily-trends — daily trends chart/list
- reports-pickups-loading | reports-pickups-empty | reports-pickups — pickups tab states
- reports-pickups-summary — summary header
- reports-pickups-list — list of pickup events
- reports-pickups-pagination — pagination controls
- reports-audit-loading | reports-audit-empty | reports-audit — audit tab states
- reports-audit-filters — filter controls
- reports-audit-list — audit entries list
- reports-audit-pagination — pagination controls

Dev overlay (TestIdOverlay)
- Toggle is visible in development builds at the bottom-left of the app. Click to enable/disable showing the nearest ancestor data-testid on hover. The setting persists via localStorage between reloads.

### How to specify changes unambiguously
- Reference the exact data-testid in requests:
  - “Make [data-testid='mailbox-summary-number'] bold.”
  - “Hide [data-testid='mailbox-summary-tenant-phone'] on mobile.”
  - “Change [data-testid='pickup-proceed'] label to ‘Continue’.”
- Or specify role + accessible name for a11y-driven tasks:
  - “Increase padding on the button with name ‘Confirm Signature’.”

If you can’t see these attributes in Safari, hard-refresh the page to pull the latest frontend build.

...existing code...
