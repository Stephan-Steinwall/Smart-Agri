-- 01_create_crop_reference_tables.sql
-- Portable Wireless Soil Sensor Crop Recommendation Module
-- Reference dataset and profile tables (separate from real farmer measurements)

CREATE TABLE IF NOT EXISTS public.crop_reference_profiles (
    crop_name text PRIMARY KEY,
    scientific_name text NOT NULL,
    ph_opt_min double precision NOT NULL,
    ph_opt_max double precision NOT NULL,
    temperature_opt_min_c double precision NOT NULL,
    temperature_opt_max_c double precision NOT NULL,
    ec_full_yield_max_dsm double precision NULL,
    ec_guidance_max_dsm double precision NOT NULL,
    moisture_paw_min double precision NOT NULL,
    moisture_paw_max double precision NOT NULL,
    drainage_requirement text NOT NULL,
    local_notes text,
    source_urls text,
    profile_version text DEFAULT 'reference_v1'::text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT valid_ph_range CHECK (ph_opt_min >= 0 AND ph_opt_max <= 14 AND ph_opt_min <= ph_opt_max),
    CONSTRAINT valid_temp_range CHECK (temperature_opt_min_c <= temperature_opt_max_c),
    CONSTRAINT valid_ec_guidance CHECK (ec_guidance_max_dsm >= 0),
    CONSTRAINT valid_moisture_range CHECK (moisture_paw_min >= 0 AND moisture_paw_max <= 100 AND moisture_paw_min <= moisture_paw_max)
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.crop_reference_training_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    generated_at timestamptz DEFAULT now(),
    crop_label text NOT NULL,
    soil_ph double precision NOT NULL,
    temperature_c double precision NOT NULL,
    soil_conductivity_dsm double precision NOT NULL,
    moisture_paw_percent double precision NOT NULL,
    data_origin text DEFAULT 'reference_generated'::text,
    profile_version text DEFAULT 'reference_v1'::text,
    generation_run_id uuid NOT NULL,
    CONSTRAINT valid_training_ph CHECK (soil_ph >= 0 AND soil_ph <= 14),
    CONSTRAINT valid_training_ec CHECK (soil_conductivity_dsm >= 0),
    CONSTRAINT valid_training_moisture CHECK (moisture_paw_percent >= 0 AND moisture_paw_percent <= 100)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_crop_profiles_active ON public.crop_reference_profiles (active, profile_version) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_crop_training_label_origin ON public.crop_reference_training_data (crop_label, data_origin) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_crop_training_run_id ON public.crop_reference_training_data (generation_run_id) TABLESPACE pg_default;
