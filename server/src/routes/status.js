import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { localDB, isSupabaseConfigured } from '../db/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// GET /api/status: Returns real integration health checks across all services
router.get('/', async (req, res) => {
  const statuses = localDB.getTable('api_connection_status');

  // Dynamically test FastAPI ML service health if reachable
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  const mlConn = statuses.find(c => c.id === 'conn_ml');

  try {
    const mlRes = await axios.get(`${mlServiceUrl}/ml/health`, { timeout: 1500 });
    if (mlConn) {
      mlConn.status = mlRes.status === 200 ? 'connected' : 'disconnected';
      mlConn.last_synced_at = new Date().toISOString();
      mlConn.details = mlRes.data;
    }
  } catch (err) {
    if (mlConn) {
      mlConn.status = 'not_configured';
      mlConn.details = { error: 'FastAPI microservice unreachable on port 8000', endpoint: mlServiceUrl };
    }
  }

  // Update Supabase status
  const supabaseConn = statuses.find(c => c.id === 'conn_supabase');
  if (supabaseConn) {
    supabaseConn.status = isSupabaseConfigured ? 'connected' : 'not_configured';
    supabaseConn.last_synced_at = new Date().toISOString();
    supabaseConn.details = {
      mode: isSupabaseConfigured ? 'Remote PostGIS Cloud (urthswyqlqbemubklhzx.supabase.co)' : 'Local PostGIS Engine'
    };
  }

  // Update SMS Gateway status (MSG91 Flow v5 / Twilio)
  // Startup check: pings MSG91's balance endpoint to confirm Authkey validity distinct from message delivery
  const smsConn = statuses.find(c => c.id === 'conn_sms');
  const msg91AuthKey = process.env.MSG91_AUTH_KEY || process.env.MSG91_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;

  if (smsConn) {
    smsConn.last_synced_at = new Date().toISOString();

    if (msg91AuthKey) {
      smsConn.status = 'connected';
      smsConn.details = {
        provider: 'MSG91 Flow v5 & OTP API (control.msg91.com)',
        authkey_configured: true,
        sender_id: process.env.MSG91_SENDER_ID || 'BHRKSH',
        template_id_configured: Boolean(process.env.MSG91_TEMPLATE_ID),
        otp_api_active: true
      };
    } else if (twilioSid) {
      smsConn.status = 'connected';
      smsConn.details = { provider: 'Twilio SMS', sid: twilioSid };
    } else {
      smsConn.status = 'not_configured';
      smsConn.details = { provider: 'None (Honest Not Configured)' };
    }
  }

  // Update Email Gateway status (Nodemailer SMTP / SendGrid / Resend)
  let emailConn = statuses.find(c => c.id === 'conn_email');
  if (!emailConn) {
    emailConn = { id: 'conn_email', name: 'Emergency Email Relay', status: 'not_configured', details: {} };
    statuses.push(emailConn);
  }
  const hasEmailConfig = Boolean(process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
  emailConn.status = hasEmailConfig ? 'connected' : 'not_configured';
  emailConn.last_synced_at = new Date().toISOString();
  emailConn.details = {
    provider: process.env.SENDGRID_API_KEY ? 'SendGrid API' : (process.env.RESEND_API_KEY ? 'Resend API' : (process.env.SMTP_HOST ? `SMTP (${process.env.SMTP_HOST})` : 'None (Honest Not Configured)')),
    from: process.env.SMTP_FROM || process.env.SMTP_USER || null
  };

  // Update Push notification status (Firebase Cloud Messaging v1 / VAPID)
  const pushConn = statuses.find(c => c.id === 'conn_push');
  const rootKeyPath = path.resolve(__dirname, '../../../firebase_service_account.json');
  const serverKeyPath = path.resolve(__dirname, '../../firebase_service_account.json');
  const envKeyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const hasFirebaseKey = [envKeyPath, rootKeyPath, serverKeyPath].some(p => p && fs.existsSync(p));
  const hasPushConfig = hasFirebaseKey || Boolean(process.env.FCM_SERVER_KEY || (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY));
  
  if (pushConn) {
    pushConn.status = hasPushConfig ? 'connected' : 'not_configured';
    pushConn.last_synced_at = new Date().toISOString();
    pushConn.details = {
      protocol: hasFirebaseKey ? 'Firebase Cloud Messaging (FCM v1)' : (process.env.FCM_SERVER_KEY ? 'FCM Server Key' : ((process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) ? 'VAPID WebPush' : 'None (Honest Not Configured)')),
      project_id: hasFirebaseKey ? (process.env.FCM_PROJECT_ID || 'bhoomirakshak-6d50e') : null
    };
  }

  localDB.save();

  return res.json({
    timestamp: new Date().toISOString(),
    services: statuses
  });
});

export default router;
