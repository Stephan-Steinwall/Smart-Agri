-- Adds custom low/high threshold columns for the 4 pumps to the system_switches table
ALTER TABLE public.system_switches 
ADD COLUMN IF NOT EXISTS moisture_threshold_low INTEGER NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS moisture_threshold_high INTEGER NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS nitrogen_threshold_low INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS nitrogen_threshold_high INTEGER NOT NULL DEFAULT 70,
ADD COLUMN IF NOT EXISTS phosphorus_threshold_low INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS phosphorus_threshold_high INTEGER NOT NULL DEFAULT 70,
ADD COLUMN IF NOT EXISTS potassium_threshold_low INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS potassium_threshold_high INTEGER NOT NULL DEFAULT 70;
