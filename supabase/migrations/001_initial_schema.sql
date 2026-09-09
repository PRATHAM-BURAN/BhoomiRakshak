-- BhoomiRakshak: SIH26001 Landslide Intelligence & Risk Monitoring Platform
-- Migration 001: Initial Schema with PostGIS Support

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Regions Table (Admin-Managed Geofenced Monitored Sectors)
CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regions_geometry ON regions USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_regions_state_district ON regions (state, district);

-- 3. Users Table (Admin, Field Officers, Citizens)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'field_officer', 'citizen')),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
    language_pref VARCHAR(20) DEFAULT 'en',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_region ON users (region_id);

-- Enforce Exactly One Active Administrator in the Entire System
CREATE OR REPLACE FUNCTION check_single_active_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'admin' AND NEW.is_active = TRUE THEN
        IF EXISTS (
            SELECT 1 FROM users 
            WHERE role = 'admin' 
              AND is_active = TRUE 
              AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) THEN
            RAISE EXCEPTION 'Constraint violation: Exactly one active Administrator account is permitted in BhoomiRakshak.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_active_admin ON users;
CREATE TRIGGER trg_single_active_admin
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION check_single_active_admin();

-- 4. Risk Zones Table (Populated Only by ML Scoring Pipeline)
CREATE TABLE IF NOT EXISTS risk_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    geometry GEOMETRY(Geometry, 4326) NOT NULL,
    current_risk_score NUMERIC(5, 4) NOT NULL CHECK (current_risk_score >= 0 AND current_risk_score <= 1),
    risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('SAFE', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
    reasons JSONB DEFAULT '[]'::jsonb,
    model_version VARCHAR(50) NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_zones_geometry ON risk_zones USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_risk_zones_region ON risk_zones (region_id);
CREATE INDEX IF NOT EXISTS idx_risk_zones_risk_level ON risk_zones (risk_level);

-- 5. Sensor Rainfall Data (Live Precipitation Telemetry)
CREATE TABLE IF NOT EXISTS sensor_rainfall_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    value_mm NUMERIC(8, 2) NOT NULL CHECK (value_mm >= 0),
    "window" VARCHAR(20) NOT NULL CHECK ("window" IN ('30min', '3h', '24h', '7d')),
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_rainfall_region_time ON sensor_rainfall_data (region_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_rainfall_window ON sensor_rainfall_data ("window");

-- 6. Terrain Features (DEM Slope, Elevation, Aspect)
CREATE TABLE IF NOT EXISTS terrain_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    elevation NUMERIC(8, 2) NOT NULL,
    slope NUMERIC(6, 2) NOT NULL,
    aspect NUMERIC(6, 2),
    curvature NUMERIC(6, 2),
    source VARCHAR(100) NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terrain_region ON terrain_features (region_id);

-- 7. Historical Landslides (Ground Truth Labels)
CREATE TABLE IF NOT EXISTS historical_landslides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
    geometry GEOMETRY(Point, 4326) NOT NULL,
    event_date DATE NOT NULL,
    source VARCHAR(100) NOT NULL,
    "trigger" VARCHAR(100),
    confidence VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_historical_landslides_geometry ON historical_landslides USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_historical_landslides_date ON historical_landslides (event_date);

-- 8. Field Reports (Crowdsourced and Officer Ground Truth Verification)
CREATE TABLE IF NOT EXISTS field_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    geometry GEOMETRY(Point, 4326) NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('crack', 'slope_movement', 'road_blockage')),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
    description TEXT,
    media_url TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_offline BOOLEAN DEFAULT FALSE,
    idempotency_key UUID UNIQUE NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_reports_geometry ON field_reports USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_field_reports_region_status ON field_reports (region_id, status);

-- 9. Alerts Table (Autonomous & Manual Disaster Broadcasts)
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    risk_zone_id UUID REFERENCES risk_zones(id) ON DELETE SET NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
    message TEXT NOT NULL,
    reasons JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    channels_sent JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_alerts_region_created ON alerts (region_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity);

-- 10. Alert Subscriptions (Citizen Notification Preferences)
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user ON alert_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_region ON alert_subscriptions (region_id);

-- 11. API Connection Status (Authentic Integration Health - No Fake Badges)
CREATE TABLE IF NOT EXISTS api_connection_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('connected', 'disconnected', 'not_configured')),
    last_synced_at TIMESTAMPTZ,
    details JSONB DEFAULT '{}'::jsonb
);
