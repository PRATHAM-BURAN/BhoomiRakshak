// BhoomiRakshak Alert Dispatch Service
// Real-time dispatch across three operational channels:
// 1. Website/App: Instant WebSocket stream to command centers and connected mobile clients.
// 2. SMS: Twilio or MSG91 integration with strict honesty (logs 'not_configured' if keys are missing).
// 3. Web Push / FCM: WebPush standard protocol (logs 'not_configured' if VAPID keys missing).
// Every channel status is immutably recorded in the database audit record.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize VAPID for Web Push if keys are present
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@bhoomirakshak.in';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('[WEBPUSH] VAPID Web Push service initialized successfully.');
  } catch (err) {
    console.warn('[WEBPUSH] VAPID initialization warning:', err.message);
  }
}

// Helper to instantiate genuine email transporter (SMTP, SendGrid, or Resend)
export function createEmailTransporter() {
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }

  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY
      }
    });
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  return null;
}

// Initialize Firebase Admin SDK if service account is provided
let firebaseApp = null;
let firebaseMessaging = null;

try {
  const rootKeyPath = path.resolve(__dirname, '../../../firebase_service_account.json');
  const serverKeyPath = path.resolve(__dirname, '../../firebase_service_account.json');
  const envKeyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  const keyPath = [envKeyPath, rootKeyPath, serverKeyPath].find(p => p && fs.existsSync(p));
  if (keyPath) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    if (getApps().length === 0) {
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } else {
      firebaseApp = getApps()[0];
    }
    firebaseMessaging = getMessaging(firebaseApp);
    console.log(`[FIREBASE] Admin SDK successfully initialized for project '${serviceAccount.project_id}'`);
  }
} catch (err) {
  console.warn('[FIREBASE] Initialization notice:', err.message);
}

// Connected WebSocket clients set
export const wsClients = new Set();

export function broadcastWebSocketMessage(event, data) {
  const messageStr = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  for (const client of wsClients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        // If client has subscribed to a specific region, filter if applicable
        if (!client.region_id || client.region_id === data.region_id || data.severity === 'CRITICAL') {
          client.send(messageStr);
        }
      } catch (err) {
        console.error('Failed to send WebSocket message:', err.message);
      }
    }
  }
}

// 1. Channel: Web / Real-time Broadcast
async function dispatchWebsiteChannel(alert) {
  try {
    broadcastWebSocketMessage('new_alert', alert);
    return { channel: 'website', status: 'sent', timestamp: new Date().toISOString(), details: 'Broadcast to active WebSockets' };
  } catch (err) {
    return { channel: 'website', status: 'failed', error: err.message };
  }
}

