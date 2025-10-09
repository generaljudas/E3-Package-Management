import express from 'express';
import { param, query, validationResult } from 'express-validator';
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
 * GET /api/reports/statistics
 * Get package and pickup statistics with optional date filtering
 * Performance target: < 500ms
 */
router.get('/statistics', [
  query('start_date').optional().isDate().withMessage('Start date must be valid date'),
  query('end_date').optional().isDate().withMessage('End date must be valid date'),
  query('mailbox_id').optional().isInt().withMessage('Mailbox ID must be an integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { start_date, end_date, mailbox_id } = req.query;
    
    // Build date filter
    let dateFilter = '';
    let params = [];
    let paramCount = 0;
    
    if (start_date || end_date) {
      const conditions = [];
      if (start_date) {
        paramCount++;
        conditions.push(`received_at >= $${paramCount}`);
        params.push(start_date);
      }
      if (end_date) {
        paramCount++;
        conditions.push(`received_at <= $${paramCount}`);
        params.push(end_date);
      }
      dateFilter = `AND ${conditions.join(' AND ')}`;
    }

    // Mailbox filter
    let mailboxFilter = '';
    if (mailbox_id) {
      paramCount++;
      mailboxFilter = `AND m.id = $${paramCount}`;
      params.push(parseInt(mailbox_id));
    }

    // Get package statistics
    const packageStats = await dbQuery(`
      SELECT 
        COUNT(*) as total_packages,
        COUNT(CASE WHEN p.status = 'received' THEN 1 END) as packages_received,
        COUNT(CASE WHEN p.status = 'ready_for_pickup' THEN 1 END) as packages_ready,
        COUNT(CASE WHEN p.status = 'picked_up' THEN 1 END) as packages_picked_up,
        COUNT(CASE WHEN p.high_value = TRUE THEN 1 END) as high_value_packages,
        COUNT(DISTINCT p.mailbox_id) as active_mailboxes,
        COUNT(DISTINCT p.tenant_id) as active_tenants
      FROM packages p
      JOIN mailboxes m ON p.mailbox_id = m.id
      WHERE 1=1 ${dateFilter} ${mailboxFilter}
    `, params);

    // Get carrier statistics
    const carrierStats = await dbQuery(`
      SELECT 
        COALESCE(p.carrier, 'Unknown') as carrier,
        COUNT(*) as package_count,
        COUNT(CASE WHEN p.status = 'picked_up' THEN 1 END) as picked_up_count,
        ROUND(
          COUNT(CASE WHEN p.status = 'picked_up' THEN 1 END) * 100.0 / COUNT(*),
          2
        ) as pickup_rate
      FROM packages p
      JOIN mailboxes m ON p.mailbox_id = m.id
      WHERE 1=1 ${dateFilter} ${mailboxFilter}
      GROUP BY p.carrier
      ORDER BY package_count DESC
    `, params);

    // Get daily package trends (last 30 days or date range)
    const trendsQuery = start_date && end_date ? `
      SELECT 
        DATE(p.received_at) as date,
        COUNT(*) as packages_received,
        COUNT(CASE WHEN p.status = 'picked_up' THEN 1 END) as packages_picked_up
      FROM packages p
      JOIN mailboxes m ON p.mailbox_id = m.id
      WHERE 1=1 ${dateFilter} ${mailboxFilter}
      GROUP BY DATE(p.received_at)
      ORDER BY date DESC
    ` : `
      SELECT 
        DATE(p.received_at) as date,
        COUNT(*) as packages_received,
        COUNT(CASE WHEN p.status = 'picked_up' THEN 1 END) as packages_picked_up
      FROM packages p
      JOIN mailboxes m ON p.mailbox_id = m.id
      WHERE p.received_at >= CURRENT_DATE - INTERVAL '30 days' ${mailboxFilter}
      GROUP BY DATE(p.received_at)
      ORDER BY date DESC
    `;

    const dailyTrends = await dbQuery(trendsQuery, mailbox_id ? [parseInt(mailbox_id)] : []);

    // Get top mailboxes by activity
    const topMailboxesQuery = `
      SELECT 
        m.mailbox_number,
        m.default_tenant_name,
        COUNT(p.id) as total_packages,
        COUNT(CASE WHEN p.status = 'picked_up' THEN 1 END) as picked_up_packages,
        COUNT(CASE WHEN p.status IN ('received', 'ready_for_pickup') THEN 1 END) as pending_packages,
        MAX(p.received_at) as last_package_date
      FROM mailboxes m
      LEFT JOIN packages p ON m.id = p.mailbox_id ${dateFilter.replace('received_at', 'p.received_at')}
      ${mailboxFilter}
      GROUP BY m.id, m.mailbox_number, m.default_tenant_name
      HAVING COUNT(p.id) > 0
      ORDER BY total_packages DESC
      LIMIT 10
    `;

    const topMailboxes = await dbQuery(topMailboxesQuery, params);

    res.json({
      statistics: {
        overview: packageStats.rows[0],
        carriers: carrierStats.rows,
        daily_trends: dailyTrends.rows,
        top_mailboxes: topMailboxes.rows,
      },
      filters: {
        start_date: start_date || null,
        end_date: end_date || null,
        mailbox_id: mailbox_id ? parseInt(mailbox_id) : null,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error generating statistics:', err);
    res.status(500).json({ error: 'Failed to generate statistics' });
  }
});

/**
 * GET /api/reports/pickups
 * Get pickup history with filtering and pagination
 * Performance target: < 400ms for 1000 records
 */
router.get('/pickups', [
  query('start_date').optional().isDate().withMessage('Start date must be valid date'),
  query('end_date').optional().isDate().withMessage('End date must be valid date'),
  query('mailbox_id').optional().isInt().withMessage('Mailbox ID must be an integer'),
  query('tenant_id').optional().isInt().withMessage('Tenant ID must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be 1-500'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      mailbox_id, 
      tenant_id, 
      limit = 50, 
      offset = 0 
    } = req.query;

    // Build WHERE conditions
    const whereConditions = ['1=1'];
    const params = [];
    let paramCount = 0;

    if (start_date) {
      paramCount++;
      whereConditions.push(`pe.created_at >= $${paramCount}`);
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereConditions.push(`pe.created_at <= $${paramCount}`);
      params.push(end_date);
    }

    if (mailbox_id) {
      paramCount++;
      whereConditions.push(`m.id = $${paramCount}`);
      params.push(parseInt(mailbox_id));
    }

    if (tenant_id) {
      paramCount++;
      whereConditions.push(`t.id = $${paramCount}`);
      params.push(parseInt(tenant_id));
    }

    // Add pagination params
    paramCount++;
    const limitParam = `$${paramCount}`;
    params.push(parseInt(limit));

    paramCount++;
    const offsetParam = `$${paramCount}`;
    params.push(parseInt(offset));

    // Get pickup events with package details
    const pickupsResult = await dbQuery(`
      SELECT 
        pe.id as pickup_event_id,
        pe.pickup_person_name,
        pe.staff_initials,
        pe.notes as pickup_notes,
        pe.created_at as pickup_timestamp,
        m.mailbox_number,
        t.name as tenant_name,
        t.phone as tenant_phone,
        COUNT(p.id) as package_count,
        ARRAY_AGG(p.tracking_number ORDER BY p.tracking_number) as tracking_numbers,
        ARRAY_AGG(p.carrier ORDER BY p.tracking_number) as carriers,
        COUNT(CASE WHEN p.high_value = TRUE THEN 1 END) as high_value_count,
        COUNT(s.id) as signature_count,
        pe.id as has_signature -- Will check if signatures exist
      FROM pickup_events pe
      JOIN mailboxes m ON pe.mailbox_id = m.id
      LEFT JOIN tenants t ON pe.tenant_id = t.id
      LEFT JOIN packages p ON pe.id = p.pickup_event_id
      LEFT JOIN signatures s ON pe.id = s.pickup_event_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY pe.id, m.mailbox_number, t.name, t.phone
      ORDER BY pe.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, params);

    // Get total count for pagination
    const countResult = await dbQuery(`
      SELECT COUNT(DISTINCT pe.id) as total
      FROM pickup_events pe
      JOIN mailboxes m ON pe.mailbox_id = m.id
      LEFT JOIN tenants t ON pe.tenant_id = t.id
      WHERE ${whereConditions.slice(0, -2).join(' AND ')}
    `, params.slice(0, -2));

    res.json({
      pickups: pickupsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + parseInt(limit)) < parseInt(countResult.rows[0].total),
      },
      filters: {
        start_date: start_date || null,
        end_date: end_date || null,
        mailbox_id: mailbox_id ? parseInt(mailbox_id) : null,
        tenant_id: tenant_id ? parseInt(tenant_id) : null,
      },
    });
  } catch (err) {
    console.error('Error fetching pickup history:', err);
    res.status(500).json({ error: 'Failed to fetch pickup history' });
  }
});

/**
 * GET /api/reports/audit
 * Get system audit log with filtering
 * Performance target: < 300ms for recent activity
 */
router.get('/audit', [
  query('start_date').optional().isDate().withMessage('Start date must be valid date'),
  query('end_date').optional().isDate().withMessage('End date must be valid date'),
  query('action_type').optional().isIn(['package_intake', 'status_change', 'pickup', 'tenant_update']),
  query('mailbox_id').optional().isInt().withMessage('Mailbox ID must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be 1-200'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      action_type, 
      mailbox_id, 
      limit = 100, 
      offset = 0 
    } = req.query;

    // Build comprehensive audit log from multiple sources
    const auditQueries = [];
    const params = [];
    let paramCount = 0;

    // Date filter parameters for all queries
    const getDateFilter = () => {
      const conditions = [];
      if (start_date) {
        paramCount++;
        conditions.push(`$${paramCount}`);
        params.push(start_date);
      } else {
        paramCount++;
        conditions.push(`$${paramCount}`);
        params.push(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Default: last 7 days
      }
      
      if (end_date) {
        paramCount++;
        conditions.push(`$${paramCount}`);
        params.push(end_date);
      } else {
        paramCount++;
        conditions.push(`$${paramCount}`);
        params.push(new Date().toISOString());
      }
      
      return conditions;
    };

    // Package intake events
    if (!action_type || action_type === 'package_intake') {
      const [startParam, endParam] = getDateFilter();
      let mailboxCondition = '';
      if (mailbox_id) {
        paramCount++;
        mailboxCondition = `AND m.id = $${paramCount}`;
        params.push(parseInt(mailbox_id));
      }
      
      auditQueries.push(`
        SELECT 
          'package_intake' as action_type,
          p.created_at as timestamp,
          m.mailbox_number,
          COALESCE(t.name, 'Unassigned') as tenant_name,
          p.tracking_number,
          p.carrier,
          CASE WHEN p.high_value THEN 'High-value' ELSE 'Standard' END as details,
          NULL as staff_initials,
          'Package received and registered' as description
        FROM packages p
        JOIN mailboxes m ON p.mailbox_id = m.id
        LEFT JOIN tenants t ON p.tenant_id = t.id
        WHERE p.created_at >= ${startParam} AND p.created_at <= ${endParam} ${mailboxCondition}
      `);
    }

    // Pickup events
    if (!action_type || action_type === 'pickup') {
      const [startParam, endParam] = getDateFilter();
      let mailboxCondition = '';
      if (mailbox_id) {
        paramCount++;
        mailboxCondition = `AND m.id = $${paramCount}`;
        params.push(parseInt(mailbox_id));
      }

      auditQueries.push(`
        SELECT 
          'pickup' as action_type,
          pe.created_at as timestamp,
          m.mailbox_number,
          t.name as tenant_name,
          pe.pickup_person_name as tracking_number,
          CONCAT(COUNT(p.id), ' packages') as carrier,
          CASE WHEN COUNT(s.id) > 0 THEN 'With signature' ELSE 'No signature' END as details,
          pe.staff_initials,
          CONCAT('Pickup by ', pe.pickup_person_name) as description
        FROM pickup_events pe
        JOIN mailboxes m ON pe.mailbox_id = m.id
        LEFT JOIN tenants t ON pe.tenant_id = t.id
        LEFT JOIN packages p ON pe.id = p.pickup_event_id
        LEFT JOIN signatures s ON pe.id = s.pickup_event_id
        WHERE pe.created_at >= ${startParam} AND pe.created_at <= ${endParam} ${mailboxCondition}
        GROUP BY pe.id, m.mailbox_number, t.name, pe.pickup_person_name, pe.staff_initials, pe.created_at
      `);
    }

    // Combine all audit sources
    const unionQuery = `
      WITH combined_audit AS (
        ${auditQueries.join(' UNION ALL ')}
      )
      SELECT * FROM combined_audit
      ORDER BY timestamp DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    // Add pagination parameters
    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const auditResult = await dbQuery(unionQuery, params);

    // Get total count (simplified for performance)
    const countQuery = `
      WITH combined_audit AS (
        ${auditQueries.join(' UNION ALL ')}
      )
      SELECT COUNT(*) as total FROM combined_audit
    `;

    const countResult = await dbQuery(countQuery, params.slice(0, -2));

    res.json({
      audit_log: auditResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + parseInt(limit)) < parseInt(countResult.rows[0].total),
      },
      filters: {
        start_date: start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: end_date || new Date().toISOString(),
        action_type: action_type || 'all',
        mailbox_id: mailbox_id ? parseInt(mailbox_id) : null,
      },
    });
  } catch (err) {
    console.error('Error fetching audit log:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * GET /api/reports/mailbox/:mailboxId/summary
 * Get detailed summary for specific mailbox
 * Performance target: < 200ms
 */
router.get('/mailbox/:mailboxId/summary', [
  param('mailboxId').isInt().withMessage('Mailbox ID must be an integer'),
  query('days').optional().isInt({ min: 1, max: 90 }).withMessage('Days must be 1-90'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { mailboxId } = req.params;
    const { days = 30 } = req.query;

    // Get mailbox info
    const mailboxResult = await dbQuery(`
      SELECT 
        m.*,
        t.name as default_tenant_name,
        t.phone as default_tenant_phone,
        t.email as default_tenant_email
      FROM mailboxes m
      LEFT JOIN tenants t ON m.default_tenant_id = t.id
      WHERE m.id = $1
    `, [parseInt(mailboxId)]);

    if (mailboxResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    const mailbox = mailboxResult.rows[0];

    // Get package statistics for this mailbox
    const packageStats = await dbQuery(`
      SELECT 
        COUNT(*) as total_packages,
        COUNT(CASE WHEN p.status = 'received' THEN 1 END) as packages_received,
        COUNT(CASE WHEN p.status = 'ready_for_pickup' THEN 1 END) as packages_ready,
        COUNT(CASE WHEN p.status = 'picked_up' THEN 1 END) as packages_picked_up,
        COUNT(CASE WHEN p.high_value = TRUE THEN 1 END) as high_value_packages,
        COUNT(DISTINCT p.tenant_id) as associated_tenants
      FROM packages p
      WHERE p.mailbox_id = $1 
        AND p.received_at >= CURRENT_DATE - INTERVAL '${days} days'
    `, [parseInt(mailboxId)]);

    // Get recent activity
    const recentActivity = await dbQuery(`
      SELECT 
        p.tracking_number,
        p.carrier,
        p.status,
        p.high_value,
        p.received_at,
        p.picked_up_at,
        t.name as tenant_name
      FROM packages p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      WHERE p.mailbox_id = $1
        AND p.received_at >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY p.received_at DESC
      LIMIT 20
    `, [parseInt(mailboxId)]);

    res.json({
      mailbox: mailbox,
      summary: {
        period_days: parseInt(days),
        statistics: packageStats.rows[0],
        recent_packages: recentActivity.rows,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error generating mailbox summary:', err);
    res.status(500).json({ error: 'Failed to generate mailbox summary' });
  }
});

export default router;