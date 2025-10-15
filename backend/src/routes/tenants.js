import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { query as dbQuery } from '../models/database.js';

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
 * GET /api/tenants
 * Get all active tenants (for preloading into frontend cache)
 * Supports optional mailbox_id query parameter to filter by mailbox
 * Performance target: < 300ms for 200-300 tenants
 */
router.get('/', async (req, res) => {
  try {
    const { mailbox_id } = req.query;
    
    let queryText = `
      SELECT 
        t.id,
        t.mailbox_id,
        t.name,
        t.phone,
        t.email,
        t.notes,
        t.active,
        t.created_at
      FROM tenants t
      WHERE t.active = 1
    `;
    
    const queryParams = [];
    
    // Filter by mailbox_id if provided
    if (mailbox_id) {
      queryParams.push(parseInt(mailbox_id, 10));
      queryText += ` AND t.mailbox_id = $${queryParams.length}`;
    }
    
    queryText += ' ORDER BY t.name';
    
    const result = await dbQuery(queryText, queryParams);

    res.json({
      tenants: result.rows,
      count: result.rows.length,
      cached_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error fetching tenants:', err);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * GET /api/tenants/search
 * Instant search for tenants by mailbox number or name
 * Performance target: < 100ms
 */
router.get('/search', [
  query('q').isLength({ min: 1 }).withMessage('Search query is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const searchQuery = req.query.q.toLowerCase();
    
    const result = await dbQuery(`
      SELECT 
        id,
        mailbox_number,
        name,
        phone,
        email
      FROM tenants 
      WHERE active = 1
        AND (
          LOWER(mailbox_number) LIKE ?
          OR LOWER(name) LIKE ?
        )
      ORDER BY 
        CASE 
          WHEN LOWER(mailbox_number) = ? THEN 1
          WHEN LOWER(mailbox_number) LIKE ? THEN 2
          WHEN LOWER(name) LIKE ? THEN 3
          ELSE 4
        END,
        mailbox_number
      LIMIT 10
    `, [`%${searchQuery}%`, searchQuery]);

    res.json({
      tenants: result.rows,
      query: req.query.q,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error searching tenants:', err);
    res.status(500).json({ error: 'Failed to search tenants' });
  }
});

/**
 * GET /api/tenants/mailbox/:mailboxNumber
 * Get tenant by exact mailbox number (for validation)
 * Performance target: < 100ms
 */
router.get('/mailbox/:mailboxNumber', [
  param('mailboxNumber').isLength({ min: 1 }).withMessage('Mailbox number is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { mailboxNumber } = req.params;
    
    const result = await dbQuery(`
      SELECT 
        id,
        mailbox_number,
        name,
        phone,
        email,
        active
      FROM tenants 
      WHERE mailbox_number = ? AND active = 1
    `, [mailboxNumber]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Tenant not found',
        mailbox_number: mailboxNumber,
      });
    }

    res.json({
      tenant: result.rows[0],
    });
  } catch (err) {
    console.error('Error fetching tenant by mailbox:', err);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

/**
 * GET /api/tenants/:id
 * Get tenant by ID
 */
router.get('/:id', [
  param('id').isInt().withMessage('Tenant ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbQuery(`
      SELECT 
        id,
        mailbox_number,
        name,
        phone,
        email,
        notes,
        active,
        created_at,
        updated_at
      FROM tenants 
      WHERE id = ?
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Tenant not found',
        id: parseInt(id),
      });
    }

    res.json({
      tenant: result.rows[0],
    });
  } catch (err) {
    console.error('Error fetching tenant:', err);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

/**
 * POST /api/tenants
 * Create new tenant
 */
router.post('/', [
  body('mailbox_id')
    .optional()
    .isInt()
    .withMessage('Mailbox ID must be an integer'),
  body('mailbox_number')
    .optional()
    .isLength({ min: 1, max: 10 })
    .withMessage('Mailbox number must be 1-10 characters'),
  body('name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be 1-255 characters'),
  body('phone')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Phone must be 20 characters or less'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email must be valid'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { mailbox_id, mailbox_number, name, phone, email, notes } = req.body;
    
    // Must provide either mailbox_id or mailbox_number
    if (!mailbox_id && !mailbox_number) {
      return res.status(400).json({
        error: 'Either mailbox_id or mailbox_number is required',
      });
    }
    
    let effectiveMailboxId = mailbox_id;
    
    // If mailbox_number provided, look up the mailbox_id
    if (mailbox_number && !mailbox_id) {
      const mailboxResult = await dbQuery(
        'SELECT id FROM mailboxes WHERE mailbox_number = ? AND active = 1',
        [mailbox_number]
      );
      
      if (mailboxResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Mailbox not found',
          mailbox_number,
        });
      }
      
      effectiveMailboxId = mailboxResult.rows[0].id;
    }
    
    // Verify mailbox exists if mailbox_id was provided
    if (mailbox_id && !mailbox_number) {
      const mailboxResult = await dbQuery(
        'SELECT id FROM mailboxes WHERE id = ? AND active = 1',
        [mailbox_id]
      );
      
      if (mailboxResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Mailbox not found',
          mailbox_id,
        });
      }
    }
    
    const result = await dbQuery(`
      INSERT INTO tenants (mailbox_id, name, phone, email, notes)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id, mailbox_id, name, phone, email, notes, active, created_at
    `, [effectiveMailboxId, name, phone || null, email || null, notes || null]);

    res.status(201).json({
      tenant: result.rows[0],
      message: 'Tenant created successfully',
    });
  } catch (err) {
    console.error('Error creating tenant:', err);
    
    // Handle foreign key violation
    if (err.code === '23503') {
      return res.status(404).json({
        error: 'Mailbox not found',
      });
    }
    
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

/**
 * PUT /api/tenants/:id
 * Update existing tenant
 */
router.put('/:id', [
  param('id').isInt().withMessage('Tenant ID must be an integer'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be 1-255 characters'),
  body('phone')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Phone must be 20 characters or less'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email must be valid'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, notes, active } = req.body;
    
    const result = await dbQuery(`
      UPDATE tenants 
      SET 
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        notes = COALESCE(?, notes),
        active = COALESCE(?, active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING id, mailbox_number, name, phone, email, notes, active, updated_at
    `, [name, phone, email, notes, active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Tenant not found',
        id: parseInt(id),
      });
    }

    res.json({
      tenant: result.rows[0],
      message: 'Tenant updated successfully',
    });
  } catch (err) {
    console.error('Error updating tenant:', err);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

/**
 * DELETE /api/tenants/:id
 * Soft delete tenant (set active = false)
 */
router.delete('/:id', [
  param('id').isInt().withMessage('Tenant ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbQuery(`
      UPDATE tenants 
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING id, mailbox_number, name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Tenant not found',
        id: parseInt(id),
      });
    }

    res.json({
      message: 'Tenant deactivated successfully',
      tenant: result.rows[0],
    });
  } catch (err) {
    console.error('Error deactivating tenant:', err);
    res.status(500).json({ error: 'Failed to deactivate tenant' });
  }
});

/**
 * PATCH /api/tenants/mailboxes/:mailboxId/default-tenant
 * Update the default tenant for a mailbox
 * Performance target: < 200ms
 */
router.patch('/mailboxes/:mailboxId/default-tenant', [
  param('mailboxId').isInt().withMessage('Mailbox ID must be an integer'),
  body('default_tenant_id').isInt().withMessage('Default tenant ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  const startTime = Date.now();
  try {
    const { mailboxId } = req.params;
    const { default_tenant_id } = req.body;
    
    console.log(`[SET_DEFAULT_TENANT] START - mailboxId: ${mailboxId}, tenantId: ${default_tenant_id}`);

    // First verify that both mailbox and tenant exist and are related
    const verifyResult = await dbQuery(`
      SELECT m.id as mailbox_id, m.mailbox_number, t.id as tenant_id, t.name as tenant_name
      FROM mailboxes m
      CROSS JOIN tenants t
      WHERE m.id = ? AND t.id = ? AND t.mailbox_id = m.id AND t.active = 1
    `, [parseInt(mailboxId), parseInt(default_tenant_id)]);

    console.log(`[SET_DEFAULT_TENANT] Verification result: ${verifyResult.rows.length} rows`);

    if (verifyResult.rows.length === 0) {
      console.error(`[SET_DEFAULT_TENANT] VERIFICATION FAILED - mailboxId: ${mailboxId}, tenantId: ${default_tenant_id}`);
      // Check what actually exists
      const mailboxCheck = await dbQuery('SELECT id, mailbox_number, active FROM mailboxes WHERE id = ?', [parseInt(mailboxId)]);
      const tenantCheck = await dbQuery('SELECT id, name, mailbox_id, active FROM tenants WHERE id = ?', [parseInt(default_tenant_id)]);
      console.error('[SET_DEFAULT_TENANT] Mailbox exists:', mailboxCheck.rows);
      console.error('[SET_DEFAULT_TENANT] Tenant exists:', tenantCheck.rows);
      
      return res.status(404).json({ 
        error: 'Mailbox not found'
      });
    }

    // Update the default tenant for the mailbox
    const updateResult = await dbQuery(`
      UPDATE mailboxes 
      SET default_tenant_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING id, mailbox_number, default_tenant_id, updated_at
    `, [parseInt(default_tenant_id), parseInt(mailboxId)]);

    if (updateResult.rows.length === 0) {
      console.error(`[SET_DEFAULT_TENANT] UPDATE FAILED - no rows returned`);
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    const duration = Date.now() - startTime;
    console.log(`[SET_DEFAULT_TENANT] SUCCESS - mailbox ${mailboxId} updated in ${duration}ms`);

    res.json({
      message: 'Default tenant updated successfully',
      mailbox: updateResult.rows[0],
      tenant: {
        id: verifyResult.rows[0].tenant_id,
        name: verifyResult.rows[0].tenant_name,
      },
    });
  } catch (err) {
    console.error('[SET_DEFAULT_TENANT] ERROR:', err);
    res.status(500).json({ error: 'Failed to update default tenant' });
  }
});

/**
 * PATCH /api/tenants/mailboxes/by-number/:mailboxNumber/default-tenant
 * Update the default tenant for a mailbox by mailbox_number
 * In development, will create the mailbox if it doesn't exist to support mocked data
 */
router.patch('/mailboxes/by-number/:mailboxNumber/default-tenant', [
  param('mailboxNumber').isLength({ min: 1 }).withMessage('Mailbox number is required'),
  body('default_tenant_id').isInt().withMessage('Default tenant ID must be an integer'),
  body('tenant_name').optional().isLength({ min: 1, max: 255 }).withMessage('Tenant name must be 1-255 characters'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { mailboxNumber } = req.params;
    const { default_tenant_id, tenant_name } = req.body;

    // Ensure tenant exists and is active
    const tenantResult = await dbQuery(
      'SELECT id, name, mailbox_id, active FROM tenants WHERE id = ?',
      [parseInt(default_tenant_id)]
    );

    let effectiveTenantId = parseInt(default_tenant_id);
    let effectiveTenantName = tenantResult.rows[0]?.name;
    if (tenantResult.rows.length === 0 || tenantResult.rows[0].active === false) {
      // In development: create the tenant if missing
      if ((process.env.NODE_ENV || 'development') !== 'production') {
        // Find or create mailbox first
        let mailboxResult = await dbQuery(
          'SELECT id, mailbox_number FROM mailboxes WHERE mailbox_number = ?',
          [mailboxNumber]
        );
        if (mailboxResult.rows.length === 0) {
          const createMailbox = await dbQuery(
            `INSERT INTO mailboxes (mailbox_number, active) VALUES (?, 1) RETURNING id, mailbox_number`,
            [mailboxNumber]
          );
          mailboxResult = createMailbox;
        }
        const mb = mailboxResult.rows[0];
        const nameToUse = tenant_name && tenant_name.trim().length > 0 ? tenant_name.trim() : `Default Tenant ${mailboxNumber}`;
        const createTenant = await dbQuery(
          `INSERT INTO tenants (mailbox_id, name, phone, email, active)
           VALUES (?, ?, NULL, NULL, 1)
           RETURNING id, name`,
          [mb.id, nameToUse]
        );
        effectiveTenantId = createTenant.rows[0].id;
        effectiveTenantName = createTenant.rows[0].name;
      } else {
        return res.status(404).json({ error: 'Tenant not found or inactive' });
      }
    }

    // Find mailbox by number
    let mailboxResult = await dbQuery(
      'SELECT id, mailbox_number, default_tenant_id FROM mailboxes WHERE mailbox_number = ?',
      [mailboxNumber]
    );

    // In development, create mailbox if missing to support mocked data
    if (mailboxResult.rows.length === 0) {
      if ((process.env.NODE_ENV || 'development') !== 'production') {
        const createResult = await dbQuery(`
          INSERT INTO mailboxes (mailbox_number, active)
          VALUES (?, 1)
          RETURNING id, mailbox_number, default_tenant_id
        `, [mailboxNumber]);
        mailboxResult = createResult;
      } else {
        return res.status(404).json({ error: 'Mailbox not found' });
      }
    }

  const mailbox = mailboxResult.rows[0];

    // Update default tenant
    const updateResult = await dbQuery(`
      UPDATE mailboxes 
      SET default_tenant_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING id, mailbox_number, default_tenant_id, updated_at
  `, [effectiveTenantId, mailbox.id]);

    return res.json({
      message: 'Default tenant updated successfully',
      mailbox: updateResult.rows[0],
      tenant: {
        id: effectiveTenantId,
        name: effectiveTenantName,
      },
    });
  } catch (err) {
    console.error('Error updating default tenant by number:', err);
    res.status(500).json({ error: 'Failed to update default tenant' });
  }
});

export default router;