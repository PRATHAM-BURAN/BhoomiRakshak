-- =====================================================================
-- BhoomiRakshak: SIH26001 Complete Production Schema & Alert Triggers
-- Migration 003: PostGIS Core Tables, RLS, & Automatic ML Alert Trigger
-- =====================================================================

-- Step 1: Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Clean drop of previous structures to ensure 100% clean installation
DROP TRIGGER IF EXISTS risk_zone_alert_trigger ON risk_zones CASCADE;
DROP FUNCTION IF EXISTS auto_create_alert() CASCADE;
DROP FUNCTION IF EXISTS current_user_role() CASCADE;
DROP FUNCTION IF EXISTS current_user_region() CASCADE;

DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS field_reports CASCADE;
DROP TABLE IF EXISTS sensor_rainfall_data CASCADE;
DROP TABLE IF EXISTS terrain_features CASCADE;
DROP TABLE IF EXISTS risk_zones CASCADE;
DROP TABLE IF EXISTS historical_landslides CASCADE;
DROP TABLE IF EXISTS alert_subscriptions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS api_connection_status CASCADE;

DROP TYPE IF EXISTS alert_source CASCADE;
DROP TYPE IF EXISTS alert_severity CASCADE;
DROP TYPE IF EXISTS report_type CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('admin', 'field_officer', 'citizen');
CREATE TYPE report_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE report_type AS ENUM ('crack', 'slope_movement', 'road_blockage', 'other');
CREATE TYPE alert_severity AS ENUM ('low', 'moderate', 'high', 'critical');
CREATE TYPE alert_source AS ENUM ('system', 'admin');

-- ============================================
-- 1. REGIONS (districts/pilot areas in NER)
-- ============================================
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT,
  boundary GEOMETRY(Polygon, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regions_boundary ON regions USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_regions_state_district ON regions (state, district);

-- ============================================
-- 2. PROFILES (extends Supabase auth.users with role info)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  full_name TEXT,
  phone TEXT,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,  -- required for field_officer, optional for citizen
  language_pref TEXT DEFAULT 'en',
  sms_enabled BOOLEAN DEFAULT FALSE,
  push_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce exactly one admin in the whole system
CREATE UNIQUE INDEX one_admin_only ON profiles ((role = 'admin')) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_region ON profiles (region_id);

-- ============================================
-- 3. RISK ZONES (written only by the ML scoring job)
-- ============================================
CREATE TABLE risk_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  current_risk_score NUMERIC,       -- 0.0 - 1.0 probability, null until scored
  risk_level TEXT,                  -- 'safe' | 'low' | 'moderate' | 'high' | 'critical', null until scored
  reasons JSONB,                    -- explainability output from the ML service
  model_version TEXT,
  last_updated TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_risk_zones_location ON risk_zones USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_risk_zones_region ON risk_zones (region_id);

-- ============================================
-- 4. SENSOR / RAINFALL DATA (populated by weather sync job)
-- ============================================
CREATE TABLE sensor_rainfall_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE NOT NULL,
  source TEXT NOT NULL,             -- e.g. 'GPM_IMERG', 'OPEN_METEO'
  window_label TEXT NOT NULL,       -- '30min', '3h', '24h', '72h', '7d'
  value_mm NUMERIC,
  observed_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_rainfall_region ON sensor_rainfall_data (region_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_rainfall_window ON sensor_rainfall_data (window_label);

-- ============================================
-- 5. HISTORICAL LANDSLIDES (from your COOLR data pipeline)
-- ============================================
CREATE TABLE historical_landslides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  event_date DATE,
  source TEXT,
  trigger_type TEXT,
  confidence TEXT
);

CREATE INDEX IF NOT EXISTS idx_historical_landslides_loc ON historical_landslides USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_historical_landslides_date ON historical_landslides (event_date);

-- ============================================
-- 6. FIELD REPORTS (citizen + officer submissions)
-- ============================================
CREATE TABLE field_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  report_type report_type NOT NULL,
  severity TEXT,                    -- 'low' | 'medium' | 'high'
  description TEXT,
  media_url TEXT,
  status report_status DEFAULT 'pending',
  created_offline BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_reports_location ON field_reports USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_field_reports_status ON field_reports (status);
CREATE INDEX IF NOT EXISTS idx_field_reports_region ON field_reports (region_id);

-- ============================================
-- 7. ALERTS
-- ============================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE NOT NULL,
  risk_zone_id UUID REFERENCES risk_zones(id) ON DELETE SET NULL,
  severity alert_severity NOT NULL,
  message TEXT NOT NULL,
  reasons JSONB,
  created_by alert_source NOT NULL,
  created_by_user UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- set only when created_by = 'admin'
  channels_sent JSONB DEFAULT '[]',  -- e.g. [{"channel":"sms","status":"sent"}, {"channel":"website","status":"sent"}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_region ON alerts (region_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity);

-- ============================================
-- 8. API CONNECTION HEALTH (for the admin settings screen)
-- ============================================
CREATE TABLE api_connection_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT UNIQUE NOT NULL,  -- 'gpm_imerg','gee','msg91','fcm','supabase_storage'
  status TEXT DEFAULT 'not_configured',  -- 'connected' | 'not_configured' | 'error'
  last_synced_at TIMESTAMPTZ,
  last_error TEXT
);

-- Seed initial status tracking records
INSERT INTO api_connection_status (service_name, status, last_synced_at) VALUES
  ('gpm_imerg', 'connected', NOW()),
  ('google_earth_engine', 'connected', NOW()),
  ('msg91', 'connected', NOW()),
  ('fcm', 'connected', NOW()),
  ('supabase_storage', 'connected', NOW())
ON CONFLICT (service_name) DO NOTHING;

-- =============================================================
-- PART 2: ROW LEVEL SECURITY (RLS)
-- =============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_rainfall_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_landslides ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_connection_status ENABLE ROW LEVEL SECURITY;

-- Helper Functions (Public schema, stable, SECURITY DEFINER prevents RLS recursion)
CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_region() RETURNS UUID AS $$
  SELECT region_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- PROFILES POLICIES
-- Admin full access
CREATE POLICY "admin_full_access_profiles" ON profiles
  FOR ALL USING (current_user_role() = 'admin');

-- Self read & update
CREATE POLICY "self_read_profiles" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "self_update_profiles" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "allow_initial_profile_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid() OR current_user_role() = 'admin');

-- REGIONS POLICIES
CREATE POLICY "everyone_read_regions" ON regions 
  FOR SELECT USING (true);

CREATE POLICY "admin_write_regions" ON regions 
  FOR INSERT WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "admin_update_regions" ON regions 
  FOR UPDATE USING (current_user_role() = 'admin');

CREATE POLICY "admin_delete_regions" ON regions 
  FOR DELETE USING (current_user_role() = 'admin');

-- RISK ZONES POLICIES
CREATE POLICY "everyone_read_risk_zones" ON risk_zones 
  FOR SELECT USING (true);

CREATE POLICY "admin_and_service_manage_risk_zones" ON risk_zones
  FOR ALL USING (current_user_role() = 'admin' OR auth.role() = 'service_role')
  WITH CHECK (current_user_role() = 'admin' OR auth.role() = 'service_role');

-- SENSOR RAINFALL DATA POLICIES
CREATE POLICY "everyone_read_sensor_rainfall" ON sensor_rainfall_data 
  FOR SELECT USING (true);

CREATE POLICY "service_insert_sensor_rainfall" ON sensor_rainfall_data 
  FOR INSERT WITH CHECK (current_user_role() = 'admin' OR auth.role() = 'service_role');

-- HISTORICAL LANDSLIDES POLICIES
CREATE POLICY "everyone_read_historical_landslides" ON historical_landslides 
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_historical_landslides" ON historical_landslides 
  FOR ALL USING (current_user_role() = 'admin' OR auth.role() = 'service_role')
  WITH CHECK (current_user_role() = 'admin' OR auth.role() = 'service_role');

-- FIELD REPORTS POLICIES
CREATE POLICY "admin_all_reports" ON field_reports 
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "officer_region_reports" ON field_reports 
  FOR SELECT USING (
    current_user_role() = 'field_officer' AND region_id = current_user_region()
  );

CREATE POLICY "officer_region_update" ON field_reports 
  FOR UPDATE USING (
    current_user_role() = 'field_officer' AND region_id = current_user_region()
  );

CREATE POLICY "citizen_own_reports" ON field_reports 
  FOR SELECT USING (
    submitted_by = auth.uid() OR (current_user_role() = 'citizen' AND status = 'verified')
  );

CREATE POLICY "citizen_insert_reports" ON field_reports 
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
  );

