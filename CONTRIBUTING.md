# Contributing to E3 Package Manager

Thanks for looking. This project exists so that a mail-center operator with
minimal computer knowledge can download an installer, double-click, and be
tracking packages — free, open source, effortless. Every contribution is judged
against that sentence. [docs/ROADMAP.md](docs/ROADMAP.md) explains the current
chapter of work and what is deliberately out of scope.

## Ways to help

- **Report a bug** — [open an issue](https://github.com/generaljudas/E3-Package-Management/issues)
  with your OS, the app version (Help → About, or the installer filename), what
  you did, what you expected, and what happened. If the app failed to start, the
  error dialog text is the most useful thing you can paste.
- **Try the installer on a machine we don't have.** Windows smoke tests on real
  hardware are especially valuable — see [docs/INSTALL.md](docs/INSTALL.md).
- **Improve the docs.** If something in the README or install guide confused
  you, that's a bug in the docs.
- **Fix or build something.** Read the rest of this file first.

## Where things live

| Path | What it is |
|---|---|
| `backend/` | Node.js + Express API over SQLite (`src/index.js` entry, `src/routes/`, `src/models/database.js` schema + seed) |
| `frontend/` | React + TypeScript + Vite (`src/components/`, `src/hooks/`, `src/services/api.ts`) |
| `electron/` | Desktop shell — `main.js` starts the backend and opens the window |
| `docs/DOCUMENTATION.md` | System reference: schema, API, data flow, `data-testid` catalog |
| `docs/ROADMAP.md` | Mission, phases, and what's next — the source of truth for scope |
| `docs/A11Y_AUDIT.md` | Accessibility checklist and what remains |
| `docs/SIGNATURE_POLICY.md` | Why a typed name is a valid signature here, and the record-keeping rules any signature change must preserve |
| `CHANGELOG.md` | Release notes |

## Development setup

**Prerequisites:** Node.js 20.19 or newer (Vite 7 requires it; Node 22 LTS is a
good choice), npm, git. No database server — SQLite is created on first run.

```bash
git clone https://github.com/generaljudas/E3-Package-Management.git
cd E3-Package-Management

# Backend (terminal 1) — API on http://localhost:3001, seeds demo data
cd backend && npm install && npm run dev

# Frontend (terminal 2) — UI on http://localhost:5173
cd frontend && npm install && npm run dev

# Desktop shell (optional, terminal 3) — opens Electron against the two dev servers
npm install && npm run electron:dev
```

**Use a throwaway database while developing.** Set `DB_PATH` (or `E3_DB_PATH`,
which wins everywhere including packaged builds) so you never touch a real
one:

```bash
cd backend && DB_PATH=./scratch.sqlite npm run dev
```

`SKIP_SEED=true` starts with an empty database. All variables are documented in
`backend/.env.example`.

**Building installers:**

```bash
npm run electron:build        # current OS only → dist-electron/
```

Installers must be built on the OS they target, because the backend ships a
native SQLite driver compiled for the build machine. The release workflow in
`.github/workflows/release.yml` builds all three on GitHub's runners when a
`v*` tag is pushed — don't try to cross-build locally and ship the result.

## Standards

There is no automated test suite yet (it is on the roadmap). Until there is,
the bar is: **run it and verify it in the real app**, and say so in your PR.

- **TypeScript strict mode.** `cd frontend && npm run lint` must pass.
- **Keyboard-first is the product.** Front-desk staff work with a barcode
  scanner in one hand. Auto-focus on the next input, Enter to submit, arrow
  keys in dropdowns — preserve these. Never add a positive `tabIndex`.
- **Accessibility is a requirement, not a polish step.** The app meets WCAG
  2.2 AA and stays there:
  - Every control has a name, role, and value (real `<button>`, `<label
    htmlFor>` or `aria-label`, `aria-pressed`/`aria-current` on toggles and
    tabs, combobox semantics on search-with-dropdown).
  - Anything that changes without user action (toasts, offline banners,
    loading, result counts) is a live region.
  - Focus is managed when a step or panel opens or closes — move it somewhere
    sensible, never let it fall to `<body>`.
  - Text contrast ≥ 4.5:1, verified by computing the ratio, not by eye. White
    text over a gradient needs a passing stop everywhere it sits.
  - See [docs/A11Y_AUDIT.md](docs/A11Y_AUDIT.md) for the patterns already in use.
- **No restyling in this chapter.** A visual redesign is a separate, later
  effort. Markup and behavior changes are welcome; changing the look is not,
  unless it fixes a contrast or focus-visibility failure.
- **Styling facts you need to know:** Tailwind v4 is loaded with no preflight
  and no config file; `frontend/src/index.css` is the authoritative base
  stylesheet and intentionally overrides some utilities. Check which layer
  serves a class before assuming.
- **Signatures.** Any change touching signature capture, storage, or retrieval
  must preserve the record-keeping requirements in
  [docs/SIGNATURE_POLICY.md](docs/SIGNATURE_POLICY.md) §5 (method flag, raw
  typed name stored as text, method shown at verification and retrieval, never
  rendering a typed name as handwriting).
- **Stable `data-testid`s.** They are the contract for future tests and for
  describing UI unambiguously. Add them to new interactive elements; don't
  rename existing ones without updating the catalog in `docs/DOCUMENTATION.md`.
- **SQLite is the database.** The schema and queries must run on SQLite; don't
  reintroduce PostgreSQL-only SQL (this bit us once — see `40e4bc5`).

## Privacy

Never commit real customer data — names, mailbox assignments, phone numbers,
emails, signatures. Fixtures and examples use invented names, `555-` numbers,
and `example.com` addresses. `*.sqlite` and `*.db` are git-ignored; keep them
that way. The repository history was scrubbed once already (`6ac507f`); let's
not need a second pass.

## Documentation conventions

- Plans, audits, and decisions go into files under `docs/`, not into chat logs
  or issue comments that will be lost. If you make a decision worth
  remembering, write it down with its reasoning.
- Update `CHANGELOG.md` under **Unreleased** in the same PR as the change.
- Keep `docs/ROADMAP.md` honest — tick items when they land, add evidence
  (a commit hash) where the table asks for it.

## Submitting changes

1. Fork and branch from `main` (`git checkout -b fix/short-description`).
2. Make the change. Run the app and exercise the affected flow with the
   keyboard as well as the mouse.
3. Commit with a conventional prefix and a body that says *why*:
   `fix(pickup): …`, `feat(intake): …`, `docs: …`, `chore: …`.
4. Open a pull request. Include: what changed, why, how you verified it, and
   screenshots for anything visible. Note any accessibility considerations.

Small, focused PRs are much easier to review than large ones.

## Security issues

If you find a security problem, email javieribarra.dev@gmail.com rather than
opening a public issue.

## License

By contributing you agree that your contributions are licensed under the MIT
License in [LICENSE](LICENSE).
