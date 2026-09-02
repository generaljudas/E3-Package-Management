# Roadmap: "E3 Package Manager, ready for its first stranger"

**Status as of:** 2026-09-01
**Source:** recovered verbatim from a `/grilling` session (2026-08-30) that was cut off by a
session limit before its findings could be delivered. This document is the durable
replacement for that lost conversation — treat it as the source of truth for scope and
sequencing going forward.

---

## Mission

> A mail-center operator with minimal computer knowledge, stuck on abandoned or
> paid-and-buggy software like PostalMate, finds this repo, downloads an installer,
> double-clicks, and is tracking packages — free, open source, effortless.

In the user's own words, from the session that set this scope:

> I want people who are looking to track packages to be able to easily download and
> start using — someone/anyone, minimal computer knowledge required. Someone at a mail
> center often has lots of other work to do, and I want the process of leveling up into
> a dedicated open source free system for package tracking to be effortless. Lots of
> operators use abandoned software or random software. Lots of them are forced to fall
> back to PostalMate offerings, which are limited, buggy, cost money, and more issues
> than I can list.

Everything in this roadmap serves that goal. A future UI visual redesign (via Claude
Design) is explicitly a **separate, later chapter** — this roadmap is markup/behavior
only, not restyling.

---

## Phase status

| Phase | Scope | Status | Evidence |
|---|---|---|---|
| 0 | PII purge from git history | ✅ Done | `6ac507f` |
| 1 | Truth & hygiene pass (README, LICENSE, versions, dead files) | ✅ Done | `dc7fb79` |
| 2 | Make the packaged desktop app actually work | ✅ Done | `c1ea055` |
| 3 | Accessibility to WCAG 2.2 AA | ✅ Done¹ | `fix(a11y)` commits; signature decision in `SIGNATURE_POLICY.md` |
| 4 | Docs restructure, screenshots, GitHub release | 🟡 Nearly done | Docs, screenshots, install guide and release workflow landed 2026-09-01; the `v1.0.0-beta.1` tag and Windows smoke test remain |

¹ One deferred nit: M11 in [A11Y_AUDIT.md](A11Y_AUDIT.md) (MailboxSearch
arrow-key highlight pattern) plus that file's Low list — enhancements to an
already keyboard-operable flow, not blockers.

Phases 0–2 fixed the app itself: the packaged installer used to fail to build, and even
when it did build it hung silently forever (system-`node` spawn that doesn't exist on
end-user machines, backend pointed inside the unreadable asar, DB writing to a read-only
path, blank window from absolute asset paths). None of that touches "easy to install for
a non-technical operator" — it only means the app runs at all once installed. **Phases 3
and 4 are what the mission statement above actually depends on.**

---

## Phase 3 — Accessibility (WCAG 2.2 AA) — in progress

Order of work, per the original plan (each layer blocks the next): keyboard operability →
screen reader → contrast/visible focus → reduced motion. Semantic/markup changes only,
no restyling.

**Baseline audit findings** (repo-wide):
- Only 6 `aria-*` attributes in the entire app
- Zero `aria-live` regions — offline/error toasts are silent to screen readers
- Positive `tabIndex` overrides (anti-pattern) at 4 sites
- Only 2 `alt=` attributes total
- ~298 `<div>` vs ~87 semantic elements
- Zero `prefers-reduced-motion` support

**Contrast/motion audit findings** (completed, never previously delivered —
**all fixed 2026-08-31**, see the `fix(a11y)` commits; ratios verified
programmatically and views verified in the running app):
- [x] **`OfflineStatusBar` renders white-on-white — 1.05:1 contrast, effectively invisible.** Root cause (verified against the built CSS, which contains zero compiled color utilities): the Tailwind utility layer is entirely dead — `src/tailwind.css` still uses v3 `@tailwind` directives and there's a leftover v3 `tailwind.config.js` (with a `tw-` prefix no component actually uses), neither of which Tailwind v4's PostCSS plugin loads. No `bg-*`/`text-*` utility compiles anywhere in the app. This is the sharpest finding: an operator with a queued offline package would see no indication it isn't synced.
- [x] All 4 toast variants fail contrast at their gradient's light stop (worst: warning toast, 2.15:1)
- [x] App header `<h1>` and active nav tabs fail at 3.68:1
- [x] Primary (green submit) and destructive (red delete) buttons fail contrast
- [x] Focus outline is invisible against the header's own blue background
- [x] Input and secondary-button borders sit at 1.24–1.47:1 — no visible boundary
- [x] 17 hardcoded `#9ca3af` muted-text instances fail contrast
- [x] Three undefined CSS custom properties (`--color-gray-400`/`500`) silently break placeholder styling

