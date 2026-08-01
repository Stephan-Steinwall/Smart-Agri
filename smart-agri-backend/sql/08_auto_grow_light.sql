ALTER TABLE public.system_switches 
ADD COLUMN IF NOT EXISTS auto_grow_light_enabled boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
