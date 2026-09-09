-- BhoomiRakshak: SIH26001 Landslide Intelligence & Risk Monitoring Platform
-- Migration 002: Row Level Security (RLS) Policies

-- Enable Row Level Security on all core tables
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_rainfall_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE terrain_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_landslides ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_connection_status ENABLE ROW LEVEL SECURITY;

-- Helper functions in public schema to extract role and region from JWT claims
CREATE OR REPLACE FUNCTION public.user_role() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    (current_setting('request.jwt.claim.role', true))::text,
    'anon'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.user_region_id() RETURNS UUID AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb->>'region_id',
      current_setting('request.jwt.claim.region_id', true)
    ), 
    ''
  )::uuid;
$$ LANGUAGE sql STABLE;

-- -------------------------------------------------------------
-- 1. REGIONS POLICIES
-- -------------------------------------------------------------
-- Anyone can view regions (for maps, registration, reporting)
DROP POLICY IF EXISTS "Public and users can view regions" ON regions;
CREATE POLICY "Public and users can view regions"
ON regions FOR SELECT
USING (true);

-- Only Admin can create, modify, or delete regions
DROP POLICY IF EXISTS "Admins can manage regions" ON regions;
CREATE POLICY "Admins can manage regions"
ON regions FOR ALL
USING (public.user_role() = 'admin')
WITH CHECK (public.user_role() = 'admin');

-- -------------------------------------------------------------
-- 2. USERS POLICIES
-- -------------------------------------------------------------
-- Admins can view and manage all users
DROP POLICY IF EXISTS "Admins can view and manage all users" ON users;
CREATE POLICY "Admins can view and manage all users"
ON users FOR ALL
USING (public.user_role() = 'admin')
WITH CHECK (public.user_role() = 'admin');

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (id = auth.uid());

-- Citizens can update their own language preference or phone
DROP POLICY IF EXISTS "Users can update own details" ON users;
CREATE POLICY "Users can update own details"
ON users FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- -------------------------------------------------------------
-- 3. RISK ZONES POLICIES
-- -------------------------------------------------------------
-- All authenticated users and citizens can view risk zones for early warnings
DROP POLICY IF EXISTS "Anyone can view risk zones" ON risk_zones;
CREATE POLICY "Anyone can view risk zones"
ON risk_zones FOR SELECT
USING (true);

-- Only Admins and the ML service role can insert or update risk zones
DROP POLICY IF EXISTS "Admins and ML service can insert/update risk zones" ON risk_zones;
CREATE POLICY "Admins and ML service can insert/update risk zones"
ON risk_zones FOR ALL
USING (public.user_role() IN ('admin', 'service_role'))
WITH CHECK (public.user_role() IN ('admin', 'service_role'));

-- -------------------------------------------------------------
-- 4. SENSOR RAINFALL DATA POLICIES
-- -------------------------------------------------------------
-- Viewable by everyone for transparency
DROP POLICY IF EXISTS "Anyone can view rainfall data" ON sensor_rainfall_data;
CREATE POLICY "Anyone can view rainfall data"
ON sensor_rainfall_data FOR SELECT
USING (true);

-- Weather sync job / Admin can insert
DROP POLICY IF EXISTS "Admins and sync service can insert rainfall data" ON sensor_rainfall_data;
CREATE POLICY "Admins and sync service can insert rainfall data"
ON sensor_rainfall_data FOR ALL
USING (public.user_role() IN ('admin', 'service_role'))
WITH CHECK (public.user_role() IN ('admin', 'service_role'));

-- -------------------------------------------------------------
-- 5. TERRAIN FEATURES & HISTORICAL LANDSLIDES
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view terrain and historical data" ON terrain_features;
CREATE POLICY "Anyone can view terrain and historical data"
ON terrain_features FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage terrain features" ON terrain_features;
CREATE POLICY "Admins can manage terrain features"
ON terrain_features FOR ALL
USING (public.user_role() = 'admin')
WITH CHECK (public.user_role() = 'admin');