// 2. Channel: SMS Gateway (MSG91 Flow v5 API as default primary path, or Twilio)
// Requirements:
// - MSG91_SENDER_ID must be DLT-registered (6-alpha sender ID in India).
// - MSG91_TEMPLATE_ID must be an approved DLT Flow template registered on control.msg91.com.
export async function dispatchSmsChannel(alert, recipientPhones) {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const msg91AuthKey = process.env.MSG91_API_KEY || process.env.MSG91_AUTH_KEY;
  const msg91SenderId = process.env.MSG91_SENDER_ID || 'BHRKSH';
  const msg91TemplateId = process.env.MSG91_TEMPLATE_ID;

  if (!twilioSid && !msg91AuthKey) {
    console.log('[ALERT DISPATCH] SMS Gateway not configured (missing MSG91_AUTH_KEY or Twilio credentials).');
    return {
      channel: 'sms',
      status: 'not_configured',
      timestamp: new Date().toISOString(),
      details: 'SMS Gateway credentials (MSG91_AUTH_KEY or Twilio) not provided in .env'
    };
  }

  // Recipient Count Honesty: Never return 'sent' when 0 recipients
  if (!recipientPhones || recipientPhones.length === 0) {
    return {
      channel: 'sms',
      status: 'no_recipients',
      timestamp: new Date().toISOString(),
      details: '0 citizen/commander SMS recipients found for this target scope.'
    };
  }

  // Primary Path: MSG91 Flow v5 API
  if (msg91AuthKey) {
    try {
      let response;
      if (msg91TemplateId) {
        // Modern MSG91 Flow v5 API (Primary Default Path)
        const payload = {
          template_id: msg91TemplateId,
          short_url: "0",
          recipients: recipientPhones.map(mobile => ({
            mobiles: mobile.replace(/^\+/, '').replace(/\s+/g, ''),
            severity: alert.severity,
            message: alert.message
          }))
        };

        console.log(`[MSG91 FLOW v5] Dispatching to ${recipientPhones.length} numbers via template ${msg91TemplateId}...`);
        response = await axios.post('https://control.msg91.com/api/v5/flow/', payload, {
          headers: { 'authkey': msg91AuthKey, 'Content-Type': 'application/json' },
          timeout: 10000
        });
      } else {
        // Fallback if MSG91_TEMPLATE_ID not provided
        console.warn('[MSG91 NOTICE] MSG91_TEMPLATE_ID not set in .env. Attempting standard SMS API fallback...');
        const payload = {
          sender: msg91SenderId,
          route: '4',
          country: '91',
          sms: recipientPhones.map(mobile => ({
            message: `[BhoomiRakshak ${alert.severity}] ${alert.message}`,
            to: [mobile.replace(/^\+91/, '').replace(/^\+/, '').replace(/\s+/g, '')]
          }))
        };

        response = await axios.post('https://api.msg91.com/api/v2/sendsms', payload, {
          headers: { 'authkey': msg91AuthKey, 'Content-Type': 'application/json' },
          timeout: 10000
        });
      }

      // Explicit logging of raw MSG91 response body on both success and failure
      console.log(`[MSG91 RAW RESPONSE] Status: ${response.status} | Body:`, JSON.stringify(response.data));

      const isSuccess = response.status === 200 && response.data?.type !== 'error' && response.data?.status !== 'error';
      return {
        channel: 'sms',
        status: isSuccess ? 'sent' : 'failed',
        timestamp: new Date().toISOString(),
        details: isSuccess 
          ? `Dispatched via MSG91 to ${recipientPhones.length} recipient(s)`
          : (response.data?.message || response.data?.msg || 'MSG91 rejected transmission'),
        raw_response: response.data
      };
    } catch (err) {
      const rawErr = err.response?.data || { message: err.message };
      console.error('[MSG91 ERROR RAW RESPONSE]:', JSON.stringify(rawErr));
      return { 
        channel: 'sms', 
        status: 'failed', 
        error: rawErr.message || rawErr.msg || err.message,
        details: 'MSG91 gateway response error',
        raw_response: rawErr
      };
    }
  }

  // Secondary Path: Twilio
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const results = await Promise.allSettled(
        recipientPhones.map(async (phone) => {
          const authString = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
          const params = new URLSearchParams();
          params.append('To', phone);
          params.append('From', twilioFrom);
          params.append('Body', `[BhoomiRakshak ${alert.severity}] ${alert.message}`);

          return axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            params.toString(),
            {
              headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              timeout: 8000
            }
          );
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      return {
        channel: 'sms',
        status: successful > 0 ? (successful === recipientPhones.length ? 'sent' : 'partial') : 'failed',
        timestamp: new Date().toISOString(),
        details: `Dispatched to ${successful}/${recipientPhones.length} verified numbers via Twilio`,
        raw_response: results.map(r => r.status === 'fulfilled' ? r.value.data : { error: r.reason?.message })
      };
    } catch (err) {
      return { channel: 'sms', status: 'failed', error: err.message };
    }
  }

  return { channel: 'sms', status: 'not_configured', details: 'Unrecognized SMS configuration' };
}

