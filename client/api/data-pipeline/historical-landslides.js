import { createClient } from '@supabase/supabase-js';
import landslidesData from './historicalLandslides.json' assert { type: 'json' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  // Try querying Supabase if available and has records
  if (supabase) {
    try {
      const { data, error } = await supabase.from('historical_landslides').select('*').limit(2000);
      if (!error && data && data.length > 0) {
        return res.status(200).json({
          count: data.length,
          historical_landslides: data
        });
      }
    } catch (sbErr) {
      console.warn('[SUPABASE HISTORICAL FETCH]:', sbErr.message);
    }
  }

  // Ground truth NASA COOLR & GSI records (1,094 records)
  return res.status(200).json({
    count: landslidesData.length,
    historical_landslides: landslidesData
  });
}
