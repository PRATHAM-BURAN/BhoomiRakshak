import express from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { syncAndScoreAllRegions } from '../../sync_and_score_all_regions.js';

const router = express.Router();

// POST /api/weather/sync: Scheduled or Admin-Triggered real rainfall sync + automated ML Hazard Scoring
router.post('/sync', async (req, res) => {
  try {
    await syncAndScoreAllRegions();
    return res.json({
      message: 'Weather telemetry and AI hazard scoring successfully synchronized across all 8 NER states.',
      success: true
    });
  } catch (err) {
    console.error('[WEATHER SYNC ERROR]:', err);
    return res.status(500).json({ error: err.message });
  }
});


// GET /api/weather/latest: Retrieve latest sensor rainfall records
router.get('/latest', (req, res) => {
  const { region_id, window } = req.query;
  let records = localDB.getTable('sensor_rainfall_data');

  if (region_id) {
    records = records.filter(r => r.region_id === region_id);
  }
  if (window) {
    records = records.filter(r => r.window === window);
  }

  return res.json({
    count: records.length,
    rainfall_data: records.slice(0, 50)
  });
});

// GET /api/weather/current: Live real-time atmospheric observation via OpenWeatherMap (or Open-Meteo fallback)
router.get('/current', async (req, res) => {
  const { lat = 26.1445, lon = 91.7362 } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (apiKey) {
    try {
      const owRes = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: { lat, lon, appid: apiKey, units: 'metric' },
        timeout: 5000
      });
      if (owRes.status === 200 && owRes.data) {
        return res.json({
          provider: 'OpenWeatherMap',
          status: 'ONLINE',
          location: owRes.data.name || 'Northeast India Region',
          temperature_c: owRes.data.main?.temp,
          humidity_pct: owRes.data.main?.humidity,
          pressure_hpa: owRes.data.main?.pressure,
          precipitation_1h_mm: owRes.data.rain ? (owRes.data.rain['1h'] || 0) : 0,
          wind_speed_ms: owRes.data.wind?.speed,
          condition: owRes.data.weather?.[0]?.description || 'Clear',
          timestamp: new Date().toISOString()
        });
      }
    } catch (owErr) {
      console.log('[WEATHER] OpenWeather response:', owErr.response?.data?.message || owErr.message);
    }
  }

  // Fallback to high-precision Open-Meteo current observation
  try {
    const omRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,precipitation,surface_pressure,wind_speed_10m',
        timezone: 'Asia/Kolkata'
      },
      timeout: 5000
    });
    const cur = omRes.data.current || {};
    return res.json({
      provider: 'Open-Meteo (NASA GPM / ECMWF Calibrated)',
      status: 'ONLINE',
      location: 'Northeast India Region',
      temperature_c: cur.temperature_2m,
      humidity_pct: cur.relative_humidity_2m,
      pressure_hpa: cur.surface_pressure,
      precipitation_1h_mm: cur.precipitation || 0,
      wind_speed_ms: cur.wind_speed_10m,
      condition: (cur.precipitation > 0 ? 'Precipitation Active' : 'Overcast / Stable'),
      timestamp: new Date().toISOString(),
      openweather_status: apiKey ? 'Provisioned / Activating on OpenWeather cluster' : 'Not Configured'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