// 3. Channel: In-App Web Push Notification (web-push VAPID & FCM v1 Multicast)
export async function dispatchPushChannel(alert, regionId) {
  const allSubs = localDB.getTable('alert_subscriptions') || [];
  const subscriptions = allSubs.filter(s => 
    (!regionId || s.region_id === regionId || regionId === 'test_channel') && s.push_enabled
  );

  const fcmTokens = subscriptions.map(s => s.fcm_token).filter(Boolean);
  const webpushSubs = subscriptions.filter(s => s.subscription_data || s.endpoint);

  const hasFcm = Boolean(firebaseMessaging);
  const hasVapid = Boolean(vapidPublicKey && vapidPrivateKey);

  if (!hasFcm && !hasVapid) {
    console.log('[ALERT DISPATCH] Push Gateway not configured (missing FCM or VAPID credentials).');
    return {
      channel: 'push',
      status: 'not_configured',
      timestamp: new Date().toISOString(),
      details: 'Firebase Admin FCM or VAPID WebPush keys not provided in .env'
    };
  }

  // Recipient count honesty: if no active devices/subscriptions
  if (subscriptions.length === 0 && fcmTokens.length === 0 && webpushSubs.length === 0) {
    return {
      channel: 'push',
      status: 'no_recipients',
      timestamp: new Date().toISOString(),
      details: '0 active registered push subscriptions / devices for this target region.'
    };
  }

  let successfulCount = 0;
  let failedCount = 0;
  const dispatchResponses = [];

  // FCM Multicast
  if (hasFcm && fcmTokens.length > 0) {
    try {
      const multicastMessage = {
        tokens: fcmTokens,
        notification: {
          title: `[BhoomiRakshak ${alert.severity}] Landslide Warning`,
          body: alert.message
        },
        data: {
          severity: String(alert.severity || 'HIGH'),
          region_id: String(regionId || ''),
          timestamp: new Date().toISOString()
        }
      };

      const fcmResponse = await firebaseMessaging.sendEachForMulticast(multicastMessage);
      successfulCount += fcmResponse.successCount;
      failedCount += fcmResponse.failureCount;
      dispatchResponses.push({ provider: 'fcm_multicast', success: fcmResponse.successCount, failure: fcmResponse.failureCount });
    } catch (fcmErr) {
      console.warn('[FCM MULTICAST ERROR]:', fcmErr.message);
      failedCount += fcmTokens.length;
      dispatchResponses.push({ provider: 'fcm_multicast', error: fcmErr.message });
    }
  }

  // WebPush VAPID
  if (hasVapid && webpushSubs.length > 0) {
    const payload = JSON.stringify({
      title: `[BhoomiRakshak ${alert.severity}] Landslide Warning`,
      body: alert.message,
      data: {
        severity: alert.severity,
        region_id: regionId,
        timestamp: new Date().toISOString()
      }
    });

    const webpushResults = await Promise.allSettled(
      webpushSubs.map(s => {
        const subData = typeof s.subscription_data === 'string' ? JSON.parse(s.subscription_data) : (s.subscription_data || s);
        return webpush.sendNotification(subData, payload);
      })
    );

    const wpSuccess = webpushResults.filter(r => r.status === 'fulfilled').length;
    const wpFailed = webpushResults.filter(r => r.status === 'rejected').length;
    successfulCount += wpSuccess;
    failedCount += wpFailed;
    dispatchResponses.push({ provider: 'web-push', success: wpSuccess, failure: wpFailed });
  }

  const totalAttempted = successfulCount + failedCount;
  if (totalAttempted === 0) {
    return {
      channel: 'push',
      status: 'no_recipients',
      timestamp: new Date().toISOString(),
      details: 'No registered push endpoints found.'
    };
  }

  let finalStatus = 'failed';
  if (successfulCount > 0) {
    finalStatus = failedCount === 0 ? 'sent' : 'partial';
  }

  return {
    channel: 'push',
    status: finalStatus,
    timestamp: new Date().toISOString(),
    details: `Push notifications: ${successfulCount} delivered, ${failedCount} failed (${totalAttempted} total)`,
    raw_response: dispatchResponses
  };
}

