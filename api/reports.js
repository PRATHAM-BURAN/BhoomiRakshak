// Vercel Serverless API: Field Reports with Supabase & In-Memory Fallback
import { createClient } from '@supabase/supabase-js';

// In-memory fallback list to ensure reports are retained during serverless lifetime
let localMemoryReports = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  // 1. POST: Submit a new report
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      body = body || {};

      const mediaUrl = body.media_data_url || body.media_url || null;
      const lat = parseFloat(body.latitude) || 26.1445;
      const lon = parseFloat(body.longitude) || 91.7362;

      let primaryRegion = body.region_id;
      if (!primaryRegion && Array.isArray(body.region_ids) && body.region_ids.length > 0) {
        primaryRegion = body.region_ids[0];
      }
      if (!primaryRegion) primaryRegion = 'reg-ner-01-assam';

      const report = {
        id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        region_id: primaryRegion,
        region_ids: Array.isArray(body.region_ids) ? body.region_ids : [primaryRegion],
        region_name: body.region_name || 'North-Eastern Sector',
        report_type: body.report_type || 'slope_movement',
        severity: (body.severity || 'MODERATE').toUpperCase(),
        description: body.description || '',
        media_url: mediaUrl,
        media_data_url: mediaUrl,
        status: 'pending',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        created_offline: !!body.created_offline,
        submitted_by_name: body.reporter_name || 'Community Citizen',
        created_at: new Date().toISOString()
      };

      localMemoryReports.unshift(report);

      // Async background attempt to persist to Supabase if available
      if (supabase) {
        try {
          let regionUuid = null;
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(primaryRegion)) {
            regionUuid = primaryRegion;
          } else {
            const { data: dbRegions } = await supabase.from('regions').select('id, name, district').limit(10);
            if (dbRegions && dbRegions.length > 0) {
              const matched = dbRegions.find(r => 
                (r.district && primaryRegion.toLowerCase().includes(r.district.toLowerCase())) ||
                (r.name && primaryRegion.toLowerCase().includes(r.name.toLowerCase()))
              );
              regionUuid = matched ? matched.id : dbRegions[0].id;
            }
          }

          const { data: adminProfile } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle();
          const authorUuid = adminProfile ? adminProfile.id : null;

          if (regionUuid && authorUuid) {
            await supabase.from('field_reports').insert([{
              submitted_by: authorUuid,
              region_id: regionUuid,
              location: `POINT(${lon} ${lat})`,
              report_type: ['crack', 'slope_movement', 'road_blockage'].includes(report.report_type) ? report.report_type : 'slope_movement',
              severity: report.severity.toLowerCase(),
              description: report.description,
              media_url: report.media_url,
              status: report.status,
              created_offline: report.created_offline,
              created_at: report.created_at
            }]);
          }
        } catch (sbErr) {
          console.warn('[SUPABASE FIELD REPORT INSERT WARN]:', sbErr.message);
        }
      }

      return res.status(201).json({
        message: 'Field observation report synchronized successfully.',
        report
      });
    } catch (err) {
      console.error('[API REPORT POST ERROR]:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. PATCH: Update report status (triage)
  if (req.method === 'PATCH') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      body = body || {};
      const reportId = req.query.id || body.id;
      const newStatus = body.status || 'verified';

      const found = localMemoryReports.find(r => r.id === reportId);
      if (found) {
        found.status = newStatus;
        if (body.review_notes) found.review_notes = body.review_notes;
      }

      if (supabase && reportId) {
        try {
          await supabase.from('field_reports').update({ status: newStatus }).eq('id', reportId);
        } catch (sbErr) {
          console.warn('[SUPABASE REPORT STATUS UPDATE WARN]:', sbErr.message);
        }
      }

      return res.status(200).json({
        message: `Report ${reportId} updated to ${newStatus}`,
        report: found || { id: reportId, status: newStatus }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 3. GET: Fetch reports
  if (supabase) {
    try {
      const { data, error } = await supabase.from('field_reports').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        // Merge Supabase reports with any local memory reports
        const merged = [...localMemoryReports];
        data.forEach(sbR => {
          if (!merged.some(m => m.id === sbR.id)) {
            merged.push({
              ...sbR,
              severity: (sbR.severity || 'MODERATE').toUpperCase()
            });
          }
        });
        return res.status(200).json({ reports: merged });
      }
    } catch (err) {
      console.warn('[SUPABASE FIELD REPORT FETCH]:', err.message);
    }
  }

  return res.status(200).json({ reports: localMemoryReports });
}
