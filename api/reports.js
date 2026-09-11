// Vercel Serverless API: Field Reports with Supabase & Data URL media support
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const mediaUrl = body.media_data_url || body.media_url || null;
      const lat = parseFloat(body.latitude) || 25.18;
      const lon = parseFloat(body.longitude) || 92.95;

      const report = {
        id: `rep_${Date.now()}`,
        region_id: body.region_id || (Array.isArray(body.region_ids) ? body.region_ids[0] : 'reg-ner-01-assam'),
        region_name: body.region_name || 'North-Eastern Sector',
        report_type: body.report_type || 'slope_movement',
        severity: (body.severity || 'MODERATE').toUpperCase(),
        description: body.description || '',
        media_url: mediaUrl,
        status: 'pending',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        created_offline: !!body.created_offline,
        submitted_by_name: body.reporter_name || 'Ground Observer',
        created_at: new Date().toISOString()
      };

      if (supabase) {
        try {
          await supabase.from('field_reports').insert([{
            id: report.id,
            region_id: report.region_id,
            location: `POINT(${lon} ${lat})`,
            report_type: report.report_type,
            severity: report.severity.toLowerCase(),
            description: report.description,
            media_url: report.media_url,
            status: report.status,
            created_offline: report.created_offline,
            created_at: report.created_at
          }]);
        } catch (sbErr) {
          console.warn('[SUPABASE FIELD REPORT INSERT]:', sbErr.message);
        }
      }

      return res.status(201).json({ message: 'Field report synchronized successfully', report });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET: Fetch reports
  if (supabase) {
    try {
      const { data, error } = await supabase.from('field_reports').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return res.status(200).json({ reports: data });
      }
    } catch (err) {
      console.warn('[SUPABASE FIELD REPORT FETCH]:', err.message);
    }
  }

  return res.status(200).json({ reports: [] });
}
