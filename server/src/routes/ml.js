import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';
import { broadcastWebSocketMessage } from '../services/alertDispatcher.js';

const router = express.Router();

// POST /api/ml/score: Endpoint the ML service calls to write computed risk scores into risk_zones
router.post('/score', async (req, res) => {
  try {
    const {
      region_id,
      geometry,
      current_risk_score,
      risk_level,
      reasons,
      model_version
    } = req.body;

    if (!region_id || current_risk_score === undefined || !risk_level) {
      return res.status(400).json({ error: 'region_id, current_risk_score, and risk_level are mandatory.' });
    }

    const regions = localDB.getTable('regions');
    let region = regions.find(r => r.id === region_id);
    if (!region && isSupabaseConfigured && supabase) {
      const { data: sbRegion } = await supabase.from('regions').select('*').eq('id', region_id).maybeSingle();
      if (sbRegion) region = sbRegion;
    }
    if (!region) {
      return res.status(400).json({ error: 'Target region sector does not exist.' });
    }

    const riskZones = localDB.getTable('risk_zones');
    
    // Check if zone for this region already exists, update it or insert new
    let zone = riskZones.find(z => z.region_id === region_id);

    if (zone) {
      zone.current_risk_score = parseFloat(current_risk_score);
      zone.risk_level = risk_level.toUpperCase();
      zone.reasons = reasons || [];
      zone.model_version = model_version || 'bhoomirakshak-baseline-v1';
      zone.geometry = geometry || region.geometry;
      zone.last_updated = new Date().toISOString();
    } else {
      zone = {
        id: uuidv4(),
        region_id,
        region_name: `${region.district}, ${region.state}`,
        geometry: geometry || region.geometry,
        current_risk_score: parseFloat(current_risk_score),
        risk_level: risk_level.toUpperCase(),
        reasons: reasons || [],
        model_version: model_version || 'bhoomirakshak-baseline-v1',
        last_updated: new Date().toISOString()
      };
      riskZones.push(zone);
    }

    // Update ML Service connection status in api_connection_status
    const connectionStatuses = localDB.getTable('api_connection_status');
    const mlConn = connectionStatuses.find(c => c.id === 'conn_ml');
    if (mlConn) {
      mlConn.status = 'connected';
      mlConn.last_synced_at = new Date().toISOString();
      mlConn.details = {
        last_scored_region: region.district,
        model_version: zone.model_version
      };
    }

    localDB.save();

    // Persist to Supabase risk_zones table if configured (triggers auto_create_alert in Postgres)
    if (isSupabaseConfigured && supabase) {
      try {
        let lat = 25.0, lon = 93.0;
        if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
          [lon, lat] = geometry.coordinates;
        } else if (region.boundary?.coordinates || region.geometry?.coordinates) {
          const coords = (region.boundary || region.geometry).coordinates[0] || [];
          if (coords.length > 0) {
            lon = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
            lat = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;
          }
        }

        const { data: existingZone } = await supabase
          .from('risk_zones')
          .select('id')
          .eq('region_id', region_id)
          .maybeSingle();

        if (existingZone) {
          await supabase.from('risk_zones').update({
            current_risk_score: parseFloat(current_risk_score),
            risk_level: risk_level.toLowerCase(),
            reasons: Array.isArray(reasons) ? reasons : [reasons],
            model_version: model_version || 'bhoomirakshak-baseline-v1',
            last_updated: new Date().toISOString()
          }).eq('id', existingZone.id);
        } else {
          await supabase.from('risk_zones').insert({
            region_id,
            location: `POINT(${lon} ${lat})`,
            current_risk_score: parseFloat(current_risk_score),
            risk_level: risk_level.toLowerCase(),
            reasons: Array.isArray(reasons) ? reasons : [reasons],
            model_version: model_version || 'bhoomirakshak-baseline-v1',
            last_updated: new Date().toISOString()
          });
        }
      } catch (sbErr) {
        console.warn('[SUPABASE RISK ZONE SYNC]:', sbErr.message);
      }
    }

    // Broadcast risk score update over WebSockets
    broadcastWebSocketMessage('risk_zone_updated', zone);

    return res.status(200).json({
      message: 'Risk score successfully ingested from ML inference engine.',
      risk_zone: zone
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
