-- 11_gps_and_buzzer_columns.sql
-- Adds columns that application code (telemetry.service.ts) has been
-- reading/writing without a corresponding migration ever having been
-- added for them, unlike every other feature in this schema. Without
-- these, saveAnalysis() inserts into "Wireless sensor Soil Analysis data"
-- fail outright (unknown column), and buzzer_active/rain_buzzer_enabled
-- toggles on system_switches silently no-op. IF NOT EXISTS makes this
-- safe to run even if the columns already exist.

ALTER TABLE public.system_switches
ADD COLUMN IF NOT EXISTS buzzer_active BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rain_buzzer_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public."Wireless sensor Soil Analysis data"
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS gps_altitude_m DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS gps_satellites INTEGER,
ADD COLUMN IF NOT EXISTS gps_hdop DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS gps_valid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS gps_quality_acceptable BOOLEAN DEFAULT FALSE;