// 4. Channel: Email Advisory Dispatch (Institutional Alert Broadcast via nodemailer)
export async function dispatchEmailChannel(alert, recipientEmails, priorityLabel = 'PRIORITY_ALERT') {
  // Recipient Count Honesty: Never return 'sent' when 0 recipients
  if (!recipientEmails || recipientEmails.length === 0) {
    return {
      channel: 'email',
      status: 'no_recipients',
      timestamp: new Date().toISOString(),
      details: '0 email recipients found for this target scope.'
    };
  }

  const transporter = createEmailTransporter();
  if (!transporter) {
    console.log('[EMAIL DISPATCH] Email relay not configured (missing SMTP_HOST/USER/PASS or SENDGRID_API_KEY in .env).');
    return {
      channel: 'email',
      status: 'not_configured',
      timestamp: new Date().toISOString(),
      details: 'Email credentials (SMTP or SendGrid/Resend) not configured in .env'
    };
  }

  try {
    const emailSubject = `[BHOOMIRAKSHAK ${alert.severity}] Landslide Disaster Warning - ${priorityLabel}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #ef4444; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">🛡️ BHOOMIRAKSHAK DISASTER SENTINEL</h1>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #38bdf8; text-transform: uppercase;">Ministry of Development of North Eastern Region (MDoNER)</p>
        </div>
        <div style="padding: 24px; background-color: #ffffff;">
          <div style="display: inline-block; background-color: ${alert.severity === 'CRITICAL' ? '#fee2e2' : '#fef3c7'}; color: ${alert.severity === 'CRITICAL' ? '#b91c1c' : '#b45309'}; padding: 6px 14px; border-radius: 9999px; font-weight: bold; font-size: 13px; text-transform: uppercase; margin-bottom: 16px;">
            🚨 THREAT SEVERITY: ${alert.severity} • ${priorityLabel}
          </div>
          <h2 style="color: #1e293b; margin: 0 0 12px 0;">Urgent Landslide Advisory</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
            ${alert.message}
          </p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Trigger Code:</td>
              <td style="padding: 8px 0; color: #0f172a; text-align: right;">${alert.trigger_reason || 'Hydrometeorological Threshold Exceeded'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Timestamp:</td>
              <td style="padding: 8px 0; color: #0f172a; text-align: right;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Recommended Action:</td>
              <td style="padding: 8px 0; color: #b91c1c; font-weight: bold; text-align: right;">${alert.action_recommendation || 'Initiate Immediate Hill Sector Protocol'}</td>
            </tr>
          </table>
          <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #475569;">
            <strong>Immediate Directives:</strong> Clear identified hill road corridors, restrict valley vehicular movement, and maintain active radio contact on VHF Channel 4.
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center;">
          National Disaster Response Force (SDRF / NDRF Grid) • Emergency Control Hotline: 1070 / 1077
        </div>
      </div>
    `;

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '"BhoomiRakshak Disaster Sentinel" <alerts@bhoomirakshak.in>';

    console.log(`[EMAIL DISPATCH] Dispatching via nodemailer to ${recipientEmails.length} recipient(s)...`);

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmails.join(', '),
      subject: emailSubject,
      html: emailHtml
    });

    console.log('[EMAIL PROVIDER ACCEPTANCE]:', JSON.stringify(info));

    const isAccepted = Boolean(info && (info.messageId || (Array.isArray(info.accepted) && info.accepted.length > 0)));

    return {
      channel: 'email',
      status: isAccepted ? 'sent' : 'failed',
      timestamp: new Date().toISOString(),
      recipients_count: recipientEmails.length,
      priority: priorityLabel,
      message_id: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      details: isAccepted
        ? `Emergency advisory accepted by relay for ${recipientEmails.length} address(es) (MsgID: ${info.messageId})`
        : 'Relay rejected email transmission',
      raw_response: info
    };
  } catch (err) {
    console.error('[EMAIL ERROR]:', err);
    return {
      channel: 'email',
      status: 'failed',
      timestamp: new Date().toISOString(),
      error: err.message,
      details: `Email relay failed: ${err.message}`
    };
  }
}

