import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { query as dbQuery, transaction } from '../models/database.js';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

/**
 * GET /api/pickups
 * Get pickup events (audit trail)
 * Performance target: < 500ms for 30 days of data
 */
router.get('/', async (req, res) => {
  try {
    const {
      tenant_id,
      days = 30,
      limit = 100,
      offset = 0,
    } = req.query;

    let whereConditions = [`pe.pickup_timestamp >= datetime('now', '-${parseInt(days)} days')`];
    let params = [];
    let paramCount = 0;

    if (tenant_id) {
      paramCount++;
      whereConditions.push(`pe.tenant_id = $${paramCount}`);
      params.push(parseInt(tenant_id));
    }

    // Add limit and offset
    paramCount++;
    const limitParam = `$${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    const offsetParam = `$${paramCount}`;
    params.push(parseInt(offset));

    const result = await dbQuery(`
      SELECT 
        pe.id,
        pe.pickup_person_name,
        pe.signature_required,
        pe.signature_captured,
        pe.notes,
        pe.staff_initials,
        pe.pickup_timestamp,
        p.id as package_id,
        p.tracking_number,
        p.high_value,
        m.mailbox_number,
        t.name as tenant_name,
        CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END as has_signature
      FROM pickup_events pe
      JOIN packages p ON pe.package_id = p.id
      LEFT JOIN tenants t ON pe.tenant_id = t.id
      JOIN mailboxes m ON p.mailbox_id = m.id
      LEFT JOIN signatures s ON s.package_id = pe.package_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY pe.pickup_timestamp DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, params);

    res.json({
      pickup_events: result.rows,
      filters: {
        tenant_id: tenant_id ? parseInt(tenant_id) : null,
        days: parseInt(days),
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (err) {
    console.error('Error fetching pickup events:', err);
    res.status(500).json({ error: 'Failed to fetch pickup events' });
  }
});

/**
 * POST /api/pickups
 * Process package pickup (with optional signature)
 * Performance target: < 500ms including signature upload
 */
router.post('/', [
  body('package_ids')
    .isArray({ min: 1 })
    .withMessage('Package IDs array is required'),
  body('package_ids.*')
    .isInt({ min: 1 })
    .withMessage('All package IDs must be positive integers'),
  body('mailbox_id')
    .isInt({ min: 1 })
    .withMessage('Valid mailbox ID is required'),
  body('tenant_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Tenant ID must be a positive integer if provided'),
  body('pickup_person_name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Pickup person name is required (1-255 characters)'),
  body('signature_data')
    .optional()
    .isString()
    .withMessage('Signature data must be a string'),
  body('signature_method')
    .optional()
    .isIn(['drawn', 'typed'])
    .withMessage("Signature method must be 'drawn' or 'typed'"),
  body('typed_name')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Typed name must be 255 characters or less'),
  body('staff_initials')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Staff initials must be 10 characters or less'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const {
      package_ids,
      mailbox_id,
      tenant_id,
      pickup_person_name,
      signature_data,
      signature_method,
      typed_name,
      notes,
      staff_initials,
    } = req.body;

    // A typed signature must carry the raw typed name — the text is the
    // signature; the image is only a view of it (docs/SIGNATURE_POLICY.md).
    if (signature_method === 'typed' && (!typed_name || !typed_name.trim())) {
      return res.status(400).json({
        error: "A typed signature requires 'typed_name'",
      });
    }

    // Verify all packages belong to the specified mailbox
    // Allow cross-tenant pickup - real-world mailbox behavior
    // Someone from the mailbox can pick up all packages for that mailbox
    const placeholders = package_ids.map(() => '?').join(',');
    const packageVerifyResult = await dbQuery(`
      SELECT 
        p.id,
        p.tracking_number,
        p.status,
        p.high_value,
        p.tenant_id,
        t.name as tenant_name,
        t.mailbox_id,
        m.mailbox_number
      FROM packages p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      JOIN mailboxes m ON p.mailbox_id = m.id
      WHERE p.id IN (${placeholders}) AND m.id = ?
    `, [...package_ids, mailbox_id]);

    if (packageVerifyResult.rows.length !== package_ids.length) {
      return res.status(400).json({
        error: 'Invalid packages or mailbox mismatch',
        expected_count: package_ids.length,
        found_count: packageVerifyResult.rows.length,
        details: 'All packages must belong to the specified mailbox',
      });
    }

    // Check if any packages are already picked up
    const alreadyPickedUp = packageVerifyResult.rows.filter(
      pkg => pkg.status === 'picked_up'
    );
    
    if (alreadyPickedUp.length > 0) {
      return res.status(400).json({
        error: 'Some packages are already picked up',
        already_picked_up: alreadyPickedUp.map(pkg => ({
          id: pkg.id,
          tracking_number: pkg.tracking_number,
        })),
      });
    }

    // Determine if signature is required (high-value packages)
    const highValuePackages = packageVerifyResult.rows.filter(pkg => pkg.high_value);
    const signatureRequired = highValuePackages.length > 0;
    const signatureCaptured = signatureRequired && !!signature_data;

    if (signatureRequired && !signature_data) {
      return res.status(400).json({
        error: 'Signature required for high-value packages',
        high_value_packages: highValuePackages.map(pkg => ({
          id: pkg.id,
          tracking_number: pkg.tracking_number,
        })),
      });
    }

    // Update packages to 'picked_up' status
    const updatePlaceholders = package_ids.map(() => '?').join(',');
    await dbQuery(
      `
      UPDATE packages
      SET status = 'picked_up',
          picked_up_at = CURRENT_TIMESTAMP,
          pickup_by = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${updatePlaceholders})
    `,
      [pickup_person_name, ...package_ids]
    );

    // Store signature as Base64-encoded PNG in database
    // Format: "data:image/png;base64,iVBORw0KGgo..." (10-50KB typical)
    let signatureIds = [];
    const signatureIdByPackage = new Map();
    if (signature_data) {
      for (const packageId of package_ids) {
        try {
          await dbQuery(
            `
            INSERT INTO signatures (package_id, signature_data, signature_method, typed_name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(package_id) DO UPDATE SET
              signature_data = excluded.signature_data,
              signature_method = excluded.signature_method,
              typed_name = excluded.typed_name
          `,
            [packageId, signature_data, signature_method || 'drawn', typed_name || null]
          );
          // Re-select rather than trusting lastID: on the upsert's UPDATE
          // path SQLite does not refresh last_insert_rowid()
          const sigRow = await dbQuery(
            `SELECT id FROM signatures WHERE package_id = ?`,
            [packageId]
          );
          signatureIds.push(sigRow.rows[0].id);
          signatureIdByPackage.set(packageId, sigRow.rows[0].id);
        } catch (sigError) {
          console.error(`Failed to store signature for package ${packageId}:`, sigError);
          // Continue with pickup even if signature storage fails
        }
      }
    }

    // Record the pickup event per package — this is the audit trail the
    // history/reports endpoints read, and the attribution record (who picked
    // up, witnessed by which staff member, when) that gives the signature its
    // evidentiary weight (docs/SIGNATURE_POLICY.md §5).
    const packageById = new Map(packageVerifyResult.rows.map((pkg) => [pkg.id, pkg]));
    for (const packageId of package_ids) {
      const pkg = packageById.get(packageId);
      try {
        await dbQuery(
          `
          INSERT INTO pickup_events (
            package_id, tenant_id, mailbox_id, pickup_person_name, picked_up_by,
            signature_id, signature_required, signature_captured, staff_initials,
            notes, pickup_timestamp, picked_up_at, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
          [
            packageId,
            pkg?.tenant_id ?? tenant_id ?? null,
            mailbox_id,
            pickup_person_name,
            pickup_person_name,
            signatureIdByPackage.get(packageId) ?? null,
            signatureRequired ? 1 : 0,
            signatureIdByPackage.has(packageId) ? 1 : 0,
            staff_initials || null,
            notes || null,
          ]
        );
      } catch (eventError) {
        console.error(`Failed to record pickup event for package ${packageId}:`, eventError);
        // Continue — the package status update already succeeded
      }
    }

    // Get unique tenant names for summary
    const uniqueTenants = [...new Set(packageVerifyResult.rows.map(pkg => pkg.tenant_name))];
    const tenantSummary = uniqueTenants.length === 1 
      ? uniqueTenants[0] 
      : `${uniqueTenants.length} tenants`;

    return res.json({
      success: true,
      message: 'Package pickup processed successfully',
      pickup_summary: {
        packages_picked_up: package_ids.length,
        tenant_name: tenantSummary,
        tenant_mailbox: packageVerifyResult.rows[0].mailbox_number,
        pickup_person: pickup_person_name,
        signature_required: signatureRequired,
        signature_captured: !!signature_data && signatureIds.length > 0,
        signature_ids: signatureIds,
        staff_initials,
        pickup_timestamp: new Date().toISOString(),
        cross_tenant_pickup: uniqueTenants.length > 1,
      },
      packages: packageVerifyResult.rows.map((pkg) => ({
        id: pkg.id,
        tracking_number: pkg.tracking_number,
        status: 'picked_up',
        tenant_name: pkg.tenant_name,
      })),
    });
  } catch (err) {
    console.error('Error processing pickup:', err);
    res.status(500).json({ error: 'Failed to process pickup' });
  }
});

/**
 * GET /api/pickups/:id
 * Get specific pickup event details
 */
router.get('/:id', [
  param('id').isInt().withMessage('Pickup event ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbQuery(`
      SELECT 
        pe.id,
        pe.pickup_person_name,
        pe.signature_required,
        pe.signature_captured,
        pe.notes,
        pe.staff_initials,
        pe.pickup_timestamp,
        p.id as package_id,
        p.tracking_number,
        p.high_value,
        p.carrier,
        p.size_category,
        t.id as tenant_id,
        m.mailbox_number,
        t.name as tenant_name,
        t.phone as tenant_phone,
        s.id as signature_id,
        s.signature_method,
        s.typed_name
      FROM pickup_events pe
      JOIN packages p ON pe.package_id = p.id
      LEFT JOIN tenants t ON pe.tenant_id = t.id
      JOIN mailboxes m ON p.mailbox_id = m.id
      LEFT JOIN signatures s ON s.package_id = pe.package_id
      WHERE pe.id = ?
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Pickup event not found',
        id: parseInt(id),
      });
    }

    res.json({
      pickup_event: result.rows[0],
    });
  } catch (err) {
    console.error('Error fetching pickup event:', err);
    res.status(500).json({ error: 'Failed to fetch pickup event' });
  }
});

/**
 * POST /api/pickups/bulk-status
 * Update multiple packages to ready_for_pickup status
 */
router.post('/bulk-status', [
  body('package_ids')
    .isArray({ min: 1 })
    .withMessage('Package IDs array is required'),
  body('package_ids.*')
    .isInt({ min: 1 })
    .withMessage('All package IDs must be positive integers'),
  body('status')
    .isIn(['ready_for_pickup', 'returned_to_sender'])
    .withMessage('Status must be ready_for_pickup or returned_to_sender'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { package_ids, status, notes } = req.body;

    const bulkPlaceholders = package_ids.map(() => '?').join(',');
    const result = await dbQuery(`
      UPDATE packages 
      SET status = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${bulkPlaceholders}) AND status IN ('received', 'ready_for_pickup')
      RETURNING id, tracking_number, status
    `, [status, notes, ...package_ids]);

    res.json({
      message: `${result.rows.length} packages updated to ${status}`,
      updated_packages: result.rows,
      requested_count: package_ids.length,
      updated_count: result.rows.length,
    });
  } catch (err) {
    console.error('Error updating package statuses:', err);
    res.status(500).json({ error: 'Failed to update package statuses' });
  }
});

export default router;