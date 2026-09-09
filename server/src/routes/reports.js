import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';
import { requireAuth, requireOfficerOrAdmin, optionalAuth } from '../middleware/auth.js';
import { broadcastWebSocketMessage } from '../services/alertDispatcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `report_${Date.now()}_${uuidv4().slice(0, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15 MB
});

const router = express.Router();

// 1. POST /api/reports: Submit field/citizen report (supports offline queue replay with idempotency key)
router.post('/', optionalAuth, upload.single('media'), async (req, res) => {
  try {
    const {
      region_id,
      region_ids,
      report_type,
      severity,
      description,
      latitude,
      longitude,
      idempotency_key,
      created_offline
    } = req.body;

    let parsedRegionIds = [];
    if (Array.isArray(region_ids)) {
      parsedRegionIds = region_ids;
    } else if (typeof region_ids === 'string') {
      try {
        const p = JSON.parse(region_ids);
        if (Array.isArray(p)) parsedRegionIds = p;
      } catch {
        parsedRegionIds = region_ids.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (parsedRegionIds.length === 0 && region_id) {
      parsedRegionIds = [region_id];
    }

    const primaryRegionId = parsedRegionIds[0] || region_id;

    if (!primaryRegionId || !report_type || !severity) {
      return res.status(400).json({ error: 'Target district (region_id or region_ids), report_type, and severity are mandatory.' });
    }

    // Verify Region exists
    const regions = localDB.getTable('regions');
    const matchedRegions = regions.filter(r => parsedRegionIds.includes(r.id));
    const region = matchedRegions[0] || regions.find(r => r.id === primaryRegionId);
    if (!region) {
      return res.status(400).json({ error: 'Referenced region sector does not exist.' });
    }

    const regionNames = matchedRegions.length > 0 
      ? matchedRegions.map(r => `${r.district}, ${r.state}`).join(' | ') 
      : `${region.district}, ${region.state}`;

    const reports = localDB.getTable('field_reports');

    // Idempotency check: if offline queue resends the same report, return existing
    const key = idempotency_key || uuidv4();
    const existingReport = reports.find(r => r.idempotency_key === key);
    if (existingReport) {
      return res.status(200).json({
        message: 'Report already synchronized (idempotent submission).',
        report: existingReport
      });
    }

    // Determine geometry
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const geometry = (!isNaN(lat) && !isNaN(lon))
      ? { type: 'Point', coordinates: [lon, lat] }
      : null;

    if (!geometry) {
      return res.status(400).json({ error: 'Valid GPS latitude and longitude coordinates are required.' });
    }

    // Media file path if uploaded
    let media_url = null;
    if (req.file) {
      media_url = `/uploads/${req.file.filename}`;
    } else if (req.body.media_url) {
      media_url = req.body.media_url;
    }

    const newReport = {
      id: uuidv4(),
      submitted_by: req.user ? req.user.id : null,
      submitted_by_name: req.user ? req.user.name : (req.body.reporter_name || 'Anonymous Citizen'),
      submitted_by_role: req.user ? req.user.role : 'citizen',
      region_id: primaryRegionId,
      region_ids: parsedRegionIds,
      region_name: regionNames,
      geometry,
      report_type, // 'crack', 'slope_movement', 'road_blockage'
      severity: severity.toUpperCase(), // 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'
      description: description || '',
      media_url,
      status: req.user?.role === 'field_officer' || req.user?.role === 'admin' ? 'verified' : 'pending',
      created_offline: created_offline === 'true' || created_offline === true,
      idempotency_key: key,
      synced_at: new Date().toISOString(),
      created_at: req.body.client_created_at || new Date().toISOString()
    };

    reports.unshift(newReport);
    localDB.save();

    // Persist to Supabase field_reports table if user is authenticated and Supabase configured
    if (isSupabaseConfigured && supabase && newReport.submitted_by) {
      try {
        await supabase.from('field_reports').insert([{
          id: newReport.id,
          submitted_by: newReport.submitted_by,
          region_id: newReport.region_id,
          location: `POINT(${lon} ${lat})`,
          report_type: ['crack', 'slope_movement', 'road_blockage'].includes(newReport.report_type) ? newReport.report_type : 'other',
          severity: newReport.severity.toLowerCase(),
          description: newReport.description,
          media_url: newReport.media_url,
          status: newReport.status,
          created_offline: newReport.created_offline,
          synced_at: newReport.synced_at,
          created_at: newReport.created_at
        }]);
      } catch (sbErr) {
        console.warn('[SUPABASE FIELD REPORT SYNC]:', sbErr.message);
      }
    }

    // Broadcast report event over WebSockets to admin and field officers
    broadcastWebSocketMessage('new_report', newReport);

    return res.status(201).json({
      message: 'Field observation report synchronized successfully.',
      report: newReport
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/reports: Role-scoped list of field reports
router.get('/', optionalAuth, async (req, res) => {
  let reports = localDB.getTable('field_reports');
  const user = req.user;

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('field_reports').select('*').order('created_at', { ascending: false });

      if (!user || user.role === 'citizen') {
        if (user) {
          query = query.or(`status.eq.verified,submitted_by.eq.${user.id}`);
        } else {
          query = query.eq('status', 'verified');
        }
      } else if (user.role === 'field_officer') {
        if (user.region_id) {
          query = query.eq('region_id', user.region_id);
        }
      }
      // Admin gets all reports

      const { data: sbReports } = await query;
      if (sbReports && sbReports.length > 0) {
        const { data: regions } = await supabase.from('regions').select('id, name, district, state');
        const regionMap = {};
        (regions || []).forEach(r => { regionMap[r.id] = `${r.district}, ${r.state}`; });

        const { data: profiles } = await supabase.from('profiles').select('id, full_name, role');
        const profileMap = {};
        (profiles || []).forEach(p => { profileMap[p.id] = p; });

        reports = sbReports.map(r => ({
          ...r,
          region_name: regionMap[r.region_id] || 'Monitored Sector',
          submitted_by_name: profileMap[r.submitted_by]?.full_name || 'Citizen Observer',
          submitted_by_role: profileMap[r.submitted_by]?.role || 'citizen',
          severity: (r.severity || 'low').toUpperCase(),
          geometry: r.location
        }));
      }
    } catch (sbErr) {
      console.warn('[SUPABASE FIELD REPORTS QUERY]:', sbErr.message);
    }
  } else {
    if (!user || user.role === 'citizen') {
      reports = reports.filter(r => 
        r.status === 'verified' || (user && r.submitted_by === user.id)
      );
    } else if (user.role === 'field_officer') {
      reports = reports.filter(r => r.region_id === user.region_id);
    }
  }

  return res.json({ reports });
});

// 3. PATCH /api/reports/:id/status: Officer/Admin status triage
router.patch('/:id/status', requireAuth, requireOfficerOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, review_notes } = req.body;

  if (!['pending', 'verified', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be pending, verified, or rejected.' });
  }

  const reports = localDB.getTable('field_reports');
  const report = reports.find(r => r.id === id);

  if (!report) {
    return res.status(404).json({ error: 'Field report not found.' });
  }

  // If officer, verify report is in their assigned region
  if (req.user.role === 'field_officer' && report.region_id !== req.user.region_id) {
    return res.status(403).json({ error: 'Unauthorized: You can only verify reports within your assigned district.' });
  }

  report.status = status;
  report.verified_by = req.user.id;
  report.verified_by_name = req.user.name;
  report.verified_at = new Date().toISOString();
  if (review_notes) {
    report.review_notes = review_notes;
  }

  localDB.save();

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('field_reports').update({ status }).eq('id', id);
    } catch (sbErr) {
      console.warn('[SUPABASE FIELD REPORT STATUS UPDATE]:', sbErr.message);
    }
  }

  broadcastWebSocketMessage('report_status_updated', report);

  return res.json({
    message: `Report status updated to ${status}.`,
    report
  });
});

export default router;
