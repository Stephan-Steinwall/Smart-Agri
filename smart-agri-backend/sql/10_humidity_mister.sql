-- 10_humidity_mister.sql
-- Adds columns for Humidity Mister control and automation.

ALTER TABLE public.system_switches 
ADD COLUMN IF NOT EXISTS pump_mister BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_mister_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS humidity_threshold_percent INTEGER NOT NULL DEFAULT 50;
