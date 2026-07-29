import os
import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Try importing supabase
try:
    from supabase import create_client, Client
except ImportError:
    create_client = None

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
MODEL_FILE = os.getenv("MODEL_FILE", "models/crop_reference_model.joblib")
RANDOM_SEED = int(os.getenv("RANDOM_SEED", 42))

def main():
    print("=" * 60)
    print("AgriBot Portable Wireless Soil Sensor - Model Trainer")
    print("=" * 60)
    
    np.random.seed(RANDOM_SEED)

    supabase: Client = None
    df = pd.DataFrame()

    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and create_client:
        try:
            print("Fetching 'reference_generated' records from Supabase...")
            supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            res = supabase.table("crop_reference_training_data") \
                .select("*") \
                .eq("data_origin", "reference_generated") \
                .execute()
            if res.data and len(res.data) > 0:
                df = pd.DataFrame(res.data)
                print(f"Loaded {len(df)} records from Supabase.")
            else:
                print("Warning: No records returned from Supabase. Attempting to load from local CSV...")
        except Exception as e:
            print(f"Warning: Could not fetch from Supabase ({str(e)}). Attempting to load from local CSV...")
    else:
        print("Notice: Supabase client unavailable. Attempting to load from local CSV...")

    if df.empty:
        csv_path = "reference_training_data_latest.csv"
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            print(f"Loaded {len(df)} records from local CSV '{csv_path}'.")
        else:
            print("Error: No training data available in Supabase or local CSV. Please run 'generate_reference_dataset.py' first.")
            return

    # Validate required columns
    required_cols = ["soil_ph", "temperature_c", "soil_conductivity_dsm", "moisture_paw_percent", "crop_label"]
    for col in required_cols:
        if col not in df.columns:
            print(f"Error: Missing required column '{col}' in training data.")
            return

    # Filter only reference_generated if data_origin column exists
    if "data_origin" in df.columns:
        df = df[df["data_origin"] == "reference_generated"]

    # Remove invalid records and duplicates
    initial_count = len(df)
    df = df.dropna(subset=required_cols)
    df = df[
        (df["soil_ph"] >= 0) & (df["soil_ph"] <= 14) &
        (df["moisture_paw_percent"] >= 0) & (df["moisture_paw_percent"] <= 100) &
        (df["soil_conductivity_dsm"] >= 0)
    ]
    df = df.drop_duplicates(subset=required_cols)
    print(f"Data cleaned: {initial_count} initial -> {len(df)} valid unique records.")

    print("\nRecord Counts by Crop:")
    crop_counts = df["crop_label"].value_counts()
    for crop, count in crop_counts.items():
        print(f"  - {crop}: {count} records")

    features = ["soil_ph", "temperature_c", "soil_conductivity_dsm", "moisture_paw_percent"]
    X = df[features]
    y = df["crop_label"]

    # Stratified train-test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_SEED
    )
    print(f"\nSplit data: {len(X_train)} training samples, {len(X_test)} testing samples.")

    # Train RandomForestClassifier with at least 500 estimators
    print("\nTraining RandomForestClassifier (500 estimators)...")
    rf = RandomForestClassifier(
        n_estimators=500,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)

    # Evaluate model
    y_pred = rf.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print("\n" + "=" * 60)
    print("MODEL EVALUATION RESULTS (Synthetic Holdout)")
    print("=" * 60)
    print(f"Synthetic Holdout Accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print("\nNOTE: This accuracy reflects performance on synthetic generated agronomic ranges, NOT real agricultural field accuracy.")
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    print("\nFeature Importance:")
    importances = dict(zip(features, rf.feature_importances_))
    for feat, imp in sorted(importances.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {feat}: {imp:.4f}")

    # Prepare model package
    os.makedirs(os.path.dirname(MODEL_FILE) or "models", exist_ok=True)
    
    warning_msg = (
        "PROTOTYPE WARNING: This model is a prototype trained from generated agronomic ranges "
        "and must later be replaced with verified field data."
    )
    
    package = {
        "model": rf,
        "features": features,
        "classes": list(rf.classes_),
        "model_version": "reference_rf_v1",
        "training_origin": "reference_generated",
        "training_records": len(df),
        "synthetic_holdout_accuracy": float(accuracy),
        "feature_importance": importances,
        "warning": warning_msg
    }

    joblib.dump(package, MODEL_FILE)
    print(f"\nSaved complete model package to '{MODEL_FILE}'.")
    print("=" * 60)

if __name__ == "__main__":
    main()
