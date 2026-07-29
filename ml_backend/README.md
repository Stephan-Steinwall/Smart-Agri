# Portable Wireless Soil Sensor — ML & Crop Recommendation Backend

## 🧠 Model Architecture & Scoring
- **Algorithm**: `RandomForestClassifier(n_estimators=500)` via `scikit-learn`.
- **How it works**: An ensemble of 500 decision trees evaluates sensor telemetry simultaneously. Class probability distributions (`predict_proba`) are scaled into a **0–100 Reference Score** per crop.
- **Input Features (4)**: `soil_ph` ($0.0-14.0$), `temperature_c` ($^\circ\text{C}$), `soil_conductivity_dsm` ($\text{dS/m}$ salinity/nutrients), and `moisture_paw_percent` ($0\%-100\%$ plant available water).
- **Supported Crops (7)**: Mango, Rice, Maize, Tomato, Chilli, Brinjal, Onion.
- **Decision Thresholds**:
  - **Score $\ge 60.0$**: **Recommended** (matches optimal biological conditions).
  - **Score $35.0 - 59.9$**: **Possible with caution** (feasible; monitor drainage and salinity).
  - **Score $< 35.0$**: **Not recommended** (outside ideal boundaries; suggests alternatives).

---

## 📊 Training Data & Generation
- **Source of Truth**: Sourced from **FAO** guidelines (`sql/02_seed_crop_profiles.sql`), defining optimal pH, temperature, salinity tolerance (EC), and moisture requirements per crop.
- **Synthetic Center-Weighted Sampling**: To bootstrap the classifier, `generate_reference_dataset.py` generates **250 synthetic samples per crop** ($1,750$ total rows) using a **$\text{Beta}(2.0, 2.0)$ distribution** (`sample_center_weighted`). This clusters generated data near ideal crop medians rather than uniform extremes.
- **Database Isolation**: Tagged with `data_origin = "reference_generated"` and stored in `crop_reference_training_data`. Strictly isolated from real field measurements stored in `public."Wireless sensor Soil Analysis data"`.

---

## 🛠️ Database Setup
Run SQL migration scripts in your Supabase SQL Editor in exact order:
1. `sql/01_create_crop_reference_tables.sql` — Creates reference profiles and training data tables.
2. `sql/02_seed_crop_profiles.sql` — Seeds starter crop profiles (idempotent upserts).

---

## 🚀 Setup & Execution
Run these NPM commands from the project root (`c:\Users\user\Documents\GitHub\Smart-Agri`):

```bash
npm run ml:install    # 1. Install Python dependencies into virtual environment
npm run ml:generate   # 2. Generate center-weighted training dataset
npm run ml:train      # 3. Train Random Forest model and save .joblib file
npm run ml:serve      # 4. Start FastAPI server with auto-reload enabled
```

---

## 🔌 API Documentation & Testing
Server listens at `http://127.0.0.1:8000`. *(Note: Root path `/` returns `404` by design; use `/docs` for Swagger UI).*

- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc UI**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### Endpoints

#### `GET /health`
Checks API status, model loading, and supported crops.
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "reference_rf_v1",
  "supported_crops": ["Maize", "Mango", "Rice", "Tomato", "Chilli", "Brinjal", "Onion"],
  "service": "Portable Wireless Soil Sensor Recommendation Module"
}
```

#### `POST /evaluate`
Submits real-time sensor readings to receive scores and recommendations.
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "selected_crop": "Tomato",
    "soil_ph": 6.5,
    "temperature_c": 25.0,
    "soil_conductivity_dsm": 1.2,
    "moisture_paw_percent": 75.0
  }
  ```
- **Response**:
  ```json
  {
    "selected_crop": "Tomato",
    "selected_crop_reference_score": 85.4,
    "decision": "Recommended by reference model",
    "decision_message": "The agronomic reference model indicates that Tomato is recommended for this soil profile (Score: 85.4/100).",
    "recommended_crop": "Tomato",
    "recommended_crop_reference_score": 85.4,
    "top_recommendations": [
      { "crop": "Tomato", "reference_score": 85.4 },
      { "crop": "Mango", "reference_score": 12.0 },
      { "crop": "Maize", "reference_score": 2.6 }
    ],
    "model_version": "reference_rf_v1",
    "training_origin": "reference_generated",
    "warning": "PROTOTYPE WARNING: Trained from generated agronomic ranges."
  }
  ```

### Quick PowerShell Test
```powershell
$body = @{
    selected_crop = "Tomato"
    soil_ph = 6.5
    temperature_c = 25.0
    soil_conductivity_dsm = 1.2
    moisture_paw_percent = 75.0
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/evaluate" -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 5
```

---

## ⚠️ Prototype Warning
**PROTOTYPE WARNING**: This model is trained on synthetic reference ranges derived from FAO guidelines. As physical sensors are deployed, real farmer measurements stored in `"Wireless sensor Soil Analysis data"` must be empirically validated and incorporated to refine these boundaries over time.
