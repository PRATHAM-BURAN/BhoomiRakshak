import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { dispatchAlert, dispatchSmsChannel, dispatchEmailChannel, dispatchPushChannel } from '../services/alertDispatcher.js';

const router = express.Router();

// 1. GET /api/alerts: Scoped alerts feed
router.get('/', optionalAuth, async (req, res) => {
  let alerts = localDB.getTable('alerts');
  const user = req.user;

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('alerts').select('*').order('created_at', { ascending: false });
      if (user && user.role === 'field_officer' && user.region_id) {
        query = query.or(`region_id.eq.${user.region_id},severity.eq.critical`);
      } else if (user && user.role === 'citizen' && user.region_id) {
        query = query.or(`region_id.eq.${user.region_id},severity.eq.critical`);
      }
      const { data: sbAlerts } = await query;
      if (sbAlerts && sbAlerts.length > 0) {
        const { data: regions } = await supabase.from('regions').select('id, name, district, state');
        const regionMap = {};
        (regions || []).forEach(r => { regionMap[r.id] = `${r.district}, ${r.state}`; });

        alerts = sbAlerts.map(a => ({
          ...a,
          region_name: regionMap[a.region_id] || 'Monitored Sector',
          severity: a.severity.toUpperCase()
        }));
      }
    } catch (sbErr) {
      console.warn('[SUPABASE ALERTS QUERY]:', sbErr.message);
    }
  } else {
    if (user && user.role === 'field_officer' && user.region_id) {
      alerts = alerts.filter(a => a.region_id === user.region_id || a.severity === 'CRITICAL');
    } else if (user && user.role === 'citizen' && user.region_id) {
      alerts = alerts.filter(a => a.region_id === user.region_id || a.severity === 'CRITICAL');
    }
  }

  return res.json({ alerts });
});

