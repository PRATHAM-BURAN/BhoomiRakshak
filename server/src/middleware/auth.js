import jwt from 'jsonwebtoken';
import { localDB, isSupabaseConfigured, supabase } from '../db/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bhoomirakshak-disaster-defense-secret-key-2026';

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
      region_id: user.region_id || null,
      language_pref: user.language_pref || 'en'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Verify user is still active in DB
    const users = localDB.getTable('users');
    const user = users.find(u => u.id === decoded.id);
    if (user && user.is_active === false) {
      return res.status(403).json({ error: 'Account is deactivated. Contact Administrator.' });
    }

    req.user = decoded;
    return next();
  } catch (err) {
    // If local JWT fails, verify against Supabase Auth
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { user }, error: sbErr } = await supabase.auth.getUser(token);
        if (!sbErr && user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          req.user = {
            id: user.id,
            role: profile?.role || user.user_metadata?.role || 'citizen',
            name: profile?.full_name || user.user_metadata?.full_name || user.email,
            email: user.email,
            phone: profile?.phone || user.phone,
            region_id: profile?.region_id || user.user_metadata?.region_id || null
          };
          return next();
        }
      } catch (sbEx) {
        // fall through to 401
      }
    }
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .maybeSingle();

            req.user = {
              id: user.id,
              role: profile?.role || user.user_metadata?.role || 'citizen',
              name: profile?.full_name || user.user_metadata?.full_name || user.email,
              email: user.email,
              phone: profile?.phone || user.phone,
              region_id: profile?.region_id || null
            };
            return next();
          }
        } catch {}
      }
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden. Administrator clearance required.' });
  }
  next();
}

export function requireOfficerOrAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'field_officer')) {
    return res.status(403).json({ error: 'Access forbidden. Field Officer or Administrator credentials required.' });
  }
  next();
}

export function requireRegionAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.role === 'admin') {
    return next(); // Admin has omniscient access
  }
  if (req.user.role === 'field_officer') {
    const requestedRegionId = req.params.region_id || req.body.region_id || req.query.region_id;
    if (requestedRegionId && req.user.region_id !== requestedRegionId) {
      return res.status(403).json({
        error: 'Geographical Restriction: You are not authorized to view or modify sectors outside your assigned district.'
      });
    }
  }
  next();
}
