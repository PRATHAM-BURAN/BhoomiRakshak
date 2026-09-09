import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';
import { signToken, requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Helper to sanitize user object
function sanitizeUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

// Normalize phone numbers to standard 12-digit Indian format (91XXXXXXXXXX) or international digits
export function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

// In-memory OTP storage: Map<normalizedPhone, { hash, salt, expiresAt, attempts, sendTimestamps }>
const otpStore = new Map();

// Periodic cleanup of expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) {
      otpStore.delete(phone);
    }
  }
}, 5 * 60 * 1000);

// --- OTP ENDPOINTS ---

// POST /api/auth/send-otp: Send 6-digit OTP via MSG91 OTP API (max 3 per 10m)
router.post('/send-otp', optionalAuth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Valid phone number is required.' });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return res.status(400).json({ error: 'Invalid phone number format. Please provide a valid 10-digit mobile number.' });
    }

    const now = Date.now();
    const TEN_MINUTES = 10 * 60 * 1000;
    let entry = otpStore.get(normalizedPhone);

    // Rate limiting: Max 3 requests per 10 minutes
    if (entry) {
      entry.sendTimestamps = (entry.sendTimestamps || []).filter(ts => now - ts < TEN_MINUTES);
      if (entry.sendTimestamps.length >= 3) {
        const oldest = entry.sendTimestamps[0];
        const waitSeconds = Math.ceil((TEN_MINUTES - (now - oldest)) / 1000);
        return res.status(429).json({
          error: `Rate limit reached: Maximum 3 OTP requests allowed per 10 minutes. Please retry in ${waitSeconds} seconds.`
        });
      }
    }

    // Generate cryptographically random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(otp + salt).digest('hex');

    // MSG91 OTP API (https://control.msg91.com/api/v5/otp)
    const msg91AuthKey = process.env.MSG91_API_KEY || process.env.MSG91_AUTH_KEY;
    const otpTemplateId = process.env.MSG91_OTP_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID;

    let providerResponse = null;
    let providerSuccess = false;

    if (msg91AuthKey) {
      try {
        const params = {
          mobile: normalizedPhone,
          otp: otp,
          otp_expiry: 5
        };
        if (otpTemplateId) {
          params.template_id = otpTemplateId;
        }

        const response = await axios.post('https://control.msg91.com/api/v5/otp', null, {
          params,
          headers: {
            authkey: msg91AuthKey
          },
          timeout: 10000
        });

        providerResponse = response.data;
        providerSuccess = response.status >= 200 && response.status < 300;
        console.log(`[MSG91 OTP API] Dispatched 6-digit OTP to +${normalizedPhone}:`, response.data);
      } catch (apiErr) {
        const errData = apiErr.response?.data || apiErr.message;
        console.warn(`[MSG91 OTP WARNING] Provider call failed for +${normalizedPhone}:`, errData);
        providerResponse = errData;
      }
    } else {
      console.log(`[DEV OTP NOTIFICATION] MSG91 credentials not set in environment. Demo OTP for +${normalizedPhone} is: [ ${otp} ]`);
    }

    // Store hash with 5-minute expiry
    const sendTimestamps = entry ? [...entry.sendTimestamps, now] : [now];
    otpStore.set(normalizedPhone, {
      hash,
      salt,
      expiresAt: now + 5 * 60 * 1000,
      attempts: 0,
      sendTimestamps
    });

    return res.json({
      success: true,
      message: `Verification OTP dispatched to +${normalizedPhone}. Valid for 5 minutes.`,
      phone: normalizedPhone,
      expires_in_seconds: 300,
      provider_acknowledged: providerSuccess,
      // For local testing convenience if provider unavailable
      ...(process.env.NODE_ENV !== 'production' && !providerSuccess ? { demo_otp: otp } : {})
    });
  } catch (err) {
    console.error('[SEND-OTP EXCEPTION]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-otp: Check hash, set phone_verified = true and sms_enabled = true
router.post('/verify-otp', optionalAuth, async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone number and 6-digit OTP code are required.' });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const entry = otpStore.get(normalizedPhone);

    if (!entry) {
      return res.status(400).json({ error: 'No active OTP verification session found for this number. Please request an OTP.' });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalizedPhone);
      return res.status(400).json({ error: 'The OTP has expired. Please request a new 6-digit code.' });
    }

    if (entry.attempts >= 5) {
      otpStore.delete(normalizedPhone);
      return res.status(400).json({ error: 'Too many incorrect attempts. For security, please request a new OTP.' });
    }

    // Check SHA-256 hash
    const testHash = crypto.createHash('sha256').update(String(otp).trim() + entry.salt).digest('hex');
    if (testHash !== entry.hash) {
      entry.attempts += 1;
      const remaining = 5 - entry.attempts;
      return res.status(400).json({ error: `Incorrect OTP. ${remaining} attempt(s) remaining.` });
    }

    // Verification successful! Remove from store
    otpStore.delete(normalizedPhone);

    let updatedUser = null;
    const userId = req.user?.id;

    // 1. Update in LocalDB
    const users = localDB.getTable('users');
    let localUser = null;
    if (userId) {
      localUser = users.find(u => u.id === userId);
    }
    if (!localUser) {
      localUser = users.find(u => normalizePhoneNumber(u.phone) === normalizedPhone);
    }

    if (localUser) {
      localUser.phone = normalizedPhone;
      localUser.phone_verified = true;
      localUser.sms_enabled = true;
      localDB.save();
      updatedUser = localUser;
    }

    // 2. Update in Supabase profiles if configured
    if (isSupabaseConfigured && supabase) {
      try {
        if (userId) {
          await supabase
            .from('profiles')
            .update({
              phone: normalizedPhone,
              phone_verified: true,
              sms_enabled: true
            })
            .eq('id', userId);
        } else {
          await supabase
            .from('profiles')
            .update({
              phone_verified: true,
              sms_enabled: true
            })
            .eq('phone', normalizedPhone);
        }
      } catch (sbErr) {
        console.warn('[SUPABASE PROFILE VERIFICATION UPDATE]:', sbErr.message);
      }
    }

    return res.json({
      success: true,
      message: `Mobile number +${normalizedPhone} successfully verified. SMS early warning alerts are now ACTIVE.`,
      phone: normalizedPhone,
      phone_verified: true,
      sms_enabled: true,
      user: updatedUser ? sanitizeUser(updatedUser) : null
    });
  } catch (err) {
    console.error('[VERIFY-OTP EXCEPTION]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/notification-preferences: Toggle SMS/Push alert preferences
router.patch('/notification-preferences', requireAuth, async (req, res) => {
  try {
    const { sms_enabled, push_enabled } = req.body;
    const users = localDB.getTable('users');
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    if (typeof sms_enabled !== 'undefined') {
      const wantSms = Boolean(sms_enabled);
      if (wantSms && !user.phone_verified) {
        return res.status(400).json({
          error: 'Phone verification required: You must verify your phone number via OTP before SMS alerts can be activated.'
        });
      }
      user.sms_enabled = wantSms;
    }

    if (typeof push_enabled !== 'undefined') {
      user.push_enabled = Boolean(push_enabled);
    }

    localDB.save();

    if (isSupabaseConfigured && supabase) {
      try {
        const updateFields = {};
        if (typeof sms_enabled !== 'undefined') updateFields.sms_enabled = Boolean(sms_enabled);
        if (typeof push_enabled !== 'undefined') updateFields.push_enabled = Boolean(push_enabled);

        await supabase
          .from('profiles')
          .update(updateFields)
          .eq('id', req.user.id);
      } catch (sbErr) {
        console.warn('[SUPABASE PREFERENCES UPDATE]:', sbErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'Notification preferences updated successfully.',
      user: sanitizeUser(user)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 1. Setup Initial Administrator (One-time bootstrap; enforced single-admin rule)
router.post('/setup-admin', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const users = localDB.getTable('users');
    const existingAdmin = users.find(u => u.role === 'admin' && u.is_active !== false);
    if (existingAdmin) {
      return res.status(403).json({
        error: 'Security Policy Violation: BhoomiRakshak already has an active Administrator provisioned.'
      });
    }

    let userId = uuidv4();

    // If Supabase is configured, create the auth.users and public.profiles records
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: 'admin', full_name: name }
        });

        if (authUser?.user) {
          userId = authUser.user.id;
          await supabase.from('profiles').upsert({
            id: userId,
            role: 'admin',
            full_name: name,
            phone: phone || null,
            language_pref: 'en',
            phone_verified: Boolean(phone),
            sms_enabled: Boolean(phone),
            push_enabled: true
          });
        } else if (authErr && !authErr.message.includes('already been registered')) {
          console.warn('[SUPABASE AUTH] Admin creation notice:', authErr.message);
        }
      } catch (sbErr) {
        console.warn('[SUPABASE] Admin provisioning warning:', sbErr.message);
      }
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newAdmin = {
      id: userId,
      role: 'admin',
      name,
      email,
      phone: phone || null,
      phone_verified: Boolean(phone),
      sms_enabled: Boolean(phone),
      password_hash,
      region_id: null,
      language_pref: 'en',
      is_active: true,
      created_at: new Date().toISOString()
    };

    localDB.validateUser(newAdmin);
    users.push(newAdmin);
    localDB.save();

    const token = signToken(newAdmin);
    return res.status(201).json({
      message: 'Administrator successfully provisioned.',
      user: sanitizeUser(newAdmin),
      token
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 2. Citizen Self-Registration (Public)
router.post('/register-citizen', async (req, res) => {
  try {
    const { name, phone, email, password, region_id, region_ids, language_pref } = req.body;
    if (!name || (!phone && !email) || !password) {
      return res.status(400).json({ error: 'Name, password, and either phone or email are required.' });
    }

    const selectedRegionIds = Array.isArray(region_ids) && region_ids.length > 0 
      ? region_ids 
      : (region_id ? [region_id] : []);
    const primaryRegionId = selectedRegionIds[0] || region_id || null;

    // Requirement: Citizens without a region set should not receive region-specific alerts.
    // Surface this as a required field during signup/onboarding.
    if (!primaryRegionId) {
      return res.status(400).json({ error: 'District / Region selection is required to configure early warning alerts.' });
    }

    let userId = uuidv4();
    const effectiveEmail = email || `${(phone || '').replace(/[^0-9]/g, '')}@bhoomirakshak.local`;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email: effectiveEmail,
          password,
          email_confirm: true,
          user_metadata: { role: 'citizen', full_name: name, region_id: primaryRegionId, region_ids: selectedRegionIds }
        });

        if (authUser?.user) {
          userId = authUser.user.id;
          await supabase.from('profiles').upsert({
            id: userId,
            role: 'citizen',
            full_name: name,
            phone: phone ? normalizePhoneNumber(phone) : null,
            region_id: primaryRegionId,
            language_pref: language_pref || 'en',
            phone_verified: false,
            sms_enabled: false,
            push_enabled: true
          });
        } else if (authErr && !authErr.message.includes('already been registered')) {
          console.warn('[SUPABASE AUTH] Citizen creation notice:', authErr.message);
        }
      } catch (sbErr) {
        console.warn('[SUPABASE] Citizen provisioning warning:', sbErr.message);
      }
    }

    const users = localDB.getTable('users');
    const password_hash = await bcrypt.hash(password, 10);

    const newCitizen = {
      id: userId,
      role: 'citizen',
      name,
      phone: phone ? normalizePhoneNumber(phone) : null,
      phone_verified: false,
      sms_enabled: false,
      email: email || null,
      password_hash,
      region_id: primaryRegionId,
      region_ids: selectedRegionIds,
      language_pref: language_pref || 'en',
      is_active: true,
      created_at: new Date().toISOString()
    };

    localDB.validateUser(newCitizen);
    users.push(newCitizen);

    // Automatically create alert subscriptions for all chosen districts (unverified by default)
    const alertSubs = localDB.getTable('alert_subscriptions');
    for (const rId of selectedRegionIds) {
      alertSubs.push({
        id: uuidv4(),
        user_id: userId,
        region_id: rId,
        sms_enabled: false,
        push_enabled: true,
        email_enabled: Boolean(email),
        created_at: new Date().toISOString()
      });
    }

    localDB.save();

    const token = signToken(newCitizen);
    return res.status(201).json({
      message: `Citizen account created successfully with ${selectedRegionIds.length} monitored district(s). Please verify your phone number in Settings to activate SMS alerts.`,
      user: sanitizeUser(newCitizen),
      token
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 3. User Login (Admin, Field Officer, Citizen - Dual Supabase / Local)
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // email or phone
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier (email or phone) and password are required.' });
    }

    // Try Supabase Auth first if configured and identifier is an email
    if (isSupabaseConfigured && supabase && identifier.includes('@')) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: identifier,
          password
        });

        if (!authErr && authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          const userPayload = {
            id: authData.user.id,
            role: profile?.role || authData.user.user_metadata?.role || 'citizen',
            name: profile?.full_name || authData.user.user_metadata?.full_name || 'User',
            email: authData.user.email,
            phone: profile?.phone || null,
            region_id: profile?.region_id || null
          };

          const token = signToken(userPayload);
          return res.json({
            message: 'Authentication successful via Supabase.',
            user: userPayload,
            token,
            session: authData.session
          });
        }
      } catch (sbErr) {
        // Fall back to local check
      }
    }

    const users = localDB.getTable('users');
    const user = users.find(u => u.email === identifier || u.phone === identifier);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    if (user.is_active === false) {
      return res.status(403).json({ error: 'This account has been deactivated by the Administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    const token = signToken(user);
    return res.json({
      message: 'Authentication successful.',
      user: sanitizeUser(user),
      token
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Get Current Authenticated Profile
router.get('/me', requireAuth, async (req, res) => {
  const users = localDB.getTable('users');
  let user = users.find(u => u.id === req.user.id);

  // Sync latest profile attributes from Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', req.user.id)
        .maybeSingle();

      if (profile) {
        if (!user) {
          user = {
            id: profile.id,
            role: profile.role,
            name: profile.full_name,
            email: req.user.email,
            phone: profile.phone,
            phone_verified: Boolean(profile.phone_verified),
            sms_enabled: profile.sms_enabled ?? false,
            push_enabled: profile.push_enabled ?? true,
            region_id: profile.region_id,
            language_pref: profile.language_pref || 'en'
          };
        } else {
          if (profile.phone) user.phone = profile.phone;
          if (typeof profile.phone_verified !== 'undefined') user.phone_verified = Boolean(profile.phone_verified);
          if (typeof profile.sms_enabled !== 'undefined') user.sms_enabled = Boolean(profile.sms_enabled);
          if (typeof profile.push_enabled !== 'undefined') user.push_enabled = Boolean(profile.push_enabled);
          if (profile.region_id) user.region_id = profile.region_id;
        }
      }
    } catch (sbErr) {
      // Supabase query error - fallback to local user
    }
  }

  if (!user) {
    return res.json({ user: req.user });
  }
  return res.json({ user: sanitizeUser(user) });
});

// 5. Admin-Only: Create Field Officer Account (Calls Supabase Admin API + Profiles)
const createOfficerHandler = async (req, res) => {
  try {
    const { name, phone, email, password, region_id, language_pref } = req.body;
    if (!name || !email || !password || !region_id) {
      return res.status(400).json({ error: 'Name, email, password, and assigned region_id are mandatory.' });
    }

    // Verify assigned region exists
    const regions = localDB.getTable('regions');
    const region = regions.find(r => r.id === region_id);

    let userId = uuidv4();
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;

    // Create directly in Supabase auth.users and public.profiles via service_role key
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: 'field_officer', full_name: name, region_id }
        });

        if (authUser?.user) {
          userId = authUser.user.id;
          await supabase.from('profiles').upsert({
            id: userId,
            role: 'field_officer',
            full_name: name,
            phone: normalizedPhone,
            region_id,
            language_pref: language_pref || 'en',
            phone_verified: Boolean(normalizedPhone),
            sms_enabled: Boolean(normalizedPhone),
            push_enabled: true
          });
          console.log(`[SUPABASE AUTH] Successfully provisioned Field Officer '${email}' with ID: ${userId}`);
        } else if (authErr) {
          console.warn('[SUPABASE AUTH] Officer provision notice:', authErr.message);
        }
      } catch (sbErr) {
        console.warn('[SUPABASE] Officer provisioning warning:', sbErr.message);
      }
    }

    const users = localDB.getTable('users');
    const password_hash = await bcrypt.hash(password, 10);

    const newOfficer = {
      id: userId,
      role: 'field_officer',
      name,
      phone: normalizedPhone,
      phone_verified: Boolean(normalizedPhone),
      sms_enabled: Boolean(normalizedPhone),
      email,
      password_hash,
      region_id,
      language_pref: language_pref || 'en',
      is_active: true,
      created_at: new Date().toISOString()
    };

    localDB.validateUser(newOfficer);
    users.push(newOfficer);
    localDB.save();

    return res.status(201).json({
      message: 'Field Officer successfully deployed to district.',
      officer: sanitizeUser(newOfficer)
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

router.post('/officers', requireAuth, requireAdmin, createOfficerHandler);
router.post('/create-officer', requireAuth, requireAdmin, createOfficerHandler);

// 6. Admin-Only: List All Field Officers
router.get('/officers', requireAuth, requireAdmin, (req, res) => {
  const users = localDB.getTable('users');
  const regions = localDB.getTable('regions');
  const officers = users
    .filter(u => u.role === 'field_officer')
    .map(u => {
      const region = regions.find(r => r.id === u.region_id);
      return {
        ...sanitizeUser(u),
        region_name: region ? `${region.district}, ${region.state}` : 'Unassigned'
      };
    });
  return res.json({ officers });
});

// 7. Admin-Only: Toggle Officer Active Status
router.patch('/officers/:id/status', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  const users = localDB.getTable('users');
  const officer = users.find(u => u.id === id && u.role === 'field_officer');
  if (!officer) {
    return res.status(404).json({ error: 'Field officer not found.' });
  }

  officer.is_active = Boolean(is_active);
  localDB.save();

  return res.json({
    message: `Field officer account ${officer.is_active ? 'activated' : 'deactivated'}.`,
    officer: sanitizeUser(officer)
  });
});

export default router;
