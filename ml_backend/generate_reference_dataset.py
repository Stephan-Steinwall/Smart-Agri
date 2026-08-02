import os
import uuid
import numpy as np
import pandas as pd
from dotenv import load_dotenv

# Try importing supabase
try:
    from supabase import create_client, Client
except ImportError:
    create_client = None

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SAMPLES_PER_CROP = int(os.getenv("SAMPLES_PER_CROP", "250"))
RANDOM_SEED = int(os.getenv("RANDOM_SEED", "42"))

# Starter fallback profiles in case database table is not created/seeded yet
FALLBACK_PROFILES = [
    {
        "crop_name": "Mango",
        "ph_opt_min": 5.5, "ph_opt_max": 7.5,
        "temperature_opt_min_c": 24.0, "temperature_opt_max_c": 30.0,
        "ec_guidance_max_dsm": 4.0,
        "moisture_paw_min": 50.0, "moisture_paw_max": 80.0,
        "profile_version": "reference_v1"
    },
    {
        "crop_name": "Rice",
        "ph_opt_min": 5.5, "ph_opt_max": 7.0,
        "temperature_opt_min_c": 20.0, "temperature_opt_max_c": 30.0,
        "ec_guidance_max_dsm": 3.0,
        "moisture_paw_min": 75.0, "moisture_paw_max": 100.0,
        "profile_version": "reference_v1"
    },
    {
        "crop_name": "Maize",
        "ph_opt_min": 5.0, "ph_opt_max": 7.0,
        "temperature_opt_min_c": 18.0, "temperature_opt_max_c": 33.0,
        "ec_guidance_max_dsm": 1.7,
        "moisture_paw_min": 50.0, "moisture_paw_max": 80.0,
        "profile_version": "reference_v1"
    },
    {
        "crop_name": "Tomato",
        "ph_opt_min": 5.5, "ph_opt_max": 6.8,
        "temperature_opt_min_c": 20.0, "temperature_opt_max_c": 27.0,
        "ec_guidance_max_dsm": 2.5,
        "moisture_paw_min": 50.0, "moisture_paw_max": 80.0,
        "profile_version": "reference_v1"
    },
    {
        "crop_name": "Chilli",
        "ph_opt_min": 5.5, "ph_opt_max": 6.8,
        "temperature_opt_min_c": 17.0, "temperature_opt_max_c": 30.0,
        "ec_guidance_max_dsm": 1.5,
        "moisture_paw_min": 50.0, "moisture_paw_max": 80.0,
        "profile_version": "reference_v1"
    },
    {
        "crop_name": "Brinjal",
        "ph_opt_min": 5.5, "ph_opt_max": 6.8,
        "temperature_opt_min_c": 20.0, "temperature_opt_max_c": 35.0,
        "ec_guidance_max_dsm": 1.5,
        "moisture_paw_min": 50.0, "moisture_paw_max": 80.0,
        "profile_version": "reference_v1"
    },
    {
        "crop_name": "Onion",
        "ph_opt_min": 6.0, "ph_opt_max": 7.0,
        "temperature_opt_min_c": 12.0, "temperature_opt_max_c": 25.0,
        "ec_guidance_max_dsm": 1.2,
        "moisture_paw_min": 50.0, "moisture_paw_max": 75.0,
        "profile_version": "reference_v1"
    }
]

def sample_center_weighted(min_val, max_val, num_samples):
    """
    Generate samples inside [min_val, max_val] with more values near the center
    than near the boundaries using Beta(2, 2) distribution.
    """
    u = np.random.beta(a=2.0, b=2.0, size=num_samples)
    return min_val + u * (max_val - min_val)

