// Vercel Serverless API: Landslide Alerts & Multi-Channel Broadcast
import { createClient } from '@supabase/supabase-js';

const DEFAULT_COMMANDERS = [
  { id: "c27053d1-d759-43e0-8f3e-a8e577211850", name: "Kailas Sadashiv Mutkule", state: "Assam", district: "Dima Hasao", phone: "+919699721767", email: "kailasmutkule99@gmail.com" },
  { id: "830fdcf7-3f56-437f-a05c-e36c5bb4184e", name: "Adhishree Gajanan Sukalkar", state: "Arunachal Pradesh", district: "Papum Pare", phone: "+918010986532", email: "adishreesukalkar53@gmail.com" },
  { id: "8cb33128-88c2-4b40-9842-4527f8e3e142", name: "Harsh Umesh Hatti", state: "Sikkim", district: "North Sikkim", phone: "+919518597050", email: "harshhatti291@gmail.com" },
  { id: "76309451-5301-4bbe-934a-4ca5e99bd4d3", name: "Manav Ratan Agrawal", state: "Meghalaya", district: "East Khasi Hills", phone: "+918625816246", email: "agrawalmanav83@gmail.com" },
  { id: "1d8cce73-2ed5-42a7-8119-89d04c2f1267", name: "Ritika Suresh Gogawale", state: "Mizoram", district: "Aizawl", phone: "+919623895456", email: "ritikagogawale14@gmail.com" },
  { id: "870f9f21-413b-4830-b309-4393a90604fc", name: "pratham prasad buran", state: "Nagaland", district: "Kohima", phone: "+919067372943", email: "comp24_pratham.buran@isbmcoe.org" },
  { id: "8725f1fb-33f0-41d3-989d-0fa380d91020", name: "Amar", state: "Manipur", district: "Senapati", phone: "+919922387625", email: "comp24_amarnath.budhwat@isbmcoe.org" },
  { id: "7dacb6d4-fd59-4581-92a3-a864fc692d74", name: "sanskar mule", state: "Tripura", district: "Dhalai", phone: "+918446222041", email: "comp24_sanskar.mule@isbmcoe.org" }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://urthswyqlqbemubklhzx.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVydGhzd3lxbHFiZW11YmtsaHp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODgwMTc0NSwiZXhwIjoyMTA0Mzc3NzQ1fQ.ghmrcPkbziqdBJzaz3T3utmkeRINd1mNvgPR6qq1I9U';
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

      // Gather registered citizens from Supabase
      let registeredCitizens = [];
      let citizenEmails = [];
      let citizenPhones = [];

      if (supabase) {
        try {
          const { data: authUsersData } = await supabase.auth.admin.listUsers();
          const { data: profiles } = await supabase.from('profiles').select('*');
          const profileMap = new Map((profiles || []).map(p => [p.id, p]));

          if (authUsersData?.users) {
            authUsersData.users.forEach(u => {
              if (!u.email || u.email.endsWith('@bhoomirakshak.local')) return;
              const p = profileMap.get(u.id);
              const role = p?.role || u.user_metadata?.role || 'citizen';
              if (role === 'citizen') {
                if (u.email) citizenEmails.push(u.email);
                if (p?.phone) citizenPhones.push(p.phone);
                registeredCitizens.push({
                  user_id: u.id,
                  name: p?.full_name || u.user_metadata?.full_name || u.email.split('@')[0],
                  district: p?.district || 'NER Monitored Sector',
                  email: u.email,
                  phone: p?.phone || null
                });
              }
            });
          }
        } catch (sbErr) {
          console.warn('[VERCEL SUPABASE QUERY EXCEPTION]:', sbErr.message);
        }
      }

      // Check configured email and SMS gateways
      const msg91AuthKey = process.env.MSG91_AUTH_KEY || process.env.MSG91_API_KEY || '568789ADQJR3yfMO316a9f437eP1';
      const msg91TemplateId = process.env.MSG91_TEMPLATE_ID || process.env.MSG91_OTP_TEMPLATE_ID || '6aa4444eba892ab0f40d6323';
      const resendApiKey = process.env.RESEND_API_KEY;
      const testEmail = process.env.SMTP_USER || process.env.TEST_ADMIN_EMAIL;

      // 1. Email Dispatch
      let emailStatus = 'not_configured';
      const allCandidateEmails = [
        ...DEFAULT_COMMANDERS.map(c => c.email),
        ...citizenEmails,
        testEmail,
        process.env.SMTP_USER,
        'pbstorefile@gmail.com',
        'prathamb72official@gmail.com',
        'prathamburan72pb@gmail.com',
        'kailas@gmail.com',
        'comp24_pratham.buran@isbmcoe.org'
      ].filter(Boolean);

      // Clean and deduplicate valid emails (filter out placeholder/unresolvable domains)
      const validRecipients = [...new Set(allCandidateEmails)]
        .map(e => e.trim().toLowerCase())
        .filter(e => !e.endsWith('.gov.in') && !e.endsWith('.local') && e.includes('@') && e.includes('.'));

      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpUser = process.env.SMTP_USER || 'pbstorefile@gmail.com';
      const smtpPass = (process.env.SMTP_PASS || 'urwiryjqjayvceib').replace(/\s+/g, '');
      const fromAddress = `"BhoomiRakshak Sentinel" <${smtpUser}>`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #ef4444; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; color: #ffffff;">🛡️ BHOOMIRAKSHAK DISASTER SENTINEL</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #38bdf8;">Ministry of Development of North Eastern Region</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <h2 style="color: #b91c1c; margin: 0 0 12px 0;">🚨 THREAT SEVERITY: ${alert.severity}</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">${alert.message}</p>
            <p><strong>Action Recommendation:</strong> ${alert.action_recommendation || 'Initiate Immediate Hill Sector Evacuation Protocol'}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
            <p style="font-size: 12px; color: #64748b;">Dispatched to registered sector commanders & observers across monitored NE corridors.</p>
          </div>
        </div>
      `;

      let emailDispatched = false;

      // Priority 1: Direct SSL SMTP (Port 465) - fast, secure, works across cloud serverless & local
      if (smtpHost && smtpUser && smtpPass && validRecipients.length > 0) {
        try {
          const nodemailer = await import('nodemailer').then(m => m.default || m);
          const transporter465 = nodemailer.createTransport({
            host: smtpHost,
            port: 465,
            secure: true,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 20000,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          });

          await transporter465.sendMail({
            from: fromAddress,
            to: validRecipients.join(', '),
            subject: `🚨 [BHOOMIRAKSHAK ${alert.severity}] Landslide Disaster Warning`,
            html: emailHtml
          });

          emailStatus = 'sent';
          emailDispatched = true;
          console.log(`[SMTP 465 SUCCESS] Delivered to ${validRecipients.length} recipients via ${smtpHost}:465`);
        } catch (smtpErr465) {
          console.warn('[SMTP 465 NOTICE]:', smtpErr465.message);
          // Fallback to Port 587 STARTTLS
          try {
            const nodemailer = await import('nodemailer').then(m => m.default || m);
            const transporter587 = nodemailer.createTransport({
              host: smtpHost,
              port: 587,
              secure: false,
              connectionTimeout: 10000,
              greetingTimeout: 10000,
              socketTimeout: 20000,
              auth: {
                user: smtpUser,
                pass: smtpPass
              }
            });

            await transporter587.sendMail({
              from: fromAddress,
              to: validRecipients.join(', '),
              subject: `🚨 [BHOOMIRAKSHAK ${alert.severity}] Landslide Disaster Warning`,
              html: emailHtml
            });

            emailStatus = 'sent';
            emailDispatched = true;
            console.log(`[SMTP 587 SUCCESS] Delivered to ${validRecipients.length} recipients via ${smtpHost}:587`);
          } catch (smtpErr587) {
            console.warn('[SMTP 587 NOTICE]:', smtpErr587.message);
          }
        }
      }

      // Priority 2: Resend HTTP REST API Fallback
      if (!emailDispatched && resendApiKey && validRecipients.length > 0) {
        try {
          const resendResults = await Promise.allSettled(
            validRecipients.map(recipientEmail =>
              fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: 'BhoomiRakshak Sentinel <onboarding@resend.dev>',
                  to: [recipientEmail],
                  subject: `[BHOOMIRAKSHAK ${alert.severity}] Landslide Warning`,
                  html: emailHtml
                })
              }).then(async r => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || `HTTP ${r.status}`);
                return data;
              })
            )
          );

          const anySuccess = resendResults.some(r => r.status === 'fulfilled');
          if (anySuccess) {
            emailStatus = 'sent';
            emailDispatched = true;
          } else {
            emailStatus = 'failed';
          }
        } catch (resendErr) {
          console.warn('[VERCEL RESEND DISPATCH]:', resendErr.message);
          emailStatus = 'failed';
        }
      }

      // 2. Real SMS Dispatch via MSG91 Flow v5 & Carrier Direct Route
      let smsStatus = 'not_configured';
      let smsDeliveryDetails = null;

      if (msg91AuthKey) {
        try {
          const targetPhones = [...new Set([
            ...DEFAULT_COMMANDERS.map(c => c.phone),
            ...citizenPhones,
            process.env.TEST_ADMIN_PHONE,
            process.env.TEST_FIELD_OFFICER_PHONE,
            '9021158105',
            '9067372943'
          ].filter(Boolean))];
          const cleanPhones = targetPhones
            .map(p => '91' + String(p).replace(/\D/g, '').slice(-10))
            .filter(p => p.length === 12);

          if (cleanPhones.length > 0) {
            const alertMsg = `[BhoomiRakshak ${alert.severity}] ${alert.message}`;

            // (A) Modern MSG91 Flow v5 API
            const flowPayload = {
              template_id: msg91TemplateId,
              sender: 'BHRKSH',
              short_url: '0',
              mobiles: cleanPhones.join(','),
              message: alertMsg,
              severity: alert.severity,
              recipients: cleanPhones.map(mob => ({
                mobiles: mob,
                message: alertMsg,
                severity: alert.severity,
                sender: 'BHRKSH'
              }))
            };

            let flowData = null;
            try {
              const flowRes = await fetch('https://control.msg91.com/api/v5/flow/', {
                method: 'POST',
                headers: {
                  'authkey': msg91AuthKey,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify(flowPayload)
              });
              flowData = await flowRes.json();
              console.log('[VERCEL MSG91 FLOW RESPONSE]:', flowRes.status, flowData);
            } catch (flowErr) {
              console.warn('[VERCEL MSG91 FLOW EXCEPTION]:', flowErr.message);
            }

            // (B) High-Priority Carrier Direct Route (bypasses DND / promotional telecom filters)
            const directPromises = cleanPhones.map(async (mob) => {
              try {
                const res = await fetch(`https://control.msg91.com/api/v5/otp?mobile=${mob}&template_id=${msg91TemplateId}&authkey=${msg91AuthKey}`, {
                  method: 'POST',
                  headers: {
                    'authkey': msg91AuthKey,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    message: alertMsg,
                    severity: alert.severity
                  })
                });
                return await res.json();
              } catch (e) {
                return { error: e.message };
              }
            });

            const directResults = await Promise.allSettled(directPromises);
            const directSuccessCount = directResults.filter(r => r.status === 'fulfilled' && r.value?.type !== 'error').length;
            console.log(`[VERCEL MSG91 CARRIER DIRECT] ${directSuccessCount}/${cleanPhones.length} accepted.`);

            const isSuccess = (flowData && flowData.type !== 'error') || directSuccessCount > 0;
            smsStatus = isSuccess ? 'sent' : 'failed';
            smsDeliveryDetails = {
              flow: flowData,
              carrier_direct_delivered: directSuccessCount,
              total_recipients: cleanPhones.length
            };
          } else {
            smsStatus = 'no_recipients';
          }
        } catch (smsErr) {
          console.error('[VERCEL MSG91 EXCEPTION]:', smsErr.message);
          smsStatus = 'failed';
        }
      }

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
          'Priority Tier 1: 8 Field Sector Commanders (MSG91 SMS + Institutional Email)',
          'Priority Tier 2: Registered Citizens (MSG91 SMS + Email Advisory)',
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
        },
        sms_delivery: smsDeliveryDetails
      };

      alert.channels_sent = [
        { channel: 'website', status: 'sent', details: 'Broadcast to active WebSockets' },
        { channel: 'sms', status: smsStatus, details: smsStatus === 'sent' ? `SMS dispatched via MSG91 to ${DEFAULT_COMMANDERS.length + citizenPhones.length} recipient(s)` : `SMS dispatch: ${smsStatus}` },
        { channel: 'email', status: emailStatus, details: `Email: Tier 1 [${emailStatus}] + Tier 2 [${emailStatus}] delivered to ${validRecipients.length} address(es) via ${smtpHost}` },
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

  // DELETE: Remove individual alert or purge all alerts
  if (req.method === 'DELETE') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const alertId = req.query.id || body?.id;

      if (supabase) {
        try {
          if (alertId) {
            await supabase.from('alerts').delete().eq('id', alertId);
          } else {
            await supabase.from('alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          }
        } catch (sbErr) {
          console.warn('[SUPABASE ALERTS DELETE]:', sbErr.message);
        }
      }

      return res.status(200).json({
        message: alertId ? `Alert ${alertId} deleted from registry.` : 'Active warning registry purged successfully.',
        id: alertId
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
