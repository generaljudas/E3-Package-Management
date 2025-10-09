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

    let whereConditions = ['pe.pickup_timestamp >= NOW() - INTERVAL \'' + parseInt(days) + ' days\''];
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
        t.mailbox_number,
        t.name as tenant_name,
        CASE WHEN s.id IS NOT NULL THEN TRUE ELSE FALSE END as has_signature
      FROM pickup_events pe
      JOIN packages p ON pe.package_id = p.id
      JOIN tenants t ON pe.tenant_id = t.id
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
  body('tenant_id')
    .isInt({ min: 1 })
    .withMessage('Valid tenant ID is required'),
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
      tenant_id,
      pickup_person_name,
      signature_data,
      notes,
      staff_initials,
    } = req.body;

    // Verify tenant exists and owns all packages
    const packageVerifyResult = await dbQuery(`
      SELECT 
        p.id,
        p.tracking_number,
        p.status,
        p.high_value,
        t.name as tenant_name,
        t.mailbox_number
      FROM packages p
      JOIN tenants t ON p.tenant_id = t.id
      WHERE p.id = ANY($1) AND p.tenant_id = $2 AND t.active = TRUE
    `, [package_ids, tenant_id]);

    if (packageVerifyResult.rows.length !== package_ids.length) {
      return res.status(400).json({
        error: 'Invalid packages or tenant mismatch',
        expected_count: package_ids.length,
        found_count: packageVerifyResult.rows.length,
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

    try {
      // Process pickup in a transaction using pickup_events/signatures if available
      const queries = [];
      // Update all packages to 'picked_up'
      queries.push({
        text: `
          UPDATE packages 
          SET status = 'picked_up', picked_up_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1)
        `,
        params: [package_ids],
      });

      // Create pickup events for each package
      for (const packageId of package_ids) {
        queries.push({
          text: `
            INSERT INTO pickup_events (
              package_id,
              tenant_id,
              pickup_person_name,
              signature_required,
              signature_captured,
              notes,
              staff_initials
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `,
          params: [
            packageId,
            tenant_id,
            pickup_person_name,
            signatureRequired,
            signatureCaptured,
            notes || null,
            staff_initials || null,
          ],
        });
      }

      const results = await transaction(queries);

      // If signature was provided, save it for the first pickup event
      let signatureId = null;
      if (signatureCaptured) {
        const pickupEventIds = results.slice(1).map(result => result.rows[0].id);
        const signatureResult = await dbQuery(`
          INSERT INTO signatures (pickup_event_id, signature_data)
          VALUES ($1, $2)
          RETURNING id
        `, [pickupEventIds[0], signature_data]);
        signatureId = signatureResult.rows[0].id;
      }

      return res.json({
        success: true,
        message: 'Package pickup processed successfully',
        pickup_summary: {
          packages_picked_up: package_ids.length,
          tenant_name: packageVerifyResult.rows[0].tenant_name,
          tenant_mailbox: packageVerifyResult.rows[0].mailbox_number,
          pickup_person: pickup_person_name,
          signature_required: signatureRequired,
          signature_captured: signatureCaptured,
          signature_id: signatureId,
          staff_initials,
          pickup_timestamp: new Date().toISOString(),
        },
        packages: packageVerifyResult.rows.map(pkg => ({
          id: pkg.id,
          tracking_number: pkg.tracking_number,
          status: 'picked_up',
        })),
      });
    } catch (dbErr) {
      // Fallback path if pickup_events/signatures tables or columns are missing
      // (e.g., relation not found 42P01 or column not found 42703)
      if (dbErr && (dbErr.code === '42P01' || dbErr.code === '42703')) {
        // Minimal completion: update packages and store signature on package rows if possible
        await dbQuery(`
          UPDATE packages
          SET status = 'picked_up',
              picked_up_at = CURRENT_TIMESTAMP,
              pickup_signature = COALESCE($2, pickup_signature),
              pickup_date = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1)
        `, [package_ids, signature_data || null]);

        return res.json({
          success: true,
          message: 'Package pickup processed successfully',
          pickup_summary: {
            packages_picked_up: package_ids.length,
            tenant_name: packageVerifyResult.rows[0].tenant_name,
            tenant_mailbox: packageVerifyResult.rows[0].mailbox_number,
            pickup_person: pickup_person_name,
            signature_required: signatureRequired,
            signature_captured: !!signature_data,
            signature_id: null,
            staff_initials,
            pickup_timestamp: new Date().toISOString(),
          },
          packages: packageVerifyResult.rows.map(pkg => ({
            id: pkg.id,
            tracking_number: pkg.tracking_number,
            status: 'picked_up',
          })),
        });
      }
      throw dbErr;
    }
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
        t.mailbox_number,
        t.name as tenant_name,
        t.phone as tenant_phone,
        s.id as signature_id,
        s.signature_url
      FROM pickup_events pe
      JOIN packages p ON pe.package_id = p.id
      JOIN tenants t ON pe.tenant_id = t.id
      LEFT JOIN signatures s ON s.pickup_event_id = pe.id
      WHERE pe.id = $1
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

    const result = await dbQuery(`
      UPDATE packages 
      SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($3) AND status IN ('received', 'ready_for_pickup')
      RETURNING id, tracking_number, status
    `, [status, notes, package_ids]);

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