import express from 'express';
import { param, validationResult } from 'express-validator';
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
 * GET /api/signatures/:id
 * Get signature by ID
 */
router.get('/:id', [
  param('id').isInt().withMessage('Signature ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbQuery(`
      SELECT 
        s.id,
        s.package_id,
        s.signature_data,
        s.created_at,
        p.tracking_number,
        p.status,
        p.picked_up_at as pickup_date,
        p.pickup_by,
        t.name as tenant_name,
        m.mailbox_number,
        pe.pickup_person_name
      FROM signatures s
      JOIN packages p ON s.package_id = p.id
      LEFT JOIN pickup_events pe ON s.pickup_event_id = pe.id
      LEFT JOIN tenants t ON p.tenant_id = t.id
      LEFT JOIN mailboxes m ON p.mailbox_id = m.id
      WHERE s.id = ?
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Signature not found',
        id: parseInt(id),
      });
    }

    res.json({
      signature: result.rows[0],
    });
  } catch (err) {
    console.error('Error fetching signature:', err);
    res.status(500).json({ error: 'Failed to fetch signature' });
  }
});

/**
 * GET /api/signatures/package/:packageId
 * Get signature by package ID
 */
router.get('/package/:packageId', [
  param('packageId').isInt().withMessage('Package ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { packageId } = req.params;
    
    const result = await dbQuery(`
      SELECT 
        s.id, s.package_id, s.signature_data, s.created_at,
        p.tracking_number, p.status, p.picked_up_at as pickup_date,
        p.pickup_by,
        t.name as tenant_name, m.mailbox_number,
        pe.pickup_person_name
      FROM signatures s
      JOIN packages p ON s.package_id = p.id
      LEFT JOIN pickup_events pe ON s.pickup_event_id = pe.id
      LEFT JOIN tenants t ON p.tenant_id = t.id
      LEFT JOIN mailboxes m ON p.mailbox_id = m.id
      WHERE s.package_id = ?
    `, [packageId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Signature not found for this package',
        package_id: parseInt(packageId),
      });
    }

    res.json({
      signature: result.rows[0],
    });
  } catch (err) {
    console.error('Error fetching signature by package:', err);
    res.status(500).json({ error: 'Failed to fetch signature' });
  }
});

/**
 * GET /api/signatures/image/:id
 * Get signature image data (base64 or redirect to URL)
 */
router.get('/image/:id', [
  param('id').isInt().withMessage('Signature ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbQuery(`
      SELECT signature_data, signature_url
      FROM signatures
      WHERE id = ?
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Signature not found',
        id: parseInt(id),
      });
    }

    const { signature_data, signature_url } = result.rows[0];

    // If we have a URL (cloud storage), redirect to it
    if (signature_url) {
      return res.redirect(signature_url);
    }

    // If we have base64 data, return it as an image
    if (signature_data) {
      // Assume the data is in format "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
      const matches = signature_data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      
      if (!matches) {
        return res.status(400).json({ 
          error: 'Invalid signature data format',
        });
      }

      const imageType = matches[1]; // png, jpeg, etc.
      const imageBuffer = Buffer.from(matches[2], 'base64');

      res.set({
        'Content-Type': `image/${imageType}`,
        'Content-Length': imageBuffer.length,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      });

      return res.send(imageBuffer);
    }

    res.status(404).json({ 
      error: 'No signature data available',
    });
  } catch (err) {
    console.error('Error serving signature image:', err);
    res.status(500).json({ error: 'Failed to serve signature image' });
  }
});

/**
 * DELETE /api/signatures/:id
 * Delete signature (admin function)
 */
router.delete('/:id', [
  param('id').isInt().withMessage('Signature ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { id } = req.params;

    // Get signature info before deletion for response
    const signatureResult = await dbQuery(`
      SELECT 
        s.id,
        s.pickup_event_id,
        pe.pickup_person_name,
        p.tracking_number
      FROM signatures s
      JOIN pickup_events pe ON s.pickup_event_id = pe.id
      JOIN packages p ON pe.package_id = p.id
      WHERE s.id = ?
    `, [id]);

    if (signatureResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Signature not found',
        id: parseInt(id),
      });
    }

    // Delete the signature
    await dbQuery(`DELETE FROM signatures WHERE id = ?`, [id]);

    // Update the pickup event to reflect signature is no longer captured
    await dbQuery(`
      UPDATE pickup_events 
      SET signature_captured = 0 
      WHERE id = ?
    `, [signatureResult.rows[0].pickup_event_id]);

    res.json({
      message: 'Signature deleted successfully',
      deleted_signature: {
        id: parseInt(id),
        pickup_event_id: signatureResult.rows[0].pickup_event_id,
        pickup_person_name: signatureResult.rows[0].pickup_person_name,
        tracking_number: signatureResult.rows[0].tracking_number,
      },
    });
  } catch (err) {
    console.error('Error deleting signature:', err);
    res.status(500).json({ error: 'Failed to delete signature' });
  }
});

export default router;