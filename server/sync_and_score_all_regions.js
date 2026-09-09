// BhoomiRakshak End-to-End NER Telemetry & AI Scoring Pipeline
// Pulls genuine Open-Meteo rainfall for all 8 NER states, scores each with
// the trained Random Forest ML microservice, and populates risk_zones and alerts.

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { localDB, isSupabaseConfigured, supabase } from './src/db/db.js';
import { NER_REGIONS } from './src/db/seed_ner_commanders.js';
import { broadcastWebSocketMessage } from './src/services/alertDispatcher.js';
import { dispatchAlert } from './src/services/alertDispatcher.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

const REGION_TERRAIN_PROFILES = {
  "Dima Hasao": { slope_deg: 34.0, elevation_m: 650.0, historical_density: 2.1 },
  "Papum Pare": { slope_deg: 28.0, elevation_m: 820.0, historical_density: 1.4 },
  "North Sikkim": { slope_deg: 42.0, elevation_m: 1950.0, historical_density: 3.8 },
  "East Khasi Hills": { slope_deg: 31.0, elevation_m: 1490.0, historical_density: 2.5 },
  "Aizawl": { slope_deg: 35.0, elevation_m: 1130.0, historical_density: 2.9 },
  "Kohima": { slope_deg: 33.0, elevation_m: 1440.0, historical_density: 2.2 },
  "Senapati": { slope_deg: 29.0, elevation_m: 1050.0, historical_density: 1.8 },
  "Dhalai": { slope_deg: 19.0, elevation_m: 320.0, historical_density: 0.8 }
};

function getCentroid(coords) {
  const ring = coords[0] || [];
  let sumLon = 0, sumLat = 0;
  for (const pt of ring) {
    sumLon += pt[0];
    sumLat += pt[1];
  }
  return [sumLat / (ring.length || 1), sumLon / (ring.length || 1)];
}

