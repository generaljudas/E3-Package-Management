# Roadmap: "E3 Package Manager, ready for its first stranger"

**Status as of:** 2026-08-31
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
| 3 | Accessibility to WCAG 2.2 AA | ❌ Not started | — |
| 4 | Docs restructure, screenshots, GitHub release | 🟡 Partial | `docs/DOCUMENTATION.md` written, uncommitted |

Phases 0–2 fixed the app itself: the packaged installer used to fail to build, and even
when it did build it hung silently forever (system-`node` spawn that doesn't exist on
end-user machines, backend pointed inside the unreadable asar, DB writing to a read-only
path, blank window from absolute asset paths). None of that touches "easy to install for
a non-technical operator" — it only means the app runs at all once installed. **Phases 3
and 4 are what the mission statement above actually depends on, and neither is done.**

---

## Phase 3 — Accessibility (WCAG 2.2 AA) — not started

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

**Contrast/motion audit findings** (completed, never previously delivered):
- [ ] **`OfflineStatusBar` renders white-on-white — 1.05:1 contrast, effectively invisible.** Root cause (verified against the built CSS, which contains zero compiled color utilities): the Tailwind utility layer is entirely dead — `src/tailwind.css` still uses v3 `@tailwind` directives and there's a leftover v3 `tailwind.config.js` (with a `tw-` prefix no component actually uses), neither of which Tailwind v4's PostCSS plugin loads. No `bg-*`/`text-*` utility compiles anywhere in the app. This is the sharpest finding: an operator with a queued offline package would see no indication it isn't synced.
- [ ] All 4 toast variants fail contrast at their gradient's light stop (worst: warning toast, 2.15:1)
- [ ] App header `<h1>` and active nav tabs fail at 3.68:1
- [ ] Primary (green submit) and destructive (red delete) buttons fail contrast
- [ ] Focus outline is invisible against the header's own blue background
- [ ] Input and secondary-button borders sit at 1.24–1.47:1 — no visible boundary
- [ ] 17 hardcoded `#9ca3af` muted-text instances fail contrast
- [ ] Three undefined CSS custom properties (`--color-gray-400`/`500`) silently break placeholder styling

**Interactive-element / keyboard audit**: dispatched in the original session but killed
by the rate limit before producing any findings. Needs to be run from scratch — covers
click-targets without keyboard handling, unlabeled form controls, dialog/modal focus-trap
coverage, semantic structure.

**Dev-only overlays** (Offline Status debug panel, Test IDs pill) already gated out of
production in Phase 2 — screenshots should no longer show them once retaken.

---

## Phase 4 — Docs, screenshots, release — partial

- [x] `docs/DOCUMENTATION.md` written and committed (references to the not-yet-existing
      `CONTRIBUTING.md`/`CHANGELOG.md` were corrected to point at real files until those
      land)
- [ ] Retire `ALPHA_RELEASE.md` in favor of `CHANGELOG.md`
- [ ] Add `CONTRIBUTING.md`
- [ ] Retake screenshots (current 5 are dated Feb 17 2026, ~6.9MB, taken before Phase 2's
      overlay-gating fix — likely still show "Offline Status (Dev)" / "Test IDs: OFF").
      Add a new Manage Mailboxes & Tenants shot. **Deliberately sequenced after Phase 3**
      so they reflect the accessible UI, not before.
- [ ] Tag and publish `v1.0.0-beta.1` on GitHub Releases — Windows installer first-class,
      macOS/Linux secondary, all unsigned
- [ ] Write an illustrated "you'll see this warning, here's the two clicks past it"
      install guide for unsigned Windows SmartScreen / macOS Gatekeeper
- [ ] Flag the Windows build artifact for one manual smoke test on a real Windows machine

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

1. Start Phase 3 with the contrast fixes above — they're concrete, already diagnosed, and
   the highest-leverage item for the "minimal computer knowledge required" goal (an
   invisible offline indicator is a real trap for the target user).
2. Rerun the interactive-element/keyboard audit that was killed mid-flight.
3. Phase 4 cleanup and release once Phase 3 lands.