**Interactive-element / keyboard audit**: re-run from scratch on 2026-08-31 — ~60
findings across 20 components, tracked with their own checklist in
[A11Y_AUDIT.md](A11Y_AUDIT.md). **All of it is now fixed and verified except
one item**: H10, a keyboard alternative for signature capture, is blocked on a
product decision (typed-name fallback vs. documenting mouse/touch/stylus as
required) — see that file for the options. M11 (a lower-traffic combobox
pattern in MailboxSearch) was also left for later.

**Dev-only overlays** (Offline Status debug panel, Test IDs pill) already gated out of
production in Phase 2 — screenshots should no longer show them once retaken.

---

## Phase 4 — Docs, screenshots, release — nearly done

- [x] `docs/DOCUMENTATION.md` written and committed (`f8eaf90`)
- [x] `ALPHA_RELEASE.md` retired in favor of `CHANGELOG.md` (Keep-a-Changelog format,
      every entry cites its commit). The stale root `DOCUMENTATION.md`,
      `SIGNATURE_RETRIEVAL_FEATURE.md` and `MIGRATION_GUIDE.md` went with it — their
      content lives in `docs/DOCUMENTATION.md` and `backend/scripts/README.md`.
- [x] `CONTRIBUTING.md` — setup, standards (keyboard-first, WCAG 2.2 AA, no real
      customer data, SQLite-only SQL), docs conventions, PR process.
- [x] Screenshots retaken 2026-09-01 from the **production build** loaded via `file://`
      (exactly as the packaged app does) against a fresh seeded database: 8 shots,
      3.8MB total, no dev overlays, accessible UI, typed-signature flow and Signature
      Retrieval included. The driver script is reproducible (Electron + DevTools
      protocol, no Playwright) — see the commit for the approach.
      Taking them against a fresh DB **surfaced four broken endpoints** (`GET /packages`,
      `/packages/tenant/:id`, `/packages/tracking/:n`, `/tenants/search` — all
      `no such column: mailbox_number`) and a timezone bug in displayed
      received/pickup times. All fixed; see `CHANGELOG.md`.
- [x] `docs/INSTALL.md` — the "you'll see this warning, here's the two clicks past it"
      guide for SmartScreen and Gatekeeper, plus where the data lives, updating, and
      first-launch troubleshooting.
- [x] Release workflow (`.github/workflows/release.yml`): builds Windows/macOS/Linux
      installers on their own OS runners on a `v*` tag and attaches them to a
      **draft** release. Per-OS builds are mandatory — the native SQLite driver in
      `backend/node_modules` is compiled for the build machine, so a Windows installer
      built from this Mac would not start.
- [ ] Push the `v1.0.0-beta.1` tag, let CI build, paste the CHANGELOG entry into the
      draft release, then publish — Windows first-class, macOS (Apple Silicon only) and
      Linux secondary, all unsigned
- [ ] One manual smoke test of the Windows installer on a real Windows machine before
      the draft is published (install → SmartScreen walkthrough matches INSTALL.md →
      intake → pickup → signature retrieval → quit → relaunch keeps data)

---

## Explicitly out of scope for this chapter

Decided deliberately, not forgotten:
- Code signing (~$99/yr Apple, ~$100–400/yr Windows, or ~$10/mo Azure Trusted Signing) — roadmap item, revisit once there's budget
- Auto-update — roadmap item (also blocked by unsigned macOS builds)
- Automated test suite
- Multi-station PostgreSQL deployment — SQLite single-station is the blessed default; Postgres stays a documented "advanced" option
- Visual UI redesign — separate future chapter, after this one, via Claude Design

---

## Suggested next action

Ship it: push the `v1.0.0-beta.1` tag, watch the three CI builds, download
the Windows installer from the draft release and run the smoke test above
on real Windows hardware, then publish the release with the CHANGELOG entry
as its notes. If the Windows build fails to start, the first suspects are
the native SQLite driver (check the CI job installed `backend` deps on the
Windows runner) and port 3001.
