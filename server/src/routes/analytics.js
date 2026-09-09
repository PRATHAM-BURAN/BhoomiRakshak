import express from 'express';
import { localDB } from '../db/db.js';

const router = express.Router();

// GET /api/analytics: Real DB aggregations (Strictly 0 and empty arrays when no data exists)
router.get('/', (req, res) => {
  const alerts = localDB.getTable('alerts');
  const reports = localDB.getTable('field_reports');
  const zones = localDB.getTable('risk_zones');
  const regions = localDB.getTable('regions');
  const rainfall = localDB.getTable('sensor_rainfall_data');
  const users = localDB.getTable('users');

  // 1. Alerts by severity
  const alertsSummary = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    high: alerts.filter(a => a.severity === 'HIGH').length,
    moderate: alerts.filter(a => a.severity === 'MODERATE').length,
    low: alerts.filter(a => a.severity === 'LOW').length
  };

  // 2. Field reports by status and type
  const reportsSummary = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    verified: reports.filter(r => r.status === 'verified').length,
    rejected: reports.filter(r => r.status === 'rejected').length,
    by_type: {
      crack: reports.filter(r => r.report_type === 'crack').length,
      slope_movement: reports.filter(r => r.report_type === 'slope_movement').length,
      road_blockage: reports.filter(r => r.report_type === 'road_blockage').length
    }
  };

  // 3. Risk zones summary
  const zonesSummary = {
    total_zones: zones.length,
    critical: zones.filter(z => z.risk_level === 'CRITICAL').length,
    high: zones.filter(z => z.risk_level === 'HIGH').length,
    moderate: zones.filter(z => z.risk_level === 'MODERATE').length,
    low: zones.filter(z => z.risk_level === 'LOW').length,
    safe: zones.filter(z => z.risk_level === 'SAFE').length
  };

  // 4. District & Infrastructure stats
  const operationalSummary = {
    monitored_regions: regions.length,
    total_officers: users.filter(u => u.role === 'field_officer').length,
    total_citizens: users.filter(u => u.role === 'citizen').length,
    rainfall_telemetry_packets: rainfall.length
  };

  return res.json({
    alerts: alertsSummary,
    reports: reportsSummary,
    risk_zones: zonesSummary,
    operational: operationalSummary,
    computed_at: new Date().toISOString()
  });
});

export default router;
