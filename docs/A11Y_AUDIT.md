# Accessibility Audit — Interactive Elements & Keyboard (WCAG 2.2 AA)

**Audited:** 2026-08-31, every component under `frontend/src/components/` plus
`App.tsx` and `hooks/`. This is the re-run of the audit that was killed by a
session limit in the original planning session (see [ROADMAP.md](ROADMAP.md),
Phase 3). The companion contrast/motion findings from that session are tracked
in the roadmap itself.

**Verified baseline at audit time:** 6 `aria-*` attributes app-wide; zero
`aria-live`/`role="status"`/`role="alert"`; 4 positive `tabIndex` sites; 2
`alt` attributes (both fine); `index.html` has `lang="en"`; `:focus-visible`
styling exists for native controls.

**Overall shape:** keyboard *operability* is largely intact — the app uses real
`<button>`s and the scanner-first flow (auto-focus, Enter-to-submit, Alt+P/M,
arrow-key dropdowns) is sound and must be preserved. The failures concentrate
in: (a) a completely silent status layer — toasts are the app-wide feedback bus
and screen readers hear none of it; (b) missing name/role/value on every custom
widget (tabs, comboboxes, toggle groups); (c) placeholder-only labeling on
nearly every search input; (d) the four positive tabIndexes; (e) one hard
blocker: signature capture is mouse/touch-only.

**Dead code discovered:** `KeyboardShortcuts.tsx` is mounted nowhere (the
shortcut help overlay never renders); `TenantLookup.tsx` is unreferenced;
`useFocusTrap` and `useFocusFlow` in `useFocus.ts` are exported but consumed by
nothing.

---

## Fix checklist

### High — mechanical (safe batch)

- [x] **H1. Remove all 4 positive tabIndex** — `PackageIntake.tsx` (tracking
      input, submit button), `PackagePickup.tsx` (search input, Proceed button).
      DOM order already matches visual order; scanner auto-focus unaffected. (2.4.3)
- [x] **H2. Name every placeholder-only input** via `aria-label` or `id`/`htmlFor`:
      MailboxLookup search, PackageIntake tracking input, PackagePickup search,
      MailboxSearch search, MailboxList filter, and the four orphaned visible
      labels in SignatureRetrieval (tracking, mailbox, start/end date). (3.3.2)
- [x] **H3. Make toasts audible** — `role="status" aria-live="polite"` on the
      ToastContainer, `role="alert"` on error toasts, real name on the × button.
      Highest-leverage single change in the app. (4.1.3)
- [x] **H4. `aria-pressed` on toggle/filter groups** — PackagePickup status
      filters, SignatureRetrieval mode toggle. (4.1.2)
- [x] **H5. `aria-current` on the active NavigationTabs button** + `aria-label`
      on the nav. (4.1.2)
- [x] **H6. Associate the MailboxLookup error** — `role="alert"` +
      `aria-describedby`/`aria-invalid` wiring. (3.3.1)

### High — needs judgment / testing

- [x] **H7. OfflineStatusBar live region**: keep a persistent `role="status"`
      wrapper mounted (restructure the early return) so offline/sync banners
      are announced. (4.1.3)
- [ ] **H8. Combobox semantics for MailboxLookup** — `role="combobox"`,
      `aria-expanded`, `aria-autocomplete`, `aria-controls`,
      `aria-activedescendant`; listbox/option roles on the dropdown. Test with
      VoiceOver that Enter-on-exact-number still short-circuits. (4.1.2)
- [ ] **H9. Step-flow focus management** — pickup list→verify→signature steps,
      Tools open/back, SignatureRetrieval panel swaps never move focus (focus
      resets to `<body>`; only the verify step has `autoFocus`). Use the
      existing unused `useFocusFlow` hook; focus each step's heading
      (`tabIndex={-1}`). (2.4.3)
- [ ] **H10. Keyboard alternative for signature capture** — canvas is
      mouse/touch-only and Confirm is disabled until a signature exists, so a
      keyboard-only operator cannot complete a pickup at all. Options: typed-name
      fallback rendered/stored as the signature, or a documented alternate path.
      **Product decision needed — the only complete keyboard blocker in the app.** (2.1.1)

### Medium — mechanical

- [x] M1. `scope="col"` on the pickup table's 7 `th`s + accessible table name.
- [ ] M2. Disambiguate repeated button names (`aria-label` with the item's name):
      remove-from-batch, Set Default, per-tenant Edit/Delete, Remove tenant,
      clear-✕ buttons in MailboxSearch/MailboxList, pickup mailbox filter chip.
- [ ] M3. `role="status"` on the remaining silent state blocks: loading spinners
      (PackagePickup, MailboxList, MailboxSearch, SignatureRetrieval,
      MailboxLookup), no-results messages, result counts, signature status,
      intake batch count.
- [x] M4. `<main>` landmark in App.tsx.
- [ ] M5. `role="img"` + `aria-label` on the signature canvas.
- [ ] M6. Fieldset/legend for the tenant radio group (MailboxLookup) and
      per-tenant blocks (MailboxForm).
- [ ] M7. `aria-hidden="true"` on decorative emoji/icon divs (EmptyState,
      AppHeader dot, section headers, Toast icon, banner dots).

### Medium — needs judgment

- [ ] M8. Mount `KeyboardShortcuts` in App (it's currently dead code) with
      open/close focus handling; wire `useFocusTrap` after fixing its defects
      (no focus restoration, no Escape, selector misses `a[href]`/`:disabled`).
- [ ] M9. Pickup row checkbox has a no-op `onChange` (works only via event
      bubbling to the `<tr>` onClick) — make the checkbox the real control with
      `stopPropagation`, keep row-click as mouse convenience; retest both paths.
- [ ] M10. Hover-only package notes (`title` on `<tr>`) need a
      keyboard-reachable rendering.
- [ ] M11. MailboxSearch arrow-key highlight is a second, SR-invisible cursor
      over button cards — adopt a real combobox pattern or drop the custom
      highlight.
- [ ] M12. Toast duration decided by `message.includes('error')` instead of
      `type === 'error'` (bug), and consider pause-on-hover.
- [ ] M13. AppHeader "Online" indicator is hard-coded — it says Online even when
      offline. Drive it from `useOfflineStatus()` or remove it; `aria-hidden`
      the dot.

### Low

- [ ] Heading-level normalization (h4/h5 jumps; h5-inside-button in
      Tools/MailboxList); MailboxLookup Escape handler blurs to `<body>` (keep
      focus in input); Alt-shortcut matching should use `e.code` (Option+P
      types "π" on macOS so Alt+P may never fire on Mac); expand status
      abbreviations (Pick/Ret/RTS); delete or fix dead `TenantLookup.tsx`;
      `aria-describedby` hint associations.

---

*Checked items were fixed in the session of 2026-08-31 — see git log
(`fix(a11y)` commits). The full finding-by-finding detail (file:line, WCAG
criterion, exact fix) for every unchecked item lives in the audit output and
can be regenerated by re-auditing; the checklist above is the source of truth
for what remains.*
