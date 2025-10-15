import express from 'express';
import { body, param, validationResult } from 'express-validator';
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
 * GET /api/mailboxes
 * Get all mailboxes
 */
router.get('/', async (req, res) => {
  try {
    const result = await dbQuery(`
      SELECT 
        m.id,
        m.mailbox_number,
        m.default_tenant_id,
        m.notes,
        m.active,
        m.created_at,
        m.updated_at,
        t.name as default_tenant_name
      FROM mailboxes m
      LEFT JOIN tenants t ON m.default_tenant_id = t.id
      WHERE m.active = 1
      ORDER BY CAST(m.mailbox_number AS INTEGER)
    `);

    res.json({
      mailboxes: result.rows,
      count: result.rows.length,
      cached_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error fetching mailboxes:', err);
    res.status(500).json({ error: 'Failed to fetch mailboxes' });
  }
});

/**
 * GET /api/mailboxes/:id
 * Get mailbox by ID
 */
router.get('/:id', [
  param('id').isInt().withMessage('Mailbox ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbQuery(
      `SELECT 
        m.id,
        m.mailbox_number,
        m.default_tenant_id,
        m.notes,
        m.active,
        m.created_at,
        m.updated_at,
        t.name as default_tenant_name
      FROM mailboxes m
      LEFT JOIN tenants t ON m.default_tenant_id = t.id
      WHERE m.id = ?`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    res.json({ mailbox: result.rows[0] });
  } catch (err) {
    console.error('Error fetching mailbox:', err);
    res.status(500).json({ error: 'Failed to fetch mailbox' });
  }
});

/**
 * POST /api/mailboxes
 * Create new mailbox
 */
router.post('/', [
  body('mailbox_number')
    .trim()
    .notEmpty()
    .withMessage('Mailbox number is required'),
  body('notes')
    .optional()
    .trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { mailbox_number, notes } = req.body;

    // Check if mailbox number already exists
    const existing = await dbQuery(
      'SELECT id FROM mailboxes WHERE mailbox_number = ?',
      [mailbox_number]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'Mailbox number already exists',
        details: `Mailbox ${mailbox_number} is already in the system`,
      });
    }

    // Insert new mailbox
    const result = await dbQuery(
      `INSERT INTO mailboxes (mailbox_number, notes, active, created_at)
       VALUES (?, ?, 1, CURRENT_TIMESTAMP)
       RETURNING 
         id,
         mailbox_number,
         default_tenant_id,
         notes,
         active,
         created_at`,
      [mailbox_number, notes || null]
    );

    res.status(201).json({
      mailbox: result.rows[0],
      message: `Mailbox ${mailbox_number} created successfully`,
    });
  } catch (err) {
    console.error('Error creating mailbox:', err);
    res.status(500).json({ error: 'Failed to create mailbox' });
  }
});

/**
 * PUT /api/mailboxes/:id
 * Update mailbox
 */
router.put('/:id', [
  param('id').isInt().withMessage('Mailbox ID must be an integer'),
  body('mailbox_number')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Mailbox number cannot be empty'),
  body('default_tenant_id')
    .optional()
    .isInt()
    .withMessage('Default tenant ID must be an integer'),
  body('notes')
    .optional()
    .trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if mailbox exists
    const existing = await dbQuery(
      'SELECT id FROM mailboxes WHERE id = ?',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    // If mailbox_number is being updated, check it doesn't conflict
    if (updates.mailbox_number) {
      const conflict = await dbQuery(
        'SELECT id FROM mailboxes WHERE mailbox_number = ? AND id != ?',
        [updates.mailbox_number, id]
      );

      if (conflict.rows.length > 0) {
        return res.status(400).json({
          error: 'Mailbox number already exists',
          details: `Mailbox ${updates.mailbox_number} is already in use`,
        });
      }
    }

    // Build update query dynamically
    const fields = [];
    const values = [];

    if (updates.mailbox_number !== undefined) {
      fields.push(`mailbox_number = ?`);
      values.push(updates.mailbox_number);
    }
    if (updates.default_tenant_id !== undefined) {
      fields.push(`default_tenant_id = ?`);
      values.push(updates.default_tenant_id);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = ?`);
      values.push(updates.notes);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await dbQuery(
      `UPDATE mailboxes 
       SET ${fields.join(', ')}
       WHERE id = ?
       RETURNING 
         id,
         mailbox_number,
         default_tenant_id,
         notes,
         active,
         created_at,
         updated_at`,
      values
    );

    res.json({
      mailbox: result.rows[0],
      message: 'Mailbox updated successfully',
    });
  } catch (err) {
    console.error('Error updating mailbox:', err);
    res.status(500).json({ error: 'Failed to update mailbox' });
  }
});

/**
 * DELETE /api/mailboxes/:id
 * Delete mailbox (hard delete - permanently removes from database)
 * Also permanently deletes all associated tenants
 */
router.delete('/:id', [
  param('id').isInt().withMessage('Mailbox ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;

    // Check if mailbox exists
    const existing = await dbQuery(
      'SELECT mailbox_number FROM mailboxes WHERE id = ?',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    // Permanently delete all tenants in this mailbox
    await dbQuery(
      'DELETE FROM tenants WHERE mailbox_id = ?',
      [id]
    );

    // Permanently delete the mailbox
    await dbQuery(
      'DELETE FROM mailboxes WHERE id = ?',
      [id]
    );

    res.json({
      message: `Mailbox ${existing.rows[0].mailbox_number} and all associated tenants permanently deleted`,
    });
  } catch (err) {
    console.error('Error deleting mailbox:', err);
    res.status(500).json({ error: 'Failed to delete mailbox' });
  }
});

export default router;
