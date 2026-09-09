import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Helper to sanitize coordinates into numeric [lon, lat] pairs
export function sanitizeGeometry(geom) {
  if (!geom) return null;
  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
    const sanitizedCoords = geom.coordinates.map(ring => {
      if (!Array.isArray(ring)) return [];
      return ring.map(pt => {
        if (Array.isArray(pt)) {
          return [Number(pt[0]), Number(pt[1])];
        }
        if (typeof pt === 'string') {
          const parts = pt.trim().split(/\s+/).map(Number);
          return parts.length >= 2 ? [parts[0], parts[1]] : [92.8, 25.1];
        }
        return pt;
      });
    });
    return { type: 'Polygon', coordinates: sanitizedCoords };
  }
  if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
    return { type: 'Point', coordinates: geom.coordinates.map(Number) };
  }
  return geom;
}

// 1. GET /api/regions: Public/Authenticated list of all monitored sectors
router.get('/', async (req, res) => {
  let localRegions = localDB.getTable('regions') || [];
  let mergedRegions = [...localRegions];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sbRegions } = await supabase.from('regions').select('*');
      if (sbRegions && sbRegions.length > 0) {
        for (const sbR of sbRegions) {
          const idx = mergedRegions.findIndex(r => r.id === sbR.id || (r.district === sbR.district && r.state === sbR.state));
          const geom = sanitizeGeometry(sbR.boundary || sbR.geometry);
          if (idx >= 0) {
            mergedRegions[idx] = {
              ...mergedRegions[idx],
              ...sbR,
              geometry: geom || mergedRegions[idx].geometry
            };
          } else {
            mergedRegions.push({
              ...sbR,
              geometry: geom
            });
          }
        }
      }
    } catch (sbErr) {
      console.warn('[SUPABASE REGIONS QUERY]:', sbErr.message);
    }
  }

  // Ensure all regions have properly formatted numeric GeoJSON geometries
  const sanitized = mergedRegions.map(r => ({
    ...r,
    geometry: sanitizeGeometry(r.geometry || r.boundary)
  }));

  return res.json({ regions: sanitized });
});

// 2. GET /api/regions/:id: Retrieve individual sector details
router.get('/:id', (req, res) => {
  const regions = localDB.getTable('regions');
  const region = regions.find(r => r.id === req.params.id);
  if (!region) {
    return res.status(404).json({ error: 'Region sector not found.' });
  }
  return res.json({ region });
});

// 3. POST /api/regions: Admin-only creation of geofenced monitoring sector
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, state, district, geometry } = req.body;
    if (!name || !state || !district || !geometry) {
      return res.status(400).json({ error: 'Name, state, district, and polygon geometry are required.' });
    }

    // Geometry validation: standard GeoJSON Polygon
    if (geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) {
      return res.status(400).json({ error: 'Invalid geometry. Must be a valid GeoJSON Polygon.' });
    }

    const regions = localDB.getTable('regions');
    const newRegion = {
      id: uuidv4(),
      name,
      state,
      district,
      geometry,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    regions.push(newRegion);
    localDB.save();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('regions').insert([{
          id: newRegion.id,
          name,
          state,
          district,
          boundary: geometry
        }]);
      } catch (sbErr) {
        console.warn('[SUPABASE REGION INSERT]:', sbErr.message);
      }
    }

    return res.status(201).json({
      message: 'Monitoring sector successfully registered.',
      region: newRegion
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