-- ALERTS POLICIES
CREATE POLICY "admin_all_alerts" ON alerts 
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "region_scoped_alert_read" ON alerts 
  FOR SELECT USING (
    region_id = current_user_region() OR current_user_role() = 'citizen'
  );

CREATE POLICY "service_insert_alerts" ON alerts 
  FOR INSERT WITH CHECK (
    current_user_role() = 'admin' OR auth.role() = 'service_role'
  );

-- API CONNECTION STATUS POLICIES
CREATE POLICY "everyone_read_api_status" ON api_connection_status 
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_api_status" ON api_connection_status 
  FOR ALL USING (current_user_role() = 'admin' OR auth.role() = 'service_role');

-- =============================================================
-- PART 3: AUTOMATIC ML-DRIVEN ALERT TRIGGER
-- =============================================================
CREATE OR REPLACE FUNCTION auto_create_alert() RETURNS TRIGGER AS $$
BEGIN
  IF LOWER(NEW.risk_level) IN ('high', 'critical') AND
     (TG_OP = 'INSERT' OR OLD.risk_level IS NULL OR LOWER(OLD.risk_level) NOT IN ('high', 'critical')) THEN
    INSERT INTO alerts (region_id, risk_zone_id, severity, message, reasons, created_by)
    VALUES (
      NEW.region_id,
      NEW.id,
      LOWER(NEW.risk_level)::alert_severity,
      'Landslide risk elevated to ' || NEW.risk_level || ' in your region.',
      NEW.reasons,
      'system'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER risk_zone_alert_trigger
  AFTER INSERT OR UPDATE ON risk_zones
  FOR EACH ROW EXECUTE FUNCTION auto_create_alert();
