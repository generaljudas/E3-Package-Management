# Signature Retrieval Feature

## Overview
Staff can now search for picked up packages and view their captured signatures along with pickup details.

## Access
Navigate to **Tools → View Package Signatures**

## Search Modes

### 1. Quick Search (Tracking Number)
**Use when:** You know the tracking number
**How to:**
1. Click "Quick Search (Tracking #)" button
2. Enter full or partial tracking number
3. Click "Search"
4. If only one result found, signature displays automatically
5. If multiple results found, select the package to view

**Example:**
- Tracking: "1Z999AA10123456784"
- Can search with "1Z999" or "10123456784"

### 2. Advanced Search (Mailbox + Date Range)
**Use when:** Searching by mailbox and time period
**How to:**
1. Click "Advanced Search (Mailbox + Date)" button
2. Select mailbox from dropdown
3. Set start and end dates (defaults to last 30 days)
4. Click "Search"
5. Select package from results to view signature

**Date Range:**
- Default: Last 30 days
- Can adjust to any custom range

## Package Information Displayed

When viewing a signature, you'll see:
- **Tracking Number**
- **Mailbox Number**
- **Tenant Name**
- **Pickup Date & Time** (formatted: "Oct 15, 2025, 3:45 PM")
- **Picked Up By** (person who picked up the package)
- **Signature Image** (as captured during pickup)

## Features

### Search Results
- Shows all picked up packages matching criteria
- Displays mailbox, tenant, and pickup timestamp
- Click any result to view full details and signature

### Signature Display
- Full package details in organized card
- Large signature image display
- Signature capture timestamp
- Close button to return to results

### Reset Functionality
- "Reset" button clears all search fields
- Resets date range to default (last 30 days)
- Clears any displayed results

## Backend Endpoints

### New Endpoints Added:
1. `GET /api/packages/search` - Search packages by date range, mailbox, status
2. `GET /api/signatures/package/:packageId` - Get signature by package ID

### Query Parameters:
- `start_date` - ISO date string (e.g., "2025-10-01")
- `end_date` - ISO date string (e.g., "2025-10-15")
- `mailbox_id` - Integer mailbox ID
- `status` - Package status (typically "picked_up")

## Technical Details

### Component: `SignatureRetrieval.tsx`
- Location: `frontend/src/components/SignatureRetrieval.tsx`
- State management: React hooks (useState, useEffect, useRef)
- API integration: Uses new helper functions from api.ts

### API Helpers Added:
```typescript
fetchMailboxes() // Load all mailboxes for dropdown
searchPackagesByDateRange() // Search with filters
getSignatureByPackageId() // Retrieve signature data
```

### Data Flow:
1. User enters search criteria
2. Frontend calls `/api/packages/search` with filters
3. Backend queries SQLite database
4. Results displayed as clickable cards
5. On selection, frontend calls `/api/signatures/package/:id`
6. Backend joins signatures with package/tenant/mailbox data
7. Signature image (Base64 PNG) displayed in component

## Test Data IDs

All elements have test IDs for automated testing:
- `signature-retrieval-root` - Main container
- `search-mode-toggle` - Toggle between search modes
- `search-mode-tracking` - Tracking number mode button
- `search-mode-advanced` - Advanced mode button
- `tracking-number-input` - Tracking input field
- `tracking-search-button` - Tracking search submit
- `mailbox-select` - Mailbox dropdown
- `start-date-input` - Start date picker
- `end-date-input` - End date picker
- `advanced-search-button` - Advanced search submit
- `package-result-{id}` - Individual package results
- `signature-display` - Signature viewing area
- `signature-image` - The signature image itself
- `close-signature-button` - Close signature view

## Performance

### Optimizations:
- Mailboxes loaded once on mount
- Default date range limits results (30 days)
- Search limited to 500 results max
- Tracking input auto-focused on mode switch
- Signature loading state prevents multiple requests

### Expected Response Times:
- Mailbox list load: < 100ms (cached)
- Package search: < 300ms (indexed queries)
- Signature load: < 200ms (direct lookup by package_id)

## User Experience

### Empty States:
- No results: Friendly message with search tips
- No signature found: Warning icon with explanation
- Loading: "Loading signature..." indicator

### Visual Feedback:
- Search buttons show "Searching..." state
- Results highlight on hover
- Selected package shown in blue bordered card
- Signature displayed in clean white container

### Date Formatting:
All dates/times formatted as:
- "Oct 15, 2025, 3:45 PM" (locale-aware)

## Future Enhancements (Optional)

Potential additions:
- Print signature button
- Download signature as PNG
- Email signature to tenant
- Signature validation (detect blank signatures)
- Multi-signature comparison view
- Export search results to CSV

## Testing Checklist

- [ ] Quick search with full tracking number
- [ ] Quick search with partial tracking number
- [ ] Advanced search with mailbox only
- [ ] Advanced search with date range
- [ ] Multiple results selection
- [ ] Single result auto-display
- [ ] Signature image loads correctly
- [ ] Package details all populated
- [ ] Date formatting displays correctly
- [ ] Reset button clears all fields
- [ ] No signature found message
- [ ] Mode switching works smoothly
- [ ] Back navigation returns to Tools

## Known Limitations

1. Search limited to 500 results per query
2. Only picks up packages with "picked_up" status
3. Requires signature to have been captured during pickup
4. Cannot edit or delete signatures from this view
5. No bulk operations (view one signature at a time)

## Support

If signatures are missing:
1. Verify package status is "picked_up"
2. Check if signature was captured during pickup
3. Verify database has signature record: 
   ```sql
   SELECT * FROM signatures WHERE package_id = ?
   ```
4. Check backend logs for signature storage errors
