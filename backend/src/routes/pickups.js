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

    let whereConditions = ['pe.pickup_timestamp >= CURRENT_TIMESTAMP - INTERVAL \'' + parseInt(days) + ' days\''];
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
      JOIN tenants t ON pe.tenant_id = t.id
      JOIN mailboxes m ON t.mailbox_id = m.id
      LEFT JOIN signatures s ON s.pickup_event_id = pe.id
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
      notes,
      staff_initials,
    } = req.body;

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
          updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${updatePlaceholders})
    `,
      package_ids
    );

    // Store signature as Base64-encoded PNG in database
    // Format: "data:image/png;base64,iVBORw0KGgo..." (10-50KB typical)
    let signatureIds = [];
    if (signature_data) {
      for (const packageId of package_ids) {
        try {
          const sigInsert = await dbQuery(
            `
            INSERT INTO signatures (package_id, signature_data)
            VALUES (?, ?)
            ON CONFLICT(package_id) DO UPDATE SET signature_data = excluded.signature_data
            RETURNING id
          `,
            [packageId, signature_data]
          );
          signatureIds.push(sigInsert.rows[0].id);
        } catch (sigError) {
          console.error(`Failed to store signature for package ${packageId}:`, sigError);
          // Continue with pickup even if signature storage fails
        }
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
        s.signature_url
      FROM pickup_events pe
      JOIN packages p ON pe.package_id = p.id
      JOIN tenants t ON pe.tenant_id = t.id
      JOIN mailboxes m ON t.mailbox_id = m.id
      LEFT JOIN signatures s ON s.pickup_event_id = pe.id
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