def main():
    print("=" * 60)
    print("AgriBot Portable Wireless Soil Sensor - Reference Data Generator")
    print("=" * 60)
    
    np.random.seed(RANDOM_SEED)
    generation_run_id = str(uuid.uuid4())
    print(f"Generation Run ID: {generation_run_id}")
    print(f"Samples per crop:  {SAMPLES_PER_CROP}")
    print(f"Random seed:       {RANDOM_SEED}")

    supabase: Client = None
    profiles = []

    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and create_client:
        try:
            supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            res = supabase.table("crop_reference_profiles").select("*").eq("active", True).execute()
            if res.data and len(res.data) > 0:
                profiles = res.data
                print(f"Loaded {len(profiles)} active crop profiles from Supabase.")
            else:
                print("Warning: No active profiles found in Supabase table 'crop_reference_profiles'. Using fallback profiles.")
                profiles = FALLBACK_PROFILES
        except Exception as e:
            print(f"Warning: Could not read profiles from Supabase ({str(e)}). Using fallback profiles.")
            profiles = FALLBACK_PROFILES
    else:
        print("Notice: Supabase client credentials missing or library not installed. Using fallback profiles.")
        profiles = FALLBACK_PROFILES

    all_records = []
    crop_counts = {}

    for p in profiles:
        crop_name = p.get("crop_name")
        ph_min = float(p.get("ph_opt_min", 5.5))
        ph_max = float(p.get("ph_opt_max", 7.0))
        temp_min = float(p.get("temperature_opt_min_c", 20.0))
        temp_max = float(p.get("temperature_opt_max_c", 30.0))
        ec_max = float(p.get("ec_guidance_max_dsm") or p.get("ec_full_yield_max_dsm") or 2.0)
        moist_min = float(p.get("moisture_paw_min", 50.0))
        moist_max = float(p.get("moisture_paw_max", 80.0))
        version = p.get("profile_version", "reference_v1")

        # Generate center-weighted samples
        phs = sample_center_weighted(ph_min, ph_max, SAMPLES_PER_CROP)
        temps = sample_center_weighted(temp_min, temp_max, SAMPLES_PER_CROP)
        # EC sampled from 0.1 up to ec_max
        ecs = sample_center_weighted(0.1, ec_max, SAMPLES_PER_CROP)
        moists = sample_center_weighted(moist_min, moist_max, SAMPLES_PER_CROP)

        for i in range(SAMPLES_PER_CROP):
            record = {
                "id": str(uuid.uuid4()),
                "crop_label": crop_name,
                "soil_ph": round(float(phs[i]), 2),
                "temperature_c": round(float(temps[i]), 1),
                "soil_conductivity_dsm": round(float(ecs[i]), 2),
                "moisture_paw_percent": round(float(moists[i]), 1),
                "data_origin": "reference_generated",
                "profile_version": version,
                "generation_run_id": generation_run_id
            }
            all_records.append(record)
        
        crop_counts[crop_name] = SAMPLES_PER_CROP

    print("\nGenerated Sample Counts by Crop:")
    for crop, count in crop_counts.items():
        print(f"  - {crop}: {count} records")
    print(f"Total records generated: {len(all_records)}")

    # Save to CSV locally as a backup / easy verification
    df = pd.DataFrame(all_records)
    csv_path = "reference_training_data_latest.csv"
    df.to_csv(csv_path, index=False)
    print(f"\nSaved generated records locally to '{csv_path}'.")

    # Batch insert into Supabase public.crop_reference_training_data
    if supabase:
        print("\nInserting records into Supabase 'crop_reference_training_data' in batches of 100...")
        batch_size = 100
        inserted_count = 0
        try:
            for i in range(0, len(all_records), batch_size):
                batch = all_records[i:i+batch_size]
                supabase.table("crop_reference_training_data").insert(batch).execute()
                inserted_count += len(batch)
            print(f"Successfully inserted {inserted_count} records into Supabase!")
        except Exception as e:
            print(f"Warning: Failed to insert records into Supabase table ({str(e)}).")
            print("Note: Ensure you have run '01_create_crop_reference_tables.sql' in your Supabase project.")
            print("The local CSV file 'reference_training_data_latest.csv' contains the full dataset and can be used for training.")
    else:
        print("\nSkipping Supabase insert (no active connection). Using local CSV for training.")

    print("\nIMPORTANT: Never insert generated rows into public.\"Wireless sensor Soil Analysis data\".")
    print("Generation complete.")
    print("=" * 60)

if __name__ == "__main__":
    main()