// 2. POST /api/alerts: Admin manual alert broadcast
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { region_id, region_ids, risk_zone_id, severity, message, reasons, action_recommendation } = req.body;

    const targetRegionIds = Array.isArray(region_ids) && region_ids.length > 0 
      ? region_ids 
      : (region_id ? [region_id] : []);

    if (targetRegionIds.length === 0 || !severity || !message) {
      return res.status(400).json({ error: 'At least one target district (region_id or region_ids), severity, and message are required.' });
    }

    const validSeverities = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(severity.toUpperCase())) {
      return res.status(400).json({ error: `Severity must be one of: ${validSeverities.join(', ')}` });
    }

    const regions = localDB.getTable('regions');
    const matchedRegions = regions.filter(r => targetRegionIds.includes(r.id));
    const regionNames = matchedRegions.map(r => `${r.district}, ${r.state}`).join(' | ') || 'Northeast India Monitored Sector';

    const newAlert = {
      id: uuidv4(),
      region_id: targetRegionIds[0],
      region_ids: targetRegionIds,
      region_name: regionNames,
      risk_zone_id: risk_zone_id || null,
      severity: severity.toUpperCase(),
      message,
      reasons: reasons || ['Admin Emergency Multi-District Broadcast'],
      action_recommendation: action_recommendation || (severity.toUpperCase() === 'CRITICAL' ? 'Evacuate Downhill Zones Immediately' : 'Mobilize SDRF Patrols'),
      created_by: req.user.id,
      created_by_name: req.user.name,
      created_at: new Date().toISOString(),
      channels_sent: []
    };

    // Dispatch across multi-channel dispatcher (Web, SMS, Email, Push) with Priority Tiers
    const deliveryReport = await dispatchAlert(newAlert);
    newAlert.channels_sent = deliveryReport.channels_sent || deliveryReport;
    newAlert.priority_dispatch = deliveryReport.priority_dispatch;

    const alerts = localDB.getTable('alerts');
    alerts.unshift(newAlert);
    localDB.save();

    // Persist to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('alerts').insert([{
          id: newAlert.id,
          region_id: targetRegionIds[0],
          risk_zone_id: risk_zone_id || null,
          severity: severity.toLowerCase(),
          message,
          reasons: newAlert.reasons,
          created_by: 'admin',
          created_by_user: req.user.id,
          channels_sent: newAlert.channels_sent
        }]);
      } catch (sbErr) {
        console.warn('[SUPABASE ALERTS INSERT]:', sbErr.message);
      }
    }

    return res.status(201).json({
      message: `Emergency alert broadcasted across ${targetRegionIds.length} district(s) with Priority Tier 1 (8 Commanders) and Tier 2 (Citizens).`,
      alert: newAlert,
      priority_dispatch: deliveryReport.priority_dispatch
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2b. POST /api/alerts/dispatch: Webhook or trigger endpoint for multi-channel dispatch
router.post('/dispatch', async (req, res) => {
  try {
    const alertData = req.body.record || req.body;
    if (!alertData || (!alertData.message && !alertData.id)) {
      return res.status(400).json({ error: 'Valid alert payload or record required.' });
    }

    const alertId = alertData.id || uuidv4();
    const alertToDispatch = {
      id: alertId,
      region_id: alertData.region_id,
      severity: (alertData.severity || 'HIGH').toUpperCase(),
      message: alertData.message || 'Landslide hazard alert in your sector.',
      reasons: alertData.reasons || ['Automated ML Early Warning Trigger'],
      channels_sent: []
    };

    // Dispatch concurrently across Web, MSG91 SMS, and FCM v1 Push
    const deliveryReport = await dispatchAlert(alertToDispatch);
    alertToDispatch.channels_sent = deliveryReport;

    // Update Supabase channels_sent if alert exists in Supabase
    if (isSupabaseConfigured && supabase && alertData.id) {
      try {
        await supabase
          .from('alerts')
          .update({ channels_sent: deliveryReport })
          .eq('id', alertData.id);
      } catch (sbErr) {
        console.warn('[SUPABASE CHANNELS UPDATE]:', sbErr.message);
      }
    }

    return res.json({
      message: 'Alert dispatched across multi-channel emergency network.',
      alert_id: alertId,
      channels_sent: deliveryReport
    });
  } catch (err) {
    console.error('[ALERT DISPATCH ERROR]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/alerts/subscribe: Citizen SMS/Push alert preferences
router.post('/subscribe', requireAuth, (req, res) => {
  try {
    const { region_id, sms_enabled, push_enabled } = req.body;
    if (!region_id) {
      return res.status(400).json({ error: 'region_id is required.' });
    }

    const subscriptions = localDB.getTable('alert_subscriptions');
    let sub = subscriptions.find(s => s.user_id === req.user.id && s.region_id === region_id);

    if (sub) {
      if (typeof sms_enabled !== 'undefined') sub.sms_enabled = Boolean(sms_enabled);
      if (typeof push_enabled !== 'undefined') sub.push_enabled = Boolean(push_enabled);
    } else {
      sub = {
        id: uuidv4(),
        user_id: req.user.id,
        region_id,
        sms_enabled: Boolean(sms_enabled),
        push_enabled: Boolean(push_enabled),
        created_at: new Date().toISOString()
      };
      subscriptions.push(sub);
    }

    localDB.save();

    return res.json({
      message: 'Alert subscription preferences updated.',
      subscription: sub
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. GET /api/alerts/subscriptions: User's subscriptions
router.get('/subscriptions', requireAuth, (req, res) => {
  const subscriptions = localDB.getTable('alert_subscriptions');
  const userSubs = subscriptions.filter(s => s.user_id === req.user.id);
  return res.json({ subscriptions: userSubs });
});

// 5. POST /api/alerts/test-dispatch: Admin single-channel verification test
router.post('/test-dispatch', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { channel, target } = req.body;
    const normalizedChannel = (channel || '').toLowerCase().trim();

    if (!['sms', 'email', 'push'].includes(normalizedChannel)) {
      return res.status(400).json({ error: "channel must be one of: 'sms', 'email', 'push'" });
    }

    if (!target && normalizedChannel !== 'push') {
      return res.status(400).json({
        error: `Target address/number is required for channel '${normalizedChannel}'. (e.g. phone with country code for SMS, email address for email)`
      });
    }

    const testAlert = {
      id: uuidv4(),
      severity: 'MODERATE',
      message: 'This is a live operational verification test from BhoomiRakshak Disaster Sentinel.',
      trigger_reason: 'Admin Integration Verification',
      action_recommendation: 'Acknowledge test receipt on recipient device.'
    };

    let result;
    if (normalizedChannel === 'sms') {
      result = await dispatchSmsChannel(testAlert, [target]);
    } else if (normalizedChannel === 'email') {
      result = await dispatchEmailChannel(testAlert, [target], 'SYSTEM_INTEGRATION_TEST');
    } else if (normalizedChannel === 'push') {
      result = await dispatchPushChannel(testAlert, target || 'test_channel');
    }

    return res.json({
      channel: normalizedChannel,
      target: target || 'all_push_subscribers',
      status: result.status,
      success: result.status === 'sent',
      details: result.details,
      raw_provider_response: result.raw_response || result
    });
  } catch (err) {
    console.error('[TEST-DISPATCH EXCEPTION]:', err);
    return res.status(500).json({
      channel: req.body?.channel,
      status: 'failed',
      error: err.message
    });
  }
});

// 6. GET /api/alerts/subscribers-count: Live verified SMS subscribers count per region
router.get('/subscribers-count', optionalAuth, async (req, res) => {
  try {
    const regions = localDB.getTable('regions');
    const localUsers = localDB.getTable('users');

    let allVerifiedUsers = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: profiles, error: sbErr } = await supabase
          .from('profiles')
          .select('id, role, region_id, phone, sms_enabled')
          .not('phone', 'is', null)
          .eq('sms_enabled', true);

        if (!sbErr && profiles) {
          allVerifiedUsers = profiles;
        }
      } catch (err) {
        console.warn('[SUPABASE SUBSCRIBERS COUNT]:', err.message);
      }
    }

    // Merge or fallback to localDB
    if (allVerifiedUsers.length === 0) {
      allVerifiedUsers = localUsers.filter(u => u.phone && u.sms_enabled !== false && u.is_active !== false);
    }

    const byRegion = regions.map(r => {
      const regionSubscribers = allVerifiedUsers.filter(u => 
        u.region_id === r.id || (Array.isArray(u.region_ids) && u.region_ids.includes(r.id))
      );
      const officerCount = regionSubscribers.filter(u => u.role === 'field_officer').length;
      const citizenCount = regionSubscribers.filter(u => u.role === 'citizen').length;

      return {
        region_id: r.id,
        district: r.district,
        state: r.state,
        total_verified: regionSubscribers.length,
        officer_count: officerCount,
        citizen_count: citizenCount
      };
    });

    const totalVerified = allVerifiedUsers.length;

    return res.json({
      total_verified_subscribers: totalVerified,
      by_region: byRegion
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/alerts/:id/acknowledge: Record acknowledgment
router.post('/:id/acknowledge', requireAuth, async (req, res) => {
  try {
    const alertId = req.params.id;
    const userId = req.user.id;
    const now = new Date().toISOString();

    const acks = localDB.getTable('alert_acknowledgments');
    let ackRecord = acks.find(a => a.alert_id === alertId && a.user_id === userId);

    if (!ackRecord) {
      ackRecord = {
        id: uuidv4(),
        alert_id: alertId,
        user_id: userId,
        user_role: req.user.role,
        user_name: req.user.name,
        acknowledged_at: now
      };
      acks.push(ackRecord);
      localDB.save();
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('alert_acknowledgments').upsert({
          alert_id: alertId,
          user_id: userId,
          acknowledged_at: now
        }, { onConflict: 'alert_id,user_id' });
      } catch (sbErr) {
        console.warn('[SUPABASE ACKNOWLEDGMENT INSERT]:', sbErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'Alert acknowledgment recorded.',
      acknowledgment: ackRecord
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 8. GET /api/alerts/unacknowledged: Fetch unacknowledged alerts for offline/reconnect recovery
router.get('/unacknowledged', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const hours = parseInt(req.query.hours || '24', 10);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let alerts = [];
    const acknowledgedIds = new Set();

    // 1. Collect acknowledged alert IDs
    const localAcks = localDB.getTable('alert_acknowledgments');
    localAcks.filter(a => a.user_id === user.id).forEach(a => acknowledgedIds.add(a.alert_id));

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sbAcks } = await supabase
          .from('alert_acknowledgments')
          .select('alert_id')
          .eq('user_id', user.id);
        (sbAcks || []).forEach(a => acknowledgedIds.add(a.alert_id));

        // Query Supabase alerts
        let query = supabase
          .from('alerts')
          .select('*')
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false });

        if (user.role === 'admin') {
          // Admin sees all
        } else if (user.region_id) {
          query = query.or(`region_id.eq.${user.region_id},severity.eq.critical`);
        } else {
          query = query.eq('severity', 'critical');
        }

        const { data: sbAlerts } = await query;
        if (sbAlerts && sbAlerts.length > 0) {
          const { data: regions } = await supabase.from('regions').select('id, district, state');
          const regionMap = {};
          (regions || []).forEach(r => { regionMap[r.id] = `${r.district}, ${r.state}`; });

          alerts = sbAlerts.map(a => ({
            ...a,
            region_name: regionMap[a.region_id] || 'Monitored Sector',
            severity: a.severity.toUpperCase()
          }));
        }
      } catch (sbErr) {
        console.warn('[SUPABASE UNACKNOWLEDGED ALERTS]:', sbErr.message);
      }
    }

    if (alerts.length === 0) {
      const localAlerts = localDB.getTable('alerts');
      alerts = localAlerts.filter(a => {
        if (a.created_at && a.created_at < cutoffTime) return false;
        if (user.role === 'admin') return true;
        if (a.severity === 'CRITICAL') return true;
        if (user.region_id && a.region_id === user.region_id) return true;
        if (Array.isArray(user.region_ids) && user.region_ids.includes(a.region_id)) return true;
        return false;
      });
    }

    // Filter out already acknowledged
    const unacknowledged = alerts.filter(a => !acknowledgedIds.has(a.id));

    return res.json({ alerts: unacknowledged });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
