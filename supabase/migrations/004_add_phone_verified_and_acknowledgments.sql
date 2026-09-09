-- =====================================================================
-- BhoomiRakshak Migration 004: Phone Verification & Alert Acknowledgments
-- =====================================================================

-- 1. Add phone_verified to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- 2. Create alert_acknowledgments table for tracking who acknowledged alerts
CREATE TABLE IF NOT EXISTS alert_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (alert_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_acks_user ON alert_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_acks_alert ON alert_acknowledgments(alert_id);

-- 3. Enable RLS on alert_acknowledgments
ALTER TABLE alert_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own acknowledgments" ON alert_acknowledgments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can acknowledge alerts" ON alert_acknowledgments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all acknowledgments" ON alert_acknowledgments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
