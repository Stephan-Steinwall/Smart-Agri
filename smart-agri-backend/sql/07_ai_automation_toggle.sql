ALTER TABLE public.system_switches 
ADD COLUMN IF NOT EXISTS ai_automation_enabled boolean NOT NULL DEFAULT true;

-- Note: To apply this, run this exact script in the Supabase SQL Editor.
-- Also run: NOTIFY pgrst, 'reload schema';
