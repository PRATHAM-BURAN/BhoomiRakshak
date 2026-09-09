import express from 'express';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';

import { sanitizeGeometry } from './regions.js';

const router = express.Router();

// GET /api/risk-zones: Read-only query for current risk zones (populated strictly by ML service)
router.get('/', async (req, res) => {
  const { region_id, risk_level } = req.query;
  const localRegions = localDB.getTable('regions') || [];
  let localZones = localDB.getTable('risk_zones') || [];
  let mergedZones = [...localZones];

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('risk_zones').select('*');
      if (region_id) query = query.eq('region_id', region_id);
      if (risk_level) query = query.ilike('risk_level', risk_level);

      const { data: sbZones } = await query;
      if (sbZones && sbZones.length > 0) {
        const { data: regions } = await supabase.from('regions').select('id, name, district, state');
        const regionMap = {};
        (regions || []).forEach(r => { regionMap[r.id] = `${r.district}, ${r.state}`; });

        for (const sbZ of sbZones) {
          const formatted = {
            ...sbZ,
            region_name: regionMap[sbZ.region_id] || sbZ.region_name || 'Monitored Sector',
            risk_level: (sbZ.risk_level || 'safe').toUpperCase(),
            geometry: sanitizeGeometry(sbZ.location || sbZ.geometry)
          };
          const idx = mergedZones.findIndex(z => z.id === sbZ.id || z.region_id === sbZ.region_id);
          if (idx >= 0) {
            mergedZones[idx] = { ...mergedZones[idx], ...formatted };
          } else {
            mergedZones.push(formatted);
          }
        }
      }
    } catch (sbErr) {
      console.warn('[SUPABASE RISK ZONES QUERY]:', sbErr.message);
    }
  }

  // Ensure every zone has a valid sanitized geometry and region fallback if missing
  mergedZones = mergedZones.map(z => {
    let geom = sanitizeGeometry(z.geometry || z.location);
    if (!geom) {
      const matchReg = localRegions.find(r => r.id === z.region_id || r.district === z.region_name);
      if (matchReg && matchReg.geometry) {
        geom = matchReg.geometry;
      }
    }
    return {
      ...z,
      risk_level: (z.risk_level || 'MODERATE').toUpperCase(),
      geometry: geom
    };
  });

  if (region_id) mergedZones = mergedZones.filter(z => z.region_id === region_id);
  if (risk_level) mergedZones = mergedZones.filter(z => z.risk_level.toUpperCase() === risk_level.toUpperCase());

  return res.json({
    count: mergedZones.length,
    risk_zones: mergedZones
  });
});

// GET /api/risk-zones/:id: Single zone inspector
router.get('/:id', (req, res) => {
  const zones = localDB.getTable('risk_zones');
  const zone = zones.find(z => z.id === req.params.id);
  if (!zone) {
    return res.status(404).json({ error: 'Risk zone not found or not yet scored by ML engine.' });
  }
  return res.json({ risk_zone: zone });
});

export default router;
