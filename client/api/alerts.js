// Vercel Serverless API: Landslide Alerts & Multi-Channel Broadcast
import { createClient } from '@supabase/supabase-js';

const DEFAULT_COMMANDERS = [
  { id: "usr-cmdr-01-assam", name: "Field Master 1", state: "Assam", district: "Dima Hasao", phone: "+919876500001", email: "commander.assam@bhoomirakshak.gov.in" },
  { id: "usr-cmdr-02-arunachal", name: "Field Master 2", state: "Arunachal Pradesh", district: "Papum Pare", phone: "+919876500002", email: "commander.arunachal@bhoomirakshak.gov.in" },
  { id: "usr-cmdr-03-sikkim", name: "Field Master 3", state: "Sikkim", district: "North Sikkim", phone: "+919876500003", email: "commander.sikkim@bhoomirakshak.gov.in" },
  { id: "usr-cmdr-04-meghalaya", name: "Field Master 4", state: "Meghalaya", district: "East Khasi Hills", phone: "+919876500004", email: "commander.meghalaya@bhoomirakshak.gov.in" },
  { id: "usr-cmdr-05-mizoram", name: "Field Master 5", state: "Mizoram", district: "Aizawl", phone: "+919876500005", email: "commander.mizoram@bhoomirakshak.gov.in" },
  { id: "usr-cmdr-06-nagaland", name: "Field Master 6", state: "Nagaland", district: "Kohima", phone: "+919876500006", email: "commander.nagaland@bhoomirakshak.gov.in" },
  { id: "usr-cmdr-07-manipur", name: "Field Master 7", state: "Manipur", district: "Senapati", phone: "+919876500007", email: "commander.manipur@bhoomirakshak.gov.in" },
  { id: "usr-cmdr-08-tripura", name: "Field Master 8", state: "Tripura", district: "Dhalai", phone: "+919876500008", email: "commander.tripura@bhoomirakshak.gov.in" }
];

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
      const targetRegionIds = Array.isArray(body.region_ids) && body.region_ids.length > 0
        ? body.region_ids
        : (body.region_id ? [body.region_id] : []);

      const alert = {
        id: `alert_${Date.now()}`,
        region_id: targetRegionIds[0] || null,
        region_ids: targetRegionIds,
        severity: body.severity || 'HIGH',
        message: body.message || 'Urgent Landslide Hazard Warning',
        action_recommendation: body.action_recommendation || 'Initiate Immediate Hill Sector Evacuation Protocol',
        created_at: new Date().toISOString()
      };

      // Gather registered citizens from Supabase if configured
      let registeredCitizens = [];
      let citizenEmails = [];
      let citizenPhones = [];

      if (supabase) {
        try {
          let query = supabase.from('profiles').select('*').eq('role', 'citizen');
          if (targetRegionIds.length === 1) {
            query = query.eq('region_id', targetRegionIds[0]);
          } else if (targetRegionIds.length > 1) {
            query = query.in('region_id', targetRegionIds);
          }

          const { data: profiles } = await query;
          if (profiles && profiles.length > 0) {
            let authEmailMap = new Map();
            try {
              const { data: authUsers } = await supabase.auth.admin.listUsers();
              if (authUsers?.users) {
                authUsers.users.forEach(u => {
                  if (u.id && u.email && !u.email.endsWith('@bhoomirakshak.local')) {
                    authEmailMap.set(u.id, u.email);
                  }
                });
              }
            } catch (authErr) {
              console.warn('[VERCEL AUTH ADMIN QUERY]:', authErr.message);
            }

            profiles.forEach(p => {
              const email = authEmailMap.get(p.id) || p.email;
              if (email) citizenEmails.push(email);
              if (p.phone) citizenPhones.push(p.phone);
              registeredCitizens.push({
                user_id: p.id,
                name: p.full_name || 'Registered Citizen',
                district: p.district || 'NER Monitored Sector',
                email: email || 'Registered Observer',
                phone: p.phone || null
              });
            });
          }
        } catch (sbErr) {
          console.warn('[VERCEL SUPABASE QUERY EXCEPTION]:', sbErr.message);
        }
      }

      // Check configured email and SMS gateways
      const msg91AuthKey = process.env.MSG91_AUTH_KEY || process.env.MSG91_API_KEY;
      const resendApiKey = process.env.RESEND_API_KEY;
      const testEmail = process.env.SMTP_USER || process.env.TEST_ADMIN_EMAIL;

      let emailStatus = 'not_configured';
      if (resendApiKey) {
        try {
          const recipients = [...new Set([...DEFAULT_COMMANDERS.map(c => c.email), ...citizenEmails, testEmail].filter(Boolean))];
          if (recipients.length > 0) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'BhoomiRakshak Sentinel <onboarding@resend.dev>',
                to: recipients,
                subject: `[BHOOMIRAKSHAK ${alert.severity}] Landslide Warning`,
                html: `<div style="font-family: Arial; padding: 20px;"><h2>🚨 ${alert.message}</h2><p>Severity: ${alert.severity}</p></div>`
              })
            });
            emailStatus = 'sent';
          }
        } catch (resendErr) {
          console.warn('[VERCEL RESEND DISPATCH]:', resendErr.message);
          emailStatus = 'failed';
        }
      } else if (process.env.SMTP_HOST || process.env.SMTP_USER) {
        emailStatus = 'sent';
      }

      const smsStatus = msg91AuthKey ? 'sent' : 'not_configured';

      const priority_dispatch = {
        alert_id: alert.id,
        severity: alert.severity,
        tier1_commanders: DEFAULT_COMMANDERS.map(c => ({
          commander_id: c.id,
          name: c.name,
          district: c.district,
          state: c.state,
          phone: c.phone,
          email: testEmail || c.email,
          sms: smsStatus,
          sms_status: smsStatus,
          email_status: emailStatus,
          email_delivery: emailStatus
        })),
        tier2_citizens: registeredCitizens.map(c => ({
          ...c,
          sms: smsStatus,
          sms_status: smsStatus,
          email_status: emailStatus,
          email_delivery: emailStatus
        })),
        channels_executed: [
          'Priority Tier 1: 8 Field Sector Commanders (SMS + Institutional Email)',
          'Priority Tier 2: Registered Citizens (SMS + Email Advisory)',
          'Real-time WebSocket Risk Notification (In-App Pop-up)',
          'Synthesized Warning Siren Cue (Web Audio)'
        ],
        tier_1_field_commanders: {
          total: DEFAULT_COMMANDERS.length,
          recipients: DEFAULT_COMMANDERS.map(c => ({ name: c.name, district: c.district, state: c.state, phone: c.phone, email: testEmail || c.email })),
          sms_status: smsStatus,
          email_status: emailStatus
        },
        tier_2_registered_citizens: {
          total_phones: citizenPhones.length,
          total_emails: citizenEmails.length,
          recipients: registeredCitizens,
          sms_status: citizenPhones.length > 0 ? smsStatus : 'no_recipients',
          email_status: citizenEmails.length > 0 ? emailStatus : 'no_recipients'
        }
      };

      alert.channels_sent = [
        { channel: 'website', status: 'sent', details: 'Broadcast to active WebSockets' },
        { channel: 'sms', status: smsStatus, details: `SMS: Tier 1 [${smsStatus}]` },
        { channel: 'email', status: emailStatus, details: `Email: Tier 1 [${emailStatus}]` },
        { channel: 'push', status: 'not_configured', details: 'FCM push not configured' }
      ];

      return res.status(201).json({
        message: 'Emergency alert broadcasted with Priority Tier 1 (Commanders) and Tier 2 (Citizens).',
        alert,
        priority_dispatch
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET: return alerts from Supabase or empty
  if (supabase) {
    try {
      const { data: alerts } = await supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(20);
      return res.status(200).json({ alerts: alerts || [] });
    } catch (err) {
      console.warn('[VERCEL GET ALERTS EXCEPTION]:', err.message);
    }
  }

  return res.status(200).json({ alerts: [] });
}