DROP POLICY IF EXISTS "Anyone can view historical landslides" ON historical_landslides;
CREATE POLICY "Anyone can view historical landslides"
ON historical_landslides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage historical landslides" ON historical_landslides;
CREATE POLICY "Admins can manage historical landslides"
ON historical_landslides FOR ALL
USING (public.user_role() = 'admin')
WITH CHECK (public.user_role() = 'admin');

-- -------------------------------------------------------------
-- 6. FIELD REPORTS POLICIES
-- -------------------------------------------------------------
-- Admins see all reports
DROP POLICY IF EXISTS "Admins can view all field reports" ON field_reports;
CREATE POLICY "Admins can view all field reports"
ON field_reports FOR SELECT
USING (public.user_role() = 'admin');

-- Field officers see reports within their assigned region
DROP POLICY IF EXISTS "Field officers see reports in their region" ON field_reports;
CREATE POLICY "Field officers see reports in their region"
ON field_reports FOR SELECT
USING (
    public.user_role() = 'field_officer' 
    AND region_id = public.user_region_id()
);

-- Citizens can see their own reports AND verified public reports
DROP POLICY IF EXISTS "Citizens see own reports and verified reports" ON field_reports;
CREATE POLICY "Citizens see own reports and verified reports"
ON field_reports FOR SELECT
USING (
    submitted_by = auth.uid() 
    OR status = 'verified'
);

-- Anyone authenticated (officer or citizen) can submit reports
DROP POLICY IF EXISTS "Authenticated users can submit field reports" ON field_reports;
CREATE POLICY "Authenticated users can submit field reports"
ON field_reports FOR INSERT
WITH CHECK (
    public.user_role() IN ('admin', 'field_officer', 'citizen')
);

-- Field officers can verify or triage reports in their region
DROP POLICY IF EXISTS "Field officers can update status in their region" ON field_reports;
CREATE POLICY "Field officers can update status in their region"
ON field_reports FOR UPDATE
USING (
    (public.user_role() = 'field_officer' AND region_id = public.user_region_id())
    OR public.user_role() = 'admin'
)
WITH CHECK (
    (public.user_role() = 'field_officer' AND region_id = public.user_region_id())
    OR public.user_role() = 'admin'
);

-- -------------------------------------------------------------
-- 7. ALERTS POLICIES
-- -------------------------------------------------------------
-- Active alerts are viewable by all in the designated region
DROP POLICY IF EXISTS "Users can view alerts" ON alerts;
CREATE POLICY "Users can view alerts"
ON alerts FOR SELECT
USING (
    public.user_role() = 'admin'
    OR region_id = public.user_region_id()
    OR public.user_role() = 'citizen'
);

-- Only Admin and Automated Risk Pipeline can create alerts
DROP POLICY IF EXISTS "Admins can create and dispatch alerts" ON alerts;
CREATE POLICY "Admins can create and dispatch alerts"
ON alerts FOR INSERT
WITH CHECK (public.user_role() IN ('admin', 'service_role'));

-- -------------------------------------------------------------
-- 8. ALERT SUBSCRIPTIONS POLICIES
-- -------------------------------------------------------------
-- Users can manage only their own subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON alert_subscriptions;
CREATE POLICY "Users can view own subscriptions"
ON alert_subscriptions FOR SELECT
USING (user_id = auth.uid() OR public.user_role() = 'admin');

DROP POLICY IF EXISTS "Users can insert own subscriptions" ON alert_subscriptions;
CREATE POLICY "Users can insert own subscriptions"
ON alert_subscriptions FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own subscriptions" ON alert_subscriptions;
CREATE POLICY "Users can update own subscriptions"
ON alert_subscriptions FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- -------------------------------------------------------------
-- 9. API CONNECTION STATUS POLICIES
-- -------------------------------------------------------------
-- Admins can view and update connection status
DROP POLICY IF EXISTS "Admins can view and manage connection status" ON api_connection_status;
CREATE POLICY "Admins can view and manage connection status"
ON api_connection_status FOR ALL
USING (public.user_role() = 'admin' OR public.user_role() = 'service_role')
WITH CHECK (public.user_role() = 'admin' OR public.user_role() = 'service_role');
