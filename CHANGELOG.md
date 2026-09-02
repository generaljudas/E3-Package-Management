# Changelog

All notable changes to E3 Package Manager are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

Each entry links the commit that landed it, so you can read the full reasoning
behind a change with `git show <hash>`.

## [Unreleased]

Nothing yet.

## [1.0.0-beta.1] — 2026-09-01

The first release meant for someone who has never seen the repository: a
downloadable desktop installer, an accessible interface, and documentation that
describes what actually exists. See [docs/ROADMAP.md](docs/ROADMAP.md) for the
plan this release closes out.

### Added

- **Desktop app.** Electron shell with packaged installers — Windows (NSIS
  `.exe`), macOS (`.dmg`), Linux (`.AppImage`). The backend runs on Electron's
  bundled Node runtime (no separate Node install needed), the database lives in
  the OS user-data folder, startup shows a real error dialog instead of hanging,
  and only one instance can run at a time. (`c1ea055`)
- **Type your name to sign.** Signature capture now offers "Draw signature" or
  "Type name to sign" (drawing stays the default). A typed name is a legally
  valid signature — the researched decision and its record-keeping requirements
  are in [docs/SIGNATURE_POLICY.md](docs/SIGNATURE_POLICY.md). The method is
  stored with the signature and shown at verification and in Signature
  Retrieval; a typed name is never rendered as fake handwriting. This also closes
  the last keyboard-accessibility blocker. (`e950703`, `40e4bc5`)
- **Signature Retrieval tool** (Tools → View Package Signatures): quick search by
  tracking number, or advanced search by mailbox and date range. (`4fa89be`)
- **Cross-tenant pickups** and an all-packages view with mailbox filtering in
  Package Pickup. (`4fa89be`, `7b7947e`)
- **Keyboard-shortcuts help** (`?`) — the overlay existed but was never mounted;
  it now opens, moves focus to Close, and returns focus on close. (`e26dbca`)
- **Isolated database for testing** via `DB_PATH`, and `SKIP_SEED=true` to start
  empty. (`800a013`)
- **Documentation:** [docs/ROADMAP.md](docs/ROADMAP.md) (mission and phases),
  [docs/A11Y_AUDIT.md](docs/A11Y_AUDIT.md) (accessibility checklist),
  [docs/SIGNATURE_POLICY.md](docs/SIGNATURE_POLICY.md),
  [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) (system reference),
  [docs/INSTALL.md](docs/INSTALL.md) (installing an unsigned build),
  `CONTRIBUTING.md`, and this changelog. MIT `LICENSE` added. (`dc7fb79`,
  `f8eaf90`)

### Changed

- **Accessibility to WCAG 2.2 AA** (`0de06b5`, `50bd3de`, `e26dbca`, `40e4bc5`):
  - Toasts, offline banners, loading states, result counts and signature status
    are announced to screen readers (live regions).
  - Every search input has an accessible name; the mailbox lookup is a real
    combobox (`aria-expanded`, `aria-activedescendant`, listbox/option roles).
  - Toggle groups expose `aria-pressed`; the active navigation tab exposes
    `aria-current`; table headers carry `scope="col"`; repeated button names are
    disambiguated.
  - Focus moves deliberately through the pickup steps (list → verify → signature
    → confirm) and into/out of Tools and Signature Retrieval instead of
    dropping to `<body>`.
  - All positive `tabIndex` overrides removed.
  - Contrast failures cleared: header title and active tabs, primary and
    destructive buttons, all four toast variants, input and secondary-button
    borders, muted text, placeholder styling, and a focus ring that is visible
    against the header.
  - The header's Online/Offline indicator reflects real connectivity (it was
    hard-coded "Online").
- **The Tailwind utility layer compiles again.** It had been silently dead under
  Tailwind v4 (v3 directives and config), which is why the offline status bar
  rendered white-on-white. `src/index.css` remains the authoritative base
  stylesheet. (`0de06b5`)
- The frontend builds with relative asset paths and a hash router so it works
  from `file://` inside the packaged app. (`c1ea055`)
- Barcode intake targets handheld USB scanners in keyboard-emulation mode; no
  camera or HTTPS required. (`c1ea055`)
- README rewritten to describe what exists (SQLite by default, real routes and
  tables, real environment variables); `backend/.env.example` lists only the
  variables the backend reads. Backend and frontend versions aligned. (`dc7fb79`)
- Mailbox lookup: Enter auto-selects an exact number match; arrow keys navigate
  results; the input clears after selection so the next scan can start
  immediately. (`e52bcfc`, `969219c`)
- Mailbox & Tenant Management restructured around search-first flow.
  (`9512c18`, `ac70e90`)

### Fixed

- **The Package Pickup list, per-tenant package lookup, lookup by tracking
  number, and tenant search all failed on SQLite** with `no such column:
  mailbox_number` — the queries read the mailbox number from `tenants` instead
  of joining `mailboxes` (the same schema drift as the pickup-persistence bug
  below). Also replaced a PostgreSQL `ILIKE`, and fixed the pagination count
  query, which had been slicing away its own WHERE conditions. Found while
  taking release screenshots against a fresh database.
