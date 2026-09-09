import express from 'express';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';
import { seedNERCommanders } from '../db/seed_ner_commanders.js';

const router = express.Router();

// Helper to sanitize sensitive fields like password_hash
function sanitizeRecord(rec) {
  if (!rec || typeof rec !== 'object') return rec;
  const { password_hash, ...rest } = rec;
  return rest;
}

// 1. Get Live Database Summary
router.get('/summary', async (req, res) => {
  try {
    const tableNames = [
      'regions',
      'users',
      'alerts',
      'risk_zones',
      'field_reports',
      'sensor_rainfall_data',
      'historical_landslides',
      'alert_subscriptions',
      'api_connection_status'
    ];

    const localStats = {};
    for (const name of tableNames) {
      localStats[name] = localDB.getTable(name).length;
    }

    const supabaseStats = {};
    if (isSupabaseConfigured && supabase) {
      for (const name of tableNames) {
        try {
          const { count, error } = await supabase.from(name).select('*', { count: 'exact', head: true });
          supabaseStats[name] = error ? `Error: ${error.message}` : count;
        } catch (e) {
          supabaseStats[name] = `Unavailable`;
        }
      }
    }

    return res.json({
      status: 'OPERATIONAL',
      engine: isSupabaseConfigured ? 'Dual Engine: Supabase Cloud PostGIS + In-Process Local PostGIS Sync' : 'Local PostGIS Engine',
      supabase_connected: isSupabaseConfigured,
      supabase_host: isSupabaseConfigured ? 'urthswyqlqbemubklhzx.supabase.co' : null,
      local_storage_path: 'BR/server/data/bhoomirakshak.json',
      active_sectors_monitored: localStats.regions || 0,
      active_field_commanders: localDB.getTable('users').filter(u => u.role === 'field_officer').length,
      active_administrators: localDB.getTable('users').filter(u => u.role === 'admin').length,
      registered_citizens: localDB.getTable('users').filter(u => u.role === 'citizen').length,
      table_counts: {
        local: localStats,
        supabase: supabaseStats
      },
      last_checked_at: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. View specific table contents (sanitized)
router.get('/table/:tableName', (req, res) => {
  const { tableName } = req.params;
  const validTables = [
    'regions',
    'users',
    'alerts',
    'risk_zones',
    'field_reports',
    'sensor_rainfall_data',
    'historical_landslides',
    'alert_subscriptions',
    'api_connection_status'
  ];

  if (!validTables.includes(tableName)) {
    return res.status(400).json({ error: `Invalid table '${tableName}'. Available: ${validTables.join(', ')}` });
  }

  const records = localDB.getTable(tableName).map(sanitizeRecord);
  return res.json({
    table: tableName,
    total_records: records.length,
    records
  });
});

// 3. Seed / Re-sync 1 Admin + 8 Field Commanders
router.post('/seed-commanders', async (req, res) => {
  try {
    await seedNERCommanders();
    return res.json({
      message: 'Successfully provisioned 8 NER State Monitored Corridors, 1 Admin and 8 Field Commanders.',
      commanders: localDB.getTable('users').filter(u => u.role === 'field_officer').map(sanitizeRecord)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
