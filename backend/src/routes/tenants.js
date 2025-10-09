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
 * Performance target: < 300ms for 200-300 tenants
 */
router.get('/', async (req, res) => {
  try {
    const result = await dbQuery(`
      SELECT 
        id,
        mailbox_number,
        name,
        phone,
        email,
        active,
        created_at
      FROM tenants 
      WHERE active = TRUE
      ORDER BY CAST(mailbox_number AS INTEGER)
    `);

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
      WHERE active = TRUE
        AND (
          LOWER(mailbox_number) LIKE $1
          OR LOWER(name) LIKE $1
        )
      ORDER BY 
        CASE 
          WHEN LOWER(mailbox_number) = $2 THEN 1
          WHEN LOWER(mailbox_number) LIKE $1 THEN 2
          WHEN LOWER(name) LIKE $1 THEN 3
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
      WHERE mailbox_number = $1 AND active = TRUE
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
      WHERE id = $1
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
  body('mailbox_number')
    .isLength({ min: 1, max: 10 })
    .withMessage('Mailbox number is required and must be 1-10 characters'),
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
    const { mailbox_number, name, phone, email, notes } = req.body;
    
    // Check if mailbox number already exists
    const existingResult = await dbQuery(
      'SELECT id FROM tenants WHERE mailbox_number = $1',
      [mailbox_number]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Mailbox number already exists',
        mailbox_number,
      });
    }
    
    const result = await dbQuery(`
      INSERT INTO tenants (mailbox_number, name, phone, email, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, mailbox_number, name, phone, email, notes, active, created_at
    `, [mailbox_number, name, phone || null, email || null, notes || null]);

    res.status(201).json({
      tenant: result.rows[0],
      message: 'Tenant created successfully',
    });
  } catch (err) {
    console.error('Error creating tenant:', err);
    
    // Handle unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Mailbox number already exists',
        mailbox_number: req.body.mailbox_number,
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
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        notes = COALESCE($4, notes),
        active = COALESCE($5, active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
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
      SET active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
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
  try {
    const { mailboxId } = req.params;
    const { default_tenant_id } = req.body;

    // First verify that both mailbox and tenant exist and are related
    const verifyResult = await dbQuery(`
      SELECT m.id as mailbox_id, m.mailbox_number, t.id as tenant_id, t.name as tenant_name
      FROM mailboxes m
      CROSS JOIN tenants t
      WHERE m.id = $1 AND t.id = $2 AND t.mailbox_id = m.id AND t.active = TRUE
    `, [parseInt(mailboxId), parseInt(default_tenant_id)]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Mailbox or tenant not found, or tenant not associated with mailbox' 
      });
    }

    // Update the default tenant for the mailbox
    const updateResult = await dbQuery(`
      UPDATE mailboxes 
      SET default_tenant_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, mailbox_number, default_tenant_id, updated_at
    `, [parseInt(mailboxId), parseInt(default_tenant_id)]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    res.json({
      message: 'Default tenant updated successfully',
      mailbox: updateResult.rows[0],
      tenant: {
        id: verifyResult.rows[0].tenant_id,
        name: verifyResult.rows[0].tenant_name,
      },
    });
  } catch (err) {
    console.error('Error updating default tenant:', err);
    res.status(500).json({ error: 'Failed to update default tenant' });
  }
});

export default router;