- **Pickup persistence was silently broken.** The `signatures` table had no
  `package_id` column, so every signature insert failed and was swallowed
  (`signature_captured` was always false and retrieval joins threw).
  `POST /pickups` never wrote `pickup_events` — the audit trail was permanently
  empty and the pickup person's name was discarded. Read paths used
  PostgreSQL-only SQL against SQLite. All repaired, with an `ALTER TABLE`
  migration guard for existing databases. (`40e4bc5`)
- **The packaged app never ran.** It spawned the system `node` (absent on end-user
  machines) against a path inside the asar archive, pointed the database at a
  read-only location, and 404'd on its own assets. (`c1ea055`)
- The pickup row checkbox only worked by accident (via event bubbling to the
  row); it now toggles exactly once from either the row or the checkbox.
  (`e26dbca`)
- Toast auto-dismiss keyed off the message text containing "error" rather than
  the toast type. (`e26dbca`)
- **Received and pickup times displayed in the wrong timezone.** SQLite stores
  `CURRENT_TIMESTAMP` in UTC with no zone marker, and the UI parsed it as local
  time, so every time in Package Pickup and Signature Retrieval was off by the
  store's UTC offset (a 11:27 PM pickup showed as 6:27 AM the next day in
  Pacific time). Zone-less server timestamps are now parsed as UTC
  (`frontend/src/utils/dates.ts`).
- The keyboard-shortcuts button read "Keyboard Keyboard shortcuts" — a literal
  placeholder where the icon belonged.
- Indefinite loading animation in the mailbox cache. (`ba52600`)
- `RETURNING` clause handling for `UPDATE` queries. (`7b94dfd`)
- Type errors that had broken `npm run build` entirely. (`c1ea055`)

### Removed

- Real customer data replaced with synthetic fixtures throughout the repository
  and its history. (`6ac507f`)
- Unused `pg` and `multer` dependencies, dead `tsc`/`tsx` scripts, committed
  `.bak` files, the unused PWA plugin, and 0-byte icon placeholders.
  (`dc7fb79`, `c1ea055`)
- `ALPHA_RELEASE.md` (superseded by this file), the stale root
  `DOCUMENTATION.md` (superseded by `docs/DOCUMENTATION.md`),
  `SIGNATURE_RETRIEVAL_FEATURE.md` and `MIGRATION_GUIDE.md` (folded into
  `docs/DOCUMENTATION.md` and `backend/scripts/README.md`).

### Security

- **The local API now listens on loopback only** (`127.0.0.1`). It has no
  authentication, and previously bound to every network interface, so any
  device on the store's network could read and modify package data. Binding to
  loopback also removes the Windows Firewall prompt on first launch. Override
  with `HOST` only if you know why.
- Environment handling hardened for open-source distribution; the dev `.env` is
  no longer packaged into installers. (`648792a`, `c1ea055`)

### Build & release

- GitHub Actions workflow (`.github/workflows/release.yml`) builds the Windows,
  macOS and Linux installers on their own operating systems when a `v*` tag is
  pushed and attaches them to a draft release. This is required, not a
  convenience: the backend ships a native SQLite driver compiled for the build
  machine, so an installer cross-built on a Mac would not start on Windows.
- Installer file names are now `E3-Package-Manager-Setup-<version>.exe`,
  `E3-Package-Manager-<version>-arm64.dmg`, `E3-Package-Manager-<version>.AppImage`.
- Screenshots retaken from the production build with the dev overlays gone and
  the accessible UI in place; ~40% smaller than the previous set.

### Known limitations

- Installers are **unsigned**. Windows SmartScreen and macOS Gatekeeper will
  warn on first launch — [docs/INSTALL.md](docs/INSTALL.md) walks through the
  two clicks past each warning. Code signing is a roadmap item.
- No auto-update; download new versions from GitHub Releases.
- No automated test suite yet.
- Single-station only (one SQLite database per computer). Multi-station
  PostgreSQL is a documented "advanced" option, not a supported path.
- One accessibility nit remains open (`M11` in
  [docs/A11Y_AUDIT.md](docs/A11Y_AUDIT.md)): the Mailbox Search arrow-key
  highlight in Tools is not exposed to screen readers. The flow is fully
  keyboard-operable without it.

## [1.0.0-alpha] — 2025-10-14

Web application, before the desktop conversion. Preserved from the retired
`ALPHA_RELEASE.md`.

### Added

- Package intake with barcode scanning (camera-based, QuaggaJS), lookup and
  search, status tracking (Received, Ready for Pickup, Picked Up, Returned),
  carrier/size/notes.
- Mailbox and tenant management: CRUD for 500+ mailboxes, default tenant
  assignment, search by number or name with keyboard navigation.
- Package pickup workflow: single/multiple selection, verification step,
  canvas signature capture, confirmation, filters by status.
- Offline support: operation queue with automatic sync, status indicator.
- Toast notifications, loading and empty states, unified back navigation.
- Backend: Node.js + Express + SQLite, `express-validator`, CORS.

### Known limitations at the time

- Camera barcode scanning required HTTPS (dev server was HTTP).
- Reports were a placeholder.
- No authentication; single-user by design.

[Unreleased]: https://github.com/generaljudas/E3-Package-Management/compare/v1.0.0-beta.1...HEAD
[1.0.0-beta.1]: https://github.com/generaljudas/E3-Package-Management/compare/v1.0.0-alpha...v1.0.0-beta.1
[1.0.0-alpha]: https://github.com/generaljudas/E3-Package-Management/releases/tag/v1.0.0-alpha