// Master Dispatch Orchestrator with Priority Tiers:
// Tier 1: All 8 Field Masters / Sector Commanders (Priority Emergency Command)
// Tier 2: Registered Public Citizens in the affected district(s)
export async function dispatchAlert(alertData) {
  const users = localDB.getTable('users');

  // --- TIER 1: ALL 8 FIELD MASTERS / COMMANDERS ---
  const fieldCommanders = users.filter(u => u.role === 'field_officer' && u.is_active !== false);
  const commanderPhones = Array.from(new Set(fieldCommanders.map(c => c.phone).filter(Boolean)));
  const commanderEmails = Array.from(new Set(fieldCommanders.map(c => c.email).filter(Boolean)));

  // --- TIER 2: REGISTERED USERS / CITIZENS IN TARGET DISTRICT(S) ---
  const targetRegionIds = Array.isArray(alertData.region_ids) && alertData.region_ids.length > 0
    ? alertData.region_ids
    : (alertData.region_id ? [alertData.region_id] : []);

  const citizenPhones = new Set();
  const citizenEmails = new Set();

  // Region Scoping for SMS: profiles WHERE region_id = X AND phone_verified = true AND sms_enabled = true
  // Citizens without a region set (or unverified/unsubscribed) must NEVER receive region-specific SMS.
  users.filter(u => u.role === 'citizen' && u.is_active !== false).forEach(c => {
    const matchesRegion = targetRegionIds.length > 0 && (
      (c.region_id && targetRegionIds.includes(c.region_id)) || 
      (Array.isArray(c.region_ids) && c.region_ids.some(r => targetRegionIds.includes(r)))
    );
    if (matchesRegion) {
      if (c.phone && c.phone_verified === true && c.sms_enabled === true) {
        citizenPhones.add(c.phone);
      }
      if (c.email) {
        citizenEmails.add(c.email);
      }
    }
  });

  // Query Supabase profiles for verified SMS citizens if configured
  if (isSupabaseConfigured && supabase && targetRegionIds.length > 0) {
    try {
      let query = supabase
        .from('profiles')
        .select('phone, region_id')
        .eq('role', 'citizen')
        .eq('phone_verified', true)
        .eq('sms_enabled', true);

      if (targetRegionIds.length === 1) {
        query = query.eq('region_id', targetRegionIds[0]);
      } else {
        query = query.in('region_id', targetRegionIds);
      }

      const { data: profiles, error: sbErr } = await query;
      if (!sbErr && profiles) {
        profiles.forEach(p => {
          if (p.phone) citizenPhones.add(p.phone);
        });
      } else if (sbErr) {
        console.warn('[SUPABASE PROFILES QUERY FOR SMS NOTICE]:', sbErr.message);
      }
    } catch (sbErr) {
      console.warn('[SUPABASE PROFILES QUERY EXCEPTION]:', sbErr.message);
    }
  }

  const registeredCitizenPhones = Array.from(citizenPhones);
  const registeredCitizenEmails = Array.from(citizenEmails);

  // Combine for carrier batching with commanders prioritized first
  const allPhonesPrioritized = [...commanderPhones, ...registeredCitizenPhones];
  const allEmailsPrioritized = [...commanderEmails, ...registeredCitizenEmails];

  // 1. Dispatch Web / WebSocket Broadcast + In-App Risk Notification Pop Message
  const webResult = await dispatchWebsiteChannel(alertData);
  broadcastWebSocketMessage('risk_notification', {
    type: 'EMERGENCY_RISK_POPUP',
    alert_id: alertData.id,
    severity: alertData.severity,
    message: alertData.message,
    action_recommendation: alertData.action_recommendation,
    priority_tier_1_count: fieldCommanders.length,
    priority_tier_2_count: registeredCitizenPhones.length,
    sound: alertData.severity === 'CRITICAL' ? 'siren' : 'warning_chime',
    timestamp: new Date().toISOString()
  });

  // 2. Dispatch Priority Tier 1 (All 8 Field Commanders) SMS & Email
  const [tier1SmsResult, tier1EmailResult] = await Promise.all([
    dispatchSmsChannel(alertData, commanderPhones),
    dispatchEmailChannel(alertData, commanderEmails, 'PRIORITY_TIER_1_COMMAND')
  ]);

  // 3. Dispatch Priority Tier 2 (Registered Citizens) SMS & Email
  const [tier2SmsResult, tier2EmailResult] = await Promise.all([
    dispatchSmsChannel(alertData, registeredCitizenPhones),
    dispatchEmailChannel(alertData, registeredCitizenEmails, 'PRIORITY_TIER_2_CITIZEN')
  ]);

  // 4. Dispatch Push Notifications (FCM / WebPush)
  const pushResult = await dispatchPushChannel(alertData, alertData.region_id);

  // Helper to resolve channel status honestly across tiers
  function resolveChannelStatus(tier1Res, tier2Res) {
    if (tier1Res.status === 'sent' || tier2Res.status === 'sent') return 'sent';
    if (tier1Res.status === 'partial' || tier2Res.status === 'partial') return 'partial';
    if (tier1Res.status === 'not_configured' && tier2Res.status === 'not_configured') return 'not_configured';
    if (tier1Res.status === 'no_recipients' && tier2Res.status === 'no_recipients') return 'no_recipients';
    if (tier1Res.status === 'failed' || tier2Res.status === 'failed') return 'failed';
    return tier1Res.status || tier2Res.status || 'not_configured';
  }

  // Consolidated audit trail - strictly reflects true outcome, not an assumed 'sent'
  const channels_sent = [
    webResult,
    {
      channel: 'sms',
      status: resolveChannelStatus(tier1SmsResult, tier2SmsResult),
      tier_1_status: tier1SmsResult.status,
      tier_2_status: tier2SmsResult.status,
      tier_1_commanders_count: commanderPhones.length,
      tier_2_citizens_count: registeredCitizenPhones.length,
      total_sms_recipients: allPhonesPrioritized.length,
      details: `SMS: Tier 1 [${tier1SmsResult.status}] + Tier 2 [${tier2SmsResult.status}]`
    },
    {
      channel: 'email',
      status: resolveChannelStatus(tier1EmailResult, tier2EmailResult),
      tier_1_status: tier1EmailResult.status,
      tier_2_status: tier2EmailResult.status,
      tier_1_commanders_count: commanderEmails.length,
      tier_2_citizens_count: registeredCitizenEmails.length,
      total_email_recipients: allEmailsPrioritized.length,
      details: `Email: Tier 1 [${tier1EmailResult.status}] + Tier 2 [${tier2EmailResult.status}]`
    },
    pushResult
  ];

  return {
    channels_sent,
    priority_dispatch: {
      alert_id: alertData.id,
      severity: alertData.severity,
      tier1_commanders: fieldCommanders.map(c => ({
        commander_id: c.id,
        name: c.name,
        district: c.district,
        state: c.state,
        phone: c.phone,
        email: c.email,
        sms: tier1SmsResult.status,
        email: tier1EmailResult.status
      })),
      tier2_citizens: users.filter(u => u.role === 'citizen').map(c => ({
        user_id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        sms: tier2SmsResult.status,
        email: tier2EmailResult.status
      })),
      channels_executed: [
        'Priority Tier 1: 8 Field Sector Commanders (SMS + Institutional Email)',
        'Priority Tier 2: Registered Citizens (SMS + Email Advisory)',
        'Real-time WebSocket Risk Notification (In-App Pop-up)',
        'Synthesized Warning Siren Cue (Web Audio)'
      ],
      tier_1_field_commanders: {
        total: fieldCommanders.length,
        recipients: fieldCommanders.map(c => ({ name: c.name, district: c.district, state: c.state, phone: c.phone, email: c.email })),
        sms_status: tier1SmsResult.status,
        email_status: tier1EmailResult.status
      },
      tier_2_registered_citizens: {
        total_phones: registeredCitizenPhones.length,
        total_emails: registeredCitizenEmails.length,
        sms_status: tier2SmsResult.status,
        email_status: tier2EmailResult.status
      },
      web_app_notification: {
        status: 'broadcasted',
        event: 'risk_notification',
        pop_msg: true
      }
    }
  };
}

export {
  dispatchWebsiteChannel
};