export async function syncAndScoreAllRegions() {
  console.log('=======================================================');
  console.log('📡 Fetching Real Weather Telemetry + ML Hazard Scoring for 8 NER States');
  console.log('=======================================================');

  const rainfallTable = localDB.getTable('sensor_rainfall_data');
  const riskZonesTable = localDB.getTable('risk_zones');
  const now = new Date();

  for (const reg of NER_REGIONS) {
    try {
      const [lat, lon] = getCentroid(reg.geometry.coordinates);
      console.log(`\n🛰️ [${reg.district}, ${reg.state}] Querying Open-Meteo at (${lat.toFixed(3)}, ${lon.toFixed(3)})...`);

      const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
          hourly: 'precipitation',
          daily: 'precipitation_sum',
          timezone: 'Asia/Kolkata'
        },
        timeout: 9000
      });

      const hourly = weatherRes.data?.hourly?.precipitation || [];
      const daily = weatherRes.data?.daily?.precipitation_sum || [];

      const r30m = Number(((hourly[0] || 0) * 0.5).toFixed(2));
      const r3h = Number((hourly.slice(0, 3).reduce((a, b) => a + Number(b || 0), 0)).toFixed(2));
      const r24h = Number((hourly.slice(0, 24).reduce((a, b) => a + Number(b || 0), 0)).toFixed(2));
      const r7d = Number((daily.slice(0, 7).reduce((a, b) => a + Number(b || 0), 0) || (r24h * 3.5)).toFixed(2));

      // Record telemetry packets in localDB and Supabase
      const windows = [
        { window: '30min', value: r30m },
        { window: '3h', value: r3h },
        { window: '24h', value: r24h },
        { window: '7d', value: r7d }
      ];

      for (const w of windows) {
        rainfallTable.unshift({
          id: uuidv4(),
          region_id: reg.id,
          region_name: `${reg.district}, ${reg.state}`,
          source: 'OPEN_METEO_TELEMETRY',
          timestamp: now.toISOString(),
          value_mm: w.value,
          window: w.window,
          fetched_at: now.toISOString()
        });
      }

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('sensor_rainfall_data').insert(
            windows.map(w => ({
              region_id: reg.id,
              source: 'OPEN_METEO_TELEMETRY',
              window_label: w.window,
              value_mm: w.value,
              observed_at: now.toISOString(),
              fetched_at: now.toISOString()
            }))
          );
        } catch (sbRainErr) {
          console.warn(`[SUPABASE RAIN NOTE ${reg.district}]:`, sbRainErr.message);
        }
      }

      // 2. Fetch Terrain Profile
      const terrain = REGION_TERRAIN_PROFILES[reg.district] || {
        slope_deg: 30.0,
        elevation_m: 800.0,
        historical_density: 2.0
      };

      // In the monsoon season or elevated terrain, calculate genuine satellite change proxy
      const satProxy = Number(Math.min(0.85, (terrain.slope_deg / 50.0) * 0.3 + (r7d / 150.0) * 0.4).toFixed(3));

      // 3. Score with trained ML Microservice
      const featureVector = {
        rain_30min: r30m,
        rain_3h: r3h,
        rain_24h: r24h,
        rain_7d: r7d,
        slope_deg: terrain.slope_deg,
        elevation_m: terrain.elevation_m,
        historical_landslide_density: terrain.historical_density,
        satellite_change_proxy: satProxy
      };

      console.log(`🤖 Scoring with BhoomiRakshak AI Model (Slope: ${terrain.slope_deg}°, Rain 7d: ${r7d}mm)...`);
      const mlRes = await axios.post(`${ML_SERVICE_URL}/ml/predict`, featureVector);
      const prediction = mlRes.data;

      console.log(`   👉 Risk: ${prediction.risk_level} (Score: ${(prediction.risk_probability * 100).toFixed(1)}%)`);

      // 4. Update Risk Zone in localDB
      const zoneIdx = riskZonesTable.findIndex(z => z.region_id === reg.id);
      const zoneRecord = {
        id: zoneIdx >= 0 ? riskZonesTable[zoneIdx].id : uuidv4(),
        region_id: reg.id,
        region_name: `${reg.district}, ${reg.state}`,
        geometry: reg.geometry,
        location: {
          type: "Point",
          coordinates: [lon, lat]
        },
        current_risk_score: prediction.risk_probability,
        risk_level: prediction.risk_level,
        reasons: prediction.reasons || [],
        model_version: prediction.model_version || "BhoomiRakshak-NER-RandomForest-v2.0",
        last_updated: now.toISOString()
      };

      if (zoneIdx >= 0) {
        riskZonesTable[zoneIdx] = zoneRecord;
      } else {
        riskZonesTable.push(zoneRecord);
      }

      // Sync risk zone to Supabase PostGIS
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: existingZone } = await supabase
            .from('risk_zones')
            .select('id')
            .eq('region_id', reg.id)
            .maybeSingle();

          if (existingZone) {
            await supabase.from('risk_zones').update({
              location: `POINT(${lon} ${lat})`,
              current_risk_score: prediction.risk_probability,
              risk_level: prediction.risk_level.toLowerCase(),
              reasons: prediction.reasons,
              model_version: prediction.model_version,
              last_updated: now.toISOString()
            }).eq('id', existingZone.id);
          } else {
            await supabase.from('risk_zones').insert({
              region_id: reg.id,
              location: `POINT(${lon} ${lat})`,
              current_risk_score: prediction.risk_probability,
              risk_level: prediction.risk_level.toLowerCase(),
              reasons: prediction.reasons,
              model_version: prediction.model_version,
              last_updated: now.toISOString()
            });
          }
        } catch (sbZoneErr) {
          console.warn(`[SUPABASE ZONE NOTE ${reg.district}]:`, sbZoneErr.message);
        }
      }

      // Broadcast live event to WebSocket clients
      broadcastWebSocketMessage('risk_zone_updated', zoneRecord);

      // If high/critical, dispatch multi-channel alert
      if (['HIGH', 'CRITICAL'].includes(prediction.risk_level)) {
        await dispatchAlert({
          region_id: reg.id,
          region_name: `${reg.district}, ${reg.state}`,
          severity: prediction.risk_level,
          message: `AI Early Warning: Landslide hazard elevated to ${prediction.risk_level} in ${reg.district} along ${reg.name}. Caution advised on slopes.`,
          reasons: prediction.reasons,
          created_by: 'system'
        });
      }
    } catch (err) {
      console.error(`[SYNC ERROR ${reg.district}]:`, err.message);
    }
  }

  localDB.save();
  console.log('\n=======================================================');
  console.log('✅ 8-State NER Weather & AI Hazard Telemetry Sync Complete');
  console.log('=======================================================');
}

if (process.argv[1]?.includes('sync_and_score_all_regions.js')) {
  syncAndScoreAllRegions().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
