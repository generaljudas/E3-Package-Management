# E3 Package Manager - System Documentation

**Version:** 1.0.0-beta.1
**Last Updated:** August 22, 2026

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
11. [Signature Retrieval](#signature-retrieval)
12. [Testing & Debugging](#testing--debugging)
13. [Known Limitations](#known-limitations)
14. [Future Enhancement Ideas](#future-enhancement-ideas)
15. [UI Element Identification Guide](#ui-element-identification-guide)

---

## System Overview

### Purpose
E3 Package Manager is an application for mailbox rental centers to manage package intake, tracking, pickup, and reporting with a mailbox-first architecture. It runs as a desktop app (Electron) or as a local web app during development.

### Core Features
- **Mailbox-First Workflow**: All operations center around mailbox numbers with tenant associations
- **Package Intake**: Simplified batch scanning — tracking number only, maximum speed workflow
- **Package Pickup**: Digital signature capture, bulk pickup processing
- **Reports Dashboard**: Statistics, pickup history, and system audit logs
- **Offline Support**: Operation queueing in local storage with automatic sync on reconnect
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
│              Electron Shell / Browser                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         React Frontend (Vite build)                  │  │
│  │  - Components (Intake, Pickup, Tools, Reports)       │  │
│  │  - Offline queue (localStorage)                      │  │
│  │  - Mailbox cache (in-memory + localStorage)          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │ HTTP/REST (localhost:3001)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend Server (Node.js)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Express.js API Server                        │  │
│  │  - Routes (mailboxes, tenants, packages, pickups,    │  │
│  │    signatures, reports)                              │  │
│  │  - Validation (express-validator)                    │  │
│  │  - Security (helmet, rate limiting, CORS)            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │ SQL
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    SQLite Database                          │
│  - mailboxes, tenants, packages, pickup_events, signatures  │
│  - Created automatically on first run, WAL mode             │
│  - Desktop app: stored in the OS user-data folder           │
│  - Dev: backend/database.sqlite (or DB_PATH)                │
└─────────────────────────────────────────────────────────────┘
```

In the packaged desktop app, the Electron main process starts the backend as a
child utility process using Electron's bundled Node runtime, waits for
`/api/health`, then opens the window. Users need no Node, no database setup.

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
- **Framework**: React 19
- **Build Tool**: Vite 7
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (via @tailwindcss/postcss) + custom CSS (`src/index.css`)
- **Routing**: React Router v7 (HashRouter, so the build works from `file://` in Electron)
- **Barcode Scanning**: Handheld USB scanners in keyboard-emulation mode (scanners type into the focused input and submit on Enter — no camera dependency)
- **Signatures**: Hand-rolled `<canvas>` capture (SignaturePad component)

### Backend
- **Runtime**: Node.js 18+ (ES Modules)
- **Framework**: Express.js 4
- **Validation**: express-validator
- **Security**: helmet, cors, express-rate-limit
- **Database Client**: sqlite + sqlite3 (async wrapper over the native driver)
- **Process Manager**: nodemon (development)

### Desktop
- **Shell**: Electron 38
- **Packaging**: electron-builder (NSIS installer for Windows, DMG for macOS, AppImage for Linux)

---

## Database Schema

SQLite. The schema is created automatically on first run by `backend/src/models/database.js` (`CREATE TABLE IF NOT EXISTS`), with WAL journaling and foreign keys enabled. Demo data is seeded on first run unless `SKIP_SEED=true`.

```sql
CREATE TABLE IF NOT EXISTS mailboxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_number VARCHAR(10) NOT NULL UNIQUE,
  default_tenant_id INTEGER,
  notes TEXT,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  contact_info TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_id INTEGER NOT NULL,
  tenant_id INTEGER,
  tracking_number VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'received',
  high_value BOOLEAN DEFAULT 0,
  pickup_by VARCHAR(255),
  carrier VARCHAR(100),
  size_category VARCHAR(20),
  notes TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  picked_up_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pickup_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id INTEGER NOT NULL,
  picked_up_by VARCHAR(255),
  signature_id INTEGER,
  notes TEXT,
  picked_up_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (signature_id) REFERENCES signatures(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signature_data TEXT NOT NULL,   -- base64-encoded PNG
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_packages_mailbox ON packages(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_packages_tenant ON packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_tracking ON packages(tracking_number);
CREATE INDEX IF NOT EXISTS idx_tenants_mailbox ON tenants(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_pickup_events_package ON pickup_events(package_id);
```

### Key Points
- `mailbox_number` is unique and used for lookup (e.g., "101", "145")
- `default_tenant_id` points to the primary tenant for quick selection
- Multiple tenants can share a mailbox (family members, business partners)
- `packages.mailbox_id` is **required** — enforces the mailbox-first model; the API infers it from `tenant_id` at intake
- `tracking_number` is unique across the entire system
- Status workflow: `received` → `ready_for_pickup` → `picked_up` (plus `returned_to_sender`)
- Soft deletion via `active` flags
- Signatures are stored as base64 PNG text in the database — no file storage involved

> `backend/database_schema.sql` contains a PostgreSQL-flavored schema kept as a
> reference for a future multi-station setup; the running application uses the
> SQLite schema above.

---

## Backend API Reference

### Base URL
```
http://localhost:3001/api
```

### Authentication
None — the app is designed for a single trusted workstation. (Authentication is a roadmap item; see README.)

### Endpoints

#### Health
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` (also `/health`) | Health check: status, timestamp, version |

#### Mailboxes (`/api/mailboxes`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List mailboxes |
| GET | `/:id` | Get one mailbox |
| POST | `/` | Create mailbox |
| PUT | `/:id` | Update mailbox |
| DELETE | `/:id` | Deactivate mailbox |

#### Tenants (`/api/tenants`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List active tenants |
| GET | `/search?q={query}` | Search by mailbox number or name |
| GET | `/mailbox/:mailboxNumber` | Mailbox + its tenants |
| GET | `/:id` | Get one tenant |
| POST | `/` | Create tenant |
| PUT | `/:id` | Update tenant |
| DELETE | `/:id` | Deactivate tenant |
| PATCH | `/mailboxes/:mailboxId/default-tenant` | Set a mailbox's default tenant |
| PATCH | `/mailboxes/by-number/:mailboxNumber/default-tenant` | Same, addressed by mailbox number |

#### Packages (`/api/packages`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List packages with filters |
| GET | `/all` | List all packages |
| GET | `/tenant/:tenantId` | Packages for a tenant |
| GET | `/mailbox/:mailboxId?status=&limit=` | Packages for a mailbox |
| GET | `/tracking/:trackingNumber` | Find by tracking number |
| GET | `/search?start_date=&end_date=&mailbox_id=&status=` | Search (used by signature retrieval) |
| POST | `/` | Register package (intake) |
| PUT | `/:id/status` | Update status |
| PUT | `/:id` | Update details |
| DELETE | `/:id` | Delete package |

#### Pickups (`/api/pickups`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Pickup history (audit trail) |
| GET | `/:id` | Pickup event details |
| POST | `/` | Process pickup (with optional signature) |
| POST | `/bulk-status` | Bulk status update |

#### Signatures (`/api/signatures`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/:id` | Signature metadata |
| GET | `/package/:packageId` | Signature for a package |
| GET | `/image/:id` | Signature as PNG image |
| DELETE | `/:id` | Remove signature |

#### Reports (`/api/reports`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/statistics?start_date=&end_date=&mailbox_id=` | Overview stats, carriers, daily trends, top mailboxes |
| GET | `/pickups?start_date=&end_date=&mailbox_id=&limit=&offset=` | Pickup history |
| GET | `/audit?start_date=&end_date=&action_type=&limit=` | Audit log (`package_intake`, `pickup`, `status_change`, `tenant_update`) |
| GET | `/mailbox/:mailboxId/summary` | Per-mailbox summary |

### Key Request/Response Examples

**Simplified intake** — only two required fields; the server infers `mailbox_id` from the tenant:

```http
POST /api/packages
{ "tracking_number": "1Z999AA1234567890", "tenant_id": 1 }
```

```json
{
  "package": {
    "id": 1,
    "tracking_number": "1Z999AA1234567890",
    "mailbox_id": 1,
    "tenant_id": 1,
    "status": "received"
  },
  "message": "Package registered successfully"
}
```

**Pickup with signature:**

```http
POST /api/pickups
{
  "package_ids": [1, 2, 3],
  "mailbox_id": 1,
  "tenant_id": 1,
  "pickup_person_name": "Wendy Larkspur",
  "signature_data": "data:image/png;base64,...",
  "staff_initials": "JS",
  "notes": "ID verified"
}
```

The response includes a `pickup_summary` (count, mailbox, pickup person, signature info, timestamp) and the updated `packages` array. When the client is offline, the same payload is queued locally and replayed on reconnect (see [Data Flow](#data-flow--business-logic)).

---

## Frontend Structure

```
frontend/src/
├── components/
│   ├── AppHeader.tsx              # Top bar: branding, clock, online status
│   ├── NavigationTabs.tsx         # Intake / Pickup / Tools view switcher
│   ├── MailboxSelectionCard.tsx   # Mailbox search & selection
│   ├── MailboxLookup.tsx          # Mailbox search & tenant selection
│   ├── PackageIntake.tsx          # Batch intake with scanner input
│   ├── PackagePickup.tsx          # Pickup list, verify, signature workflow
│   ├── BarcodeScanner.tsx         # USB scanner (keyboard emulation) input
│   ├── SignaturePad.tsx           # Canvas signature capture
│   ├── SignatureRetrieval.tsx     # Search & view captured signatures
│   ├── Tools.tsx                  # Tools hub (signatures, management, reports)
│   ├── Reports.tsx                # Statistics / pickups / audit tabs
│   ├── MailboxTenantManagement/   # Mailbox & tenant CRUD screens + hooks
│   ├── Toast.tsx                  # Toast notifications
│   ├── OfflineStatusBar.tsx       # Offline/sync banners (+ dev debug panel)
│   ├── EmptyState.tsx             # Empty-state message card
│   ├── KeyboardShortcuts.tsx      # Shortcut help overlay
│   └── TestIdOverlay.tsx          # Dev-only data-testid inspector
├── hooks/
│   ├── useOffline.ts              # Offline state management
│   ├── useMailboxCache.ts         # Shared mailbox cache + search helpers
│   ├── useFocus.ts                # Focus flow, focus trap, global shortcuts
│   └── useToast.ts                # Toast state
├── services/
│   ├── api.ts                     # API client (exports API_BASE_URL)
│   └── offlineService.ts          # Offline queue management
├── types/index.ts                 # TypeScript definitions
├── constants/                     # App configuration
├── App.tsx                        # Main application component
├── main.tsx                       # Entry point
├── index.css                      # Global styles
└── tailwind.css                   # Tailwind entry
```

### Keyboard Shortcuts (Staff Productivity)
- **Alt+P**: Focus Package Intake input
- **Alt+M**: Focus Mailbox Lookup
- **Enter**: Next field in sequence
- **Ctrl+Enter / Cmd+Enter**: Submit package or batch

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm

No database installation is needed — SQLite is created automatically.

### Backend

```bash
cd backend
npm install
npm run dev
```

Expected output:

```
📂 Database path: .../backend/database.sqlite
✅ SQLite database connected successfully
✅ Database schema initialized
🚀 E3 Package Manager API running on port 3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Electron (development)

With the backend and frontend dev servers running:

```bash
npm install        # repo root
npm run electron:dev
```

### Desktop build

```bash
npm run electron:build       # current platform; builds frontend first
npm run electron:build:all   # Windows + macOS + Linux
```

Output lands in `dist-electron/`. The packaged app starts its own backend and
stores its database in the OS user-data directory (e.g.
`~/Library/Application Support/e3-package-manager/` on macOS,
`%APPDATA%/e3-package-manager/` on Windows).

---

## Environment Configuration

All configuration is optional; defaults work out of the box.

### Backend (`backend/.env`, copy from `.env.example`)

```bash
PORT=3001                            # API server port
NODE_ENV=development                 # development | production
FRONTEND_URL=http://localhost:5173   # CORS allowed origin
DB_PATH=./database.sqlite            # SQLite file (relative = from backend/)
SKIP_SEED=false                      # true = start with an empty database
```

Precedence for the database location:
1. `E3_DB_PATH` (explicit override, always wins)
2. Electron packaged mode → OS user-data directory
3. `DB_PATH` (dev convenience)
4. Default: `backend/database.sqlite`

### Frontend (`frontend/.env`, optional)

```bash
VITE_API_URL=http://localhost:3001/api
```

---

## Data Flow & Business Logic

### Package Intake Workflow (Simplified)

```
1. User searches for mailbox (e.g., "106")
2. System retrieves mailbox with default tenant
3. User confirms or switches tenant (if needed)
4. User scans barcode (USB scanner types into the input) or types tracking number
5. Tracking number added to batch list
6. Repeat 4–5, then submit the batch
7. Frontend POSTs each package with tracking_number + tenant_id only
8. Backend infers mailbox_id from the tenant and inserts with status='received'
9. Success notification shows count; batch list clears
```

**Philosophy**: fast intake now, add details (carrier, size, notes) later if needed.

### Package Pickup Workflow

```
1. User opens Package Pickup (with or without a mailbox selected)
2. System loads packages; filters show Available / Picked Up / All
3. User selects packages via checkboxes and proceeds
4. Verify step: pickup person name (pre-filled from tenant)
5. Signature step: user signs on canvas; signature converted to base64 PNG
6. Frontend POSTs /api/pickups
7. Backend records pickup events, updates package statuses, stores signature
8. Success toast shows package count
```

### Offline Mode Operation

There is no service worker; offline support is implemented in application code:

```
1. useOffline detects connectivity changes (navigator.onLine + events)
2. UI shows the offline banner
3. Intake/pickup operations performed offline are queued in localStorage
   (offlineService)
4. Mailbox lookups fall back to the cached mailbox list (useMailboxCache)
5. On reconnect, the queue replays against the API in order
6. Synced operations are removed; failures stay queued for retry
7. Banners/toasts report sync progress
```

---

## Security & Performance

### Security Measures
- **Input validation**: express-validator on API inputs; parameterized SQL only
- **HTTP hardening**: helmet with a restrictive Content-Security-Policy
- **Rate limiting**: 1000 requests / 15 minutes per IP (express-rate-limit)
- **CORS**: allows the configured frontend origin, localhost dev ports, and Electron's `file://` origin
- **No authentication**: intentional for the single-workstation design; do not expose the API to a network without adding auth (roadmap)

### Performance Notes
- SQLite WAL mode for concurrent reads during writes
- Indexes on the hot paths (tracking number, mailbox, tenant, status)
- Debounced search input (300ms) against an in-memory mailbox cache
- Signature payload limit: 10 MB JSON body

---

## Signature Retrieval

Staff can search for picked-up packages and view their captured signatures. Access via **Tools → View Package Signatures**.

### Search Modes
1. **Quick Search (tracking number)** — full or partial tracking number; a single match displays its signature automatically
2. **Advanced Search (mailbox + date range)** — mailbox dropdown plus start/end dates (defaults to the last 30 days)

### Displayed Information
Tracking number, mailbox number, tenant name, pickup date & time, pickup person, and the signature image.

### Endpoints Used
- `GET /api/packages/search` — filter by date range, mailbox, status
- `GET /api/signatures/package/:packageId` — signature for a package

### Limitations
- Search returns at most 500 results per query
- Only packages with status `picked_up` are searchable here
- Signatures can be viewed but not edited or deleted from this screen

---

## Testing & Debugging

There is no automated test suite yet (roadmap). Manual checklist:

### Package Intake
- [ ] Search for a mailbox — default tenant appears
- [ ] Switch tenant; set a new default tenant
- [ ] Scan or type a tracking number — it appears in the batch list
- [ ] Batch multiple packages; remove one; submit
- [ ] Success message shows the registered count
- [ ] Packages appear in the pickup list with status `received`

### Package Pickup
- [ ] View packages for a selected mailbox and for all mailboxes
- [ ] Status filters and search work
- [ ] Select multiple packages, verify, capture signature, confirm
- [ ] Packages marked `picked_up`; signature stored

### Reports
- [ ] Statistics counts correct; carrier distribution plausible
- [ ] Date range filtering works
- [ ] Pickup history pagination works
- [ ] Audit log lists activities; action type filter works

### Offline
- [ ] Disconnect network: banner appears, intake still queues
- [ ] Reconnect: queue syncs, counts clear

### Inspecting the database

```bash
# Dev database
sqlite3 backend/database.sqlite

# Useful queries
.tables
SELECT status, COUNT(*) FROM packages GROUP BY status;
SELECT * FROM signatures ORDER BY created_at DESC LIMIT 5;
```

The desktop app's database lives in the user-data directory (see
[Development Setup](#development-setup)).

---

## Known Limitations

1. **No authentication** — single-workstation design; add auth before any network exposure
2. **Single station** — one SQLite database per machine; multi-station via a shared server DB is a roadmap item
3. **Signatures stored as base64 text** — simple and portable, but grows the database with heavy use
4. **`tenants.mailbox_id` is the source of truth** — a tenant belongs to exactly one mailbox
5. **Unsigned installers** — Windows SmartScreen / macOS Gatekeeper warnings until code signing lands (roadmap)

---

## Future Enhancement Ideas

### High Priority
1. **User Authentication** — staff login, role-based access, audit attribution
2. **Email Notifications** — package arrival and reminder emails
3. **SMS Integration** — arrival texts, pickup confirmation codes
4. **Photo Capture** — package condition documentation at intake

### Medium Priority
5. **Advanced Reporting** — PDF/Excel export, custom analytics
6. **Barcode Printing** — internal tracking labels
7. **Package Holds** — vacation holds, forwarding addresses
8. **Multi-Location Support** — multiple centers, cross-location transfers

### Low Priority
9. **Mobile App** — native apps with push notifications
10. **Carrier API Integration** — UPS/FedEx/USPS live tracking sync
11. **Customer Portal** — tenant self-service tracking

---

## UI Element Identification Guide

This app uses stable data-testid attributes and accessible names to identify UI elements unambiguously across the UI and in tests.

### Preferred identification methods
- data-testid: zero-ambiguity selectors for collaboration and tests
  - Example (CSS): `[data-testid="pickup-proceed"]`
  - Example (Testing Library): `screen.getByTestId('pickup-proceed')`
- Accessible name + role: aligns with a11y and user-visible labels
  - Example (Testing Library): `screen.getByRole('button', { name: /confirm signature/i })`

### Finding an element's identifier (browser dev tools)
1. Right-click the element → Inspect Element
2. Look for `data-testid="…"` (canonical selector) or `aria-label` / `aria-labelledby`
3. Console helpers with the node selected: `$0.getAttribute('data-testid')`, `$0.textContent?.trim()`

### Key data-testids (Catalog)

**MailboxLookup (selection bar)**
- `mailbox-lookup-root` — component root
- `mailbox-lookup-input` — the mailbox/tenant search input
- `mailbox-lookup-dropdown` — dropdown container
- `mailbox-lookup-option-<mailboxId>` — each dropdown option

**PackagePickup (pickup workflow)**
- `pickup-root` — component root
- `pickup-offline-warning` — offline message (when offline)
- `pickup-step-list` — list step container
- `pickup-status-filter` — filter button group
- `pickup-filter-all` | `pickup-filter-available` | `pickup-filter-picked_up` — status filters
- `pickup-search-input` — search input
- `pickup-table-container` — table wrapper
- `pickup-table` — table element
- `pickup-col-tracking` | `pickup-col-status` | `pickup-col-carrier` | `pickup-col-size` | `pickup-col-received` | `pickup-col-pickup-date` — column headers
- `pickup-no-packages` — empty-state message
- `pickup-row-<packageId>` — table row for a package
- `pickup-select-<packageId>` — row checkbox
- `pickup-selection-summary` — selected packages summary
- `pickup-proceed` — proceed to pickup button
- `pickup-step-verify` — verify step container
- `pickup-person-input` — pickup person name input
- `pickup-verify-list` — verify list of packages
- `pickup-continue-signature` — continue to signature button
- `pickup-back-to-list` — back to list button
- `pickup-step-signature` — signature step container
- `pickup-signature-pad` — signature canvas container
- `pickup-confirm-signature` — confirm signature button
- `pickup-back-to-verify` — back to verify button
- `pickup-verification` — final confirmation/signature verification container

**PackageIntake (intake workflow)**
- `intake-root` — component root
- `intake-offline-warning` — offline message (when offline)
- `intake-scanner-section` — barcode scanner wrapper
- `intake-scanner-toggle` — toggle for scanner on/off
- `intake-tracking-input` — tracking number input
- `intake-add-to-batch` — add current tracking to batch button
- `intake-batch-list` — list of batched tracking numbers
- `intake-batch-item-<tracking>` — individual batch list item
- `intake-clear-form` — clear/reset form button
- `intake-submit` — submit/register batch button

**Tools**
- `tools-root` — component root
- `tools-header` — header container
- `tools-tabs` — tabs container
- `tools-tab-<id>` — tab button elements
- `tools-content` — active tab content wrapper

**OfflineStatusBar**
- `offline-status-root` — component root
- `offline-status-banner` — offline banner when disconnected
- `offline-queued-count` — count of queued operations
- `offline-syncing-banner` — syncing status banner
- `offline-notifications` — notification list wrapper
- `offline-notification-<id>` — individual notification item

**Reports**
- `reports-root` — component root
- `reports-header` — header container
- `reports-date-range` — date range wrapper
- `reports-date-from` — start date input
- `reports-date-to` — end date input
- `reports-tabs` — tabs container
- `reports-tablist` — tablist role container
- `reports-tab-<id>` — tab button
- `reports-content` — active tab content wrapper
- `reports-statistics-loading` | `reports-statistics-empty` | `reports-statistics` — statistics tab states
- `reports-overview-cards` — overview metrics cards
- `reports-carriers` — carriers distribution
- `reports-top-mailboxes` — top mailboxes list
- `reports-daily-trends` — daily trends chart/list
- `reports-pickups-loading` | `reports-pickups-empty` | `reports-pickups` — pickups tab states
- `reports-pickups-summary` — summary header
- `reports-pickups-list` — list of pickup events
- `reports-pickups-pagination` — pagination controls
- `reports-audit-loading` | `reports-audit-empty` | `reports-audit` — audit tab states
- `reports-audit-filters` — filter controls
- `reports-audit-list` — audit entries list
- `reports-audit-pagination` — pagination controls

**SignatureRetrieval**
- `signature-retrieval-root` — main container
- `search-mode-toggle` — toggle between search modes
- `search-mode-tracking` | `search-mode-advanced` — mode buttons
- `tracking-number-input` — tracking input field
- `tracking-search-button` — tracking search submit
- `mailbox-select` — mailbox dropdown
- `start-date-input` | `end-date-input` — date pickers
- `advanced-search-button` — advanced search submit
- `package-result-<id>` — individual package results
- `signature-display` — signature viewing area
- `signature-image` — the signature image itself
- `close-signature-button` — close signature view

**Dev overlay (TestIdOverlay)**
- Development builds only: toggle at the bottom-left of the app shows the nearest ancestor data-testid on hover. Setting persists via localStorage.

### How to specify changes unambiguously
- Reference the exact data-testid: "Make `[data-testid='pickup-proceed']` label say 'Continue'."
- Or role + accessible name: "Increase padding on the button named 'Confirm Signature'."

---

## Support & Contribution

- Questions and bugs: [GitHub Issues](https://github.com/generaljudas/E3-Package-Management/issues)
- Current mission and task list: see [ROADMAP.md](ROADMAP.md)
- Release notes: see [ALPHA_RELEASE.md](../ALPHA_RELEASE.md) (to be replaced by a `CHANGELOG.md` — see roadmap)

`CONTRIBUTING.md` does not exist yet; adding it is a roadmap item.
