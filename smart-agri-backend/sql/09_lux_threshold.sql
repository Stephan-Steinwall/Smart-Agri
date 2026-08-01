ALTER TABLE public.system_switches 
ADD COLUMN IF NOT EXISTS light_intensity_threshold_lux double precision NOT NULL DEFAULT 5000;

NOTIFY pgrst, 'reload schema';
