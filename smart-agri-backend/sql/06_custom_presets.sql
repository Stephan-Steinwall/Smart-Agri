create table if not exists public.custom_threshold_presets (
    id uuid default gen_random_uuid() primary key,
    preset_name text not null unique,
    moisture_threshold_low integer not null,
    moisture_threshold_high integer not null,
    nitrogen_threshold_low integer not null,
    nitrogen_threshold_high integer not null,
    phosphorus_threshold_low integer not null,
    phosphorus_threshold_high integer not null,
    potassium_threshold_low integer not null,
    potassium_threshold_high integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: To apply this, run this exact script in the Supabase SQL Editor.
-- Also run: NOTIFY pgrst, 'reload schema';
