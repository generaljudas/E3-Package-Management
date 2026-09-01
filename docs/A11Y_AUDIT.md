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
- [x] **H8. Combobox semantics for MailboxLookup** — `role="combobox"`,
      `aria-expanded`, `aria-autocomplete`, `aria-controls`,
      `aria-activedescendant`; listbox/option roles on the dropdown. Verified
      programmatically (attributes present, `aria-activedescendant` tracks
      arrow-key highlight) — Enter-on-exact-number path untouched. (4.1.2)
- [x] **H9. Step-flow focus management** — pickup list→verify→signature→confirm
      steps, Tools open/back, SignatureRetrieval panel open/close now move focus
      (heading or container, `tabIndex={-1}`, via a small effect keyed off the
      step/state transition; SignatureRetrieval also restores focus to the
      originating result button on close). Verified in the running app that
      focus lands on the Tools Back button on open and the grid on return.
      Verify step still relies on its existing `autoFocus` input. (2.4.3)
- [x] **H10. Keyboard alternative for signature capture** — resolved by the
      researched decision in [SIGNATURE_POLICY.md](SIGNATURE_POLICY.md): a typed
      name is a legally equivalent signature (E-SIGN/UETA), so the pad now
      offers "Draw signature" / "Type name to sign" (drawn remains default).
      The typed flow has an explicit intent acknowledgment, stores the raw name
      as text plus a `signature_method` flag (never disguised as handwriting),
      and the method is shown at verification and in Signature Retrieval.
      Verified end-to-end in the running app. (2.1.1)

### Medium — mechanical

- [x] M1. `scope="col"` on the pickup table's 7 `th`s + accessible table name.
- [x] M2. Disambiguate repeated button names (`aria-label` with the item's name):
      remove-from-batch, Set Default, per-tenant Edit/Delete, Remove tenant,
      clear-✕ buttons in MailboxSearch/MailboxList, pickup mailbox filter chip.
- [x] M3. `role="status"` on the remaining silent state blocks: loading spinners
      (PackagePickup, MailboxList, MailboxSearch, SignatureRetrieval,
      MailboxLookup), no-results messages, result counts, signature status,
      intake batch count.
- [x] M4. `<main>` landmark in App.tsx.
- [x] M5. `role="img"` + `aria-label` on the signature canvas (label reflects
      empty vs. captured); signature status text also made a live region.
- [x] M6. Tenant grouping given programmatic semantics without changing layout
      (a literal `<fieldset>/<legend>` would force the "Set Default" hint text
      below the heading instead of beside it): MailboxLookup's tenant list is
      `role="radiogroup"` + `aria-labelledby` pointing at the heading;
      MailboxForm's dangling `"Tenants (Optional)"` `<label>` (no control)
      changed to a `<span>` — each tenant sub-block already has a real heading
      and every field already has its own `<label htmlFor>`.
- [x] M7. `aria-hidden="true"` on decorative emoji/icon divs (EmptyState,
      AppHeader dot, section headers, Toast icon, banner dots, Tools icons).

### Medium — needs judgment

- [x] M8. Mounted `KeyboardShortcuts` in App (was dead code) at the bottom of
      `<main>`; added open→focus-Close-button / close→focus-trigger-button
      handling. Left `useFocusTrap` unused — this is a non-modal disclosure
      popover (not a dialog) with one focusable control, so a full trap would
      be overreach; Escape-to-close already existed. Verified in the running
      app: `?` opens it and focus lands on Close.
- [x] M9. Pickup row checkbox's no-op `onChange` replaced with a real handler
      (`togglePackageSelection`) + `stopPropagation` so it no longer depends on
      bubbling to the `<tr>`; both the row click and the checkbox itself now
      toggle exactly once.
- [x] M10. Hover-only package notes folded into the row checkbox's
      `aria-label` (`"Select X, notes: ..."`) instead of a layout change.
- [ ] M11. MailboxSearch arrow-key highlight is a second, SR-invisible cursor
      over button cards — adopt a real combobox pattern or drop the custom
      highlight. **Not done** — same shape as H8 but lower traffic; revisit if
      time allows.
- [x] M12. Toast duration now keys off `type === 'error'` instead of
      `message.includes('error')`.
- [x] M13. AppHeader's indicator now reflects real `useOfflineStatus()` state
      (was hard-coded "Online"); dot marked `aria-hidden`, text is a
      `role="status"` live region.

### Low

- [x] MailboxLookup Escape handler no longer blurs to `<body>` (focus stays in
      the input).
- [ ] Not done: heading-level normalization (h4/h5 jumps; h5-inside-button in
      Tools/MailboxList); Alt-shortcut matching should use `e.code` (Option+P
      types "π" on macOS so Alt+P may never fire on Mac); expand status
      abbreviations (Pick/Ret/RTS); delete or fix dead `TenantLookup.tsx`;
      `aria-describedby` hint associations.

---

*Checked items were fixed in the session of 2026-08-31 — see git log
(`fix(a11y)` commits). The full finding-by-finding detail (file:line, WCAG
criterion, exact fix) for every unchecked item lives in the audit output and
can be regenerated by re-auditing; the checklist above is the source of truth
for what remains.*

**Status: only M11 remains open** (the MailboxSearch arrow-key highlight
pattern — a lower-traffic nit in an already keyboard-operable flow), plus the
Low-priority list. Every High-severity item including H10 is fixed and
verified in the running app: a full typed-signature pickup was driven
end-to-end (select → verify → type name → confirm → retrieve, method shown
throughout), step-transition focus confirmed landing on the right elements,
zero console errors. The signature decision itself is documented in
[SIGNATURE_POLICY.md](SIGNATURE_POLICY.md).
