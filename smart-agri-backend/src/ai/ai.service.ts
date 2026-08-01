import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TelemetryService } from '../telemetry/telemetry.service';
import { SupabaseService } from '../supabase/supabase.service';

interface MlFeatures {
  soil_ph: number;
  temperature_c: number;
  soil_conductivity_dsm: number;
  moisture_paw_percent: number;
}

interface CropScore {
  crop: string;
  reference_score: number;
}

@Injectable()
export class AiService {
  private openai: OpenAI;
  private readonly logger = new Logger(AiService.name);

  private readonly mlApiUrl: string;
  private readonly ecSensorUnit: string;
  private readonly soilFieldCapacity: number | null;
  private readonly soilWiltingPoint: number | null;
  private readonly farmLatitude: number;
  private readonly farmLongitude: number;

  constructor(
    private configService: ConfigService,
    private telemetryService: TelemetryService,
    private supabaseService: SupabaseService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });

    this.mlApiUrl =
      this.configService.get<string>('ML_API_URL') || 'http://127.0.0.1:8000';
    this.ecSensorUnit =
      this.configService.get<string>('EC_SENSOR_UNIT') || 'dS/m';

    const fieldCapacity = this.configService.get<string>('SOIL_FIELD_CAPACITY');
    const wiltingPoint = this.configService.get<string>('SOIL_WILTING_POINT');
    this.soilFieldCapacity = fieldCapacity ? Number(fieldCapacity) : null;
    this.soilWiltingPoint = wiltingPoint ? Number(wiltingPoint) : null;

    // Fixed physical location of the sensor node, NOT the browser's location.
    // Defaults match the frontend's old Colombo fallback if unset.
    this.farmLatitude =
      Number(this.configService.get<string>('FARM_LATITUDE')) || 6.9271;
    this.farmLongitude =
      Number(this.configService.get<string>('FARM_LONGITUDE')) || 79.8612;
  }

  async askAgronomist(query: string, deviceId: string, sessionId: string) {
    // 1. Fetch Context (Current state of the farm)
    const latestReading =
      await this.telemetryService.getLatestReading(deviceId);

    if (!latestReading) {
      return {
        answer:
          "I'm sorry, but I cannot access the sensor data for this device right now. Please ensure the sensor node is online and transmitting.",
      };
    }

    // 2. Fetch Chat History from Supabase
    const { data: chatHistory, error: historyError } =
      await this.supabaseService
        .getClient()
        .from('ai_chat_history')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (historyError) {
      this.logger.error(
        `Failed to fetch chat history: ${historyError.message}`,
      );
    }

    // 3. Build the System Prompt (RAG Context)
    const systemPrompt = `
      You are an expert Agronomy AI Assistant managing a Smart Agriculture Platform.
      You provide concise, professional, and actionable advice to farmers based on raw data.

      You have access to a tool 'fetch_data_from_supabase' to query the database.
      CRITICAL RULES:
      1. You are strictly READ-ONLY. You MUST NOT attempt to edit, insert, or delete data.
      2. You MUST NOT access or reveal any passwords or sensitive user credentials.
      3. You MUST NOT control the system, such as switching pumps, modifying settings, or altering 'system_switches'. You can only READ the state and reply to the user.

      DATABASE SCHEMA AVAILABLE:
      - "Wireless sensor Soil Analysis data" (soil_moisture, temperature, soil_ph, soil_conductivity, nitrogen, phosphorus, potassium, recommended_crop, device_id, crop_label, reading_at)
      - custom_threshold_presets (moisture_threshold_low/high, nitrogen_threshold_low/high, phosphorus_threshold_low/high, potassium_threshold_low/high)
      - environment_sensor_readings (light_intensity_lux, soil_temperature_c, air_temperature_c, humidity_percent, rain_detected, recorded_at)
      - latest_soil_reading (soil_moisture_percent, soil_temperature_celsius, ec_levels, soil_ph, nitrogen, phosphorus, potassium, salinity, tds_mg_l, sensor_status)
      - pump_activation_logs (session_id, device_id, pump_name, start_time, end_time, status)
      - soil_readings (soil_moisture_percent, soil_temperature_celsius, soil_ph, nitrogen, phosphorus, potassium, created_at)
      - soil_sensor_readings (soil_moisture_percent, soil_temperature_celsius, conductivity, soil_ph, nitrogen, phosphorus, potassium, created_at)
      - system_alerts (severity, message, created_at, read_at)
      - system_switches (device_id, pump_water, pump_nitrogen, pump_phosphorus, pump_potassium, system_switch, light_01, light_02, etc.)

      CURRENT SENSOR DATA CONTEXT (Device: ${deviceId}):
      - Time of reading: ${latestReading.time}
      - Soil Moisture: ${latestReading.moisture}% (Optimal range: 40-70%)
      - Temperature: ${latestReading.temperature}°C
      - Nitrogen (N): ${latestReading.nitrogen} ppm
      - Phosphorus (P): ${latestReading.phosphorus} ppm
      - Potassium (K): ${latestReading.potassium} ppm
      - pH Level: ${latestReading.ph}

      INSTRUCTIONS:
      Answer the user's question directly based on the data above or by querying the database if historical or other tables' data is needed. Do not hallucinate data.
      If moisture is below 30%, recommend immediate irrigation.
      Keep responses concise and actionable.
    `;

    // Format history for OpenAI
    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    if (chatHistory) {
      for (const msg of chatHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add the new user query
    messages.push({ role: 'user', content: query });

    const tools = [
      {
        type: 'function',
        function: {
          name: 'fetch_data_from_supabase',
          description: 'Fetch data from the Supabase database. You can only read data, not modify it.',
          parameters: {
            type: 'object',
            properties: {
              table_name: { type: 'string', description: 'The name of the table to query' },
              select_columns: { type: 'string', description: "The columns to select, comma separated (default '*')" },
              limit: { type: 'number', description: 'Maximum number of rows to return (default 10)' },
              order_by_column: { type: 'string', description: 'Optional column to order by' },
              order_by_ascending: { type: 'boolean', description: 'Set to false for descending order (default false)' },
              eq_filter_column: { type: 'string', description: 'Optional column to filter by equality' },
              eq_filter_value: { type: 'string', description: 'Optional value for the equality filter' }
            },
            required: ['table_name']
          }
        }
      }
    ];

    let continueProcessing = true;
    let answer = "";

    while (continueProcessing) {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125', // Use a model version that reliably supports tools
        messages: messages,
        temperature: 0.2, // Low temperature for factual, analytical responses
        tools: tools as any,
        tool_choice: 'auto'
      });

      const message = response.choices[0].message;
      messages.push(message as any);

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
          const toolCall = tc as any;
          if (toolCall.function?.name === 'fetch_data_from_supabase') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              let queryObj: any = this.supabaseService.getClient().from(args.table_name).select(args.select_columns || '*');
              
              if (args.eq_filter_column && args.eq_filter_value) {
                queryObj = queryObj.eq(args.eq_filter_column, args.eq_filter_value);
              }
              
              if (args.order_by_column) {
                queryObj = queryObj.order(args.order_by_column, { ascending: args.order_by_ascending ?? false });
              }
              
              queryObj = queryObj.limit(args.limit || 10);
              
              const { data, error } = await queryObj;
              
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: error ? JSON.stringify({ error: error.message }) : JSON.stringify(data)
              });
            } catch (err: any) {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify({ error: err.message })
              });
            }
          }
        }
      } else {
        continueProcessing = false;
        answer = message.content || "";
      }
    }

    // 5. Save the new messages to Chat History
    if (answer) {
      const { error: insertError } = await this.supabaseService
        .getClient()
        .from('ai_chat_history')
        .insert([
          { session_id: sessionId, role: 'user', content: query },
          { session_id: sessionId, role: 'assistant', content: answer },
        ]);

      if (insertError) {
        this.logger.error(
          `Failed to save chat history: ${insertError.message}`,
        );
      }
    }

    return { answer };
  }

  // ── Crop prediction: RandomForest (ml_backend) scores, OpenAI narrates ────

  // Mirrors smart-agri-frontend's convertEcToDsm/calculatePlantAvailableWater
  // (wireless-soil-sensor/analyze/page.tsx) so both sides agree on units.
  private convertEcToDsm(rawEc: number): number {
    if (this.ecSensorUnit === 'uS/cm') return rawEc / 1000;
    return rawEc;
  }

  private calculatePlantAvailableWater(rawMoisture: number): number {
    if (
      this.soilFieldCapacity == null ||
      this.soilWiltingPoint == null ||
      this.soilFieldCapacity <= this.soilWiltingPoint
    ) {
      return Math.max(0, Math.min(100, rawMoisture));
    }
    const paw =
      (100 * (rawMoisture - this.soilWiltingPoint)) /
      (this.soilFieldCapacity - this.soilWiltingPoint);
    return Math.max(0, Math.min(100, paw));
  }

  private resolveMlFeatures(reading: any): MlFeatures {
    const conductivity =
      reading.soilConductivity ??
      reading.electricalConductivity ??
      reading.conductivity ??
      0;

    return {
      soil_ph: reading.ph ?? 7.0,
      temperature_c: reading.temperature ?? 25.0,
      soil_conductivity_dsm: this.convertEcToDsm(conductivity),
      moisture_paw_percent: this.calculatePlantAvailableWater(
        reading.moisture ?? 50.0,
      ),
    };
  }

  private async rankCropsViaModel(features: MlFeatures): Promise<CropScore[]> {
    const response = await fetch(`${this.mlApiUrl}/rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `ML /rank request failed (${response.status}): ${detail}`,
      );
    }

    const data = await response.json();
    return data.rankings;
  }

  private async evaluateCropViaModel(
    features: MlFeatures,
    cropName: string,
  ): Promise<any> {
    const response = await fetch(`${this.mlApiUrl}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_crop: cropName, ...features }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `ML /evaluate request failed (${response.status}): ${detail}`,
      );
    }

    return response.json();
  }

  async suggestCrop(deviceId: string) {
    const reading = await this.telemetryService.getLatestReading(deviceId);
    if (!reading) {
      return { error: 'No sensor readings found for this device.' };
    }

    const features = this.resolveMlFeatures(reading);

    let rankings: CropScore[];
    try {
      rankings = await this.rankCropsViaModel(features);
    } catch (error: any) {
      this.logger.error(
        `Crop ranking via ML model failed: ${error?.message ?? error}`,
      );
      return {
        error: 'Unable to reach the crop recommendation model right now.',
      };
    }

    if (!rankings?.length) {
      return { error: 'The crop recommendation model returned no rankings.' };
    }

    const [top, ...rest] = rankings;
    const alternatives = rest.slice(0, 2);

    try {
      const prompt = `A RandomForest agronomic reference model already scored every supported crop against the current soil reading (0-100, higher = better fit). These scores are final -- explain them, do not invent your own.

Soil reading used:
- Moisture (plant-available water): ${features.moisture_paw_percent.toFixed(1)}%
- pH: ${features.soil_ph}
- Temperature: ${features.temperature_c}°C
- Conductivity: ${features.soil_conductivity_dsm} dS/m

Model output:
- Top match: ${top.crop} (${top.reference_score}/100)
- Alternatives: ${alternatives.map((a) => `${a.crop} (${a.reference_score}/100)`).join(', ') || 'none'}

Respond ONLY with valid JSON using this exact structure:
{
  "summary": string (1-2 sentences on why ${top.crop} scored highest for this soil profile),
  "recommendedDescription": string (short description of ${top.crop}'s growing needs),
  "recommendedReasons": [string] (2-3 short bullet reasons tying the actual readings above to the score),
  "alternativeDescriptions": [string] (one short description per alternative, same order as listed above),
  "prePlantRecommendations": [string] (specific soil adjustments to make before planting ${top.crop}, based on the actual readings above)
}
Do not add any extra commentary or fields.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              "You are a concise agronomist explaining a RandomForest crop-fit model's output to a farmer. Never invent or change the scores given to you -- only explain them.",
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed?.summary) {
          return {
            recommendedCrop: {
              crop: top.crop,
              score: top.reference_score,
              description: parsed.recommendedDescription ?? '',
              reasons: Array.isArray(parsed.recommendedReasons)
                ? parsed.recommendedReasons
                : [],
            },
            alternatives: alternatives.map((alt, i) => ({
              crop: alt.crop,
              score: alt.reference_score,
              description: parsed.alternativeDescriptions?.[i] ?? '',
            })),
            summary: parsed.summary,
            prePlantRecommendations: Array.isArray(
              parsed.prePlantRecommendations,
            )
              ? parsed.prePlantRecommendations
              : [],
          };
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `OpenAI narration for crop suggestion failed, using plain RF summary: ${error?.message ?? error}`,
      );
    }

    // Fallback: plain summary built directly from the RF ranking (no heuristics).
    return {
      recommendedCrop: {
        crop: top.crop,
        score: top.reference_score,
        description: `RandomForest reference score: ${top.reference_score}/100.`,
        reasons: [],
      },
      alternatives: alternatives.map((alt) => ({
        crop: alt.crop,
        score: alt.reference_score,
        description: `RandomForest reference score: ${alt.reference_score}/100.`,
      })),
      summary: `Based on the trained crop-fit model, ${top.crop} is the strongest match for this field (score ${top.reference_score}/100).`,
      prePlantRecommendations: [],
    };
  }

  async evaluateCrop(
    deviceId: string,
    cropName: string,
    soilMetrics?: {
      moisture?: number;
      temperature?: number;
      ph?: number;
      conductivity?: number;
    },
  ) {
    let reading: any;
    if (soilMetrics) {
      // Evaluating a saved/historical sample instead of the device's live reading.
      reading = {
        moisture: soilMetrics.moisture ?? null,
        temperature: soilMetrics.temperature ?? null,
        ph: soilMetrics.ph ?? null,
        soilConductivity: soilMetrics.conductivity ?? null,
      };
    } else {
      reading = await this.telemetryService.getLatestReading(deviceId);
      if (!reading) {
        return { error: 'No sensor readings found for this device.' };
      }
    }

    const features = this.resolveMlFeatures(reading);

    let modelResult: any;
    try {
      modelResult = await this.evaluateCropViaModel(features, cropName);
    } catch (error: any) {
      this.logger.error(
        `Crop evaluation via ML model failed: ${error?.message ?? error}`,
      );
      return {
        error: 'Unable to reach the crop recommendation model right now.',
      };
    }

    const canPlantNow: boolean = Boolean(
      modelResult?.decision?.startsWith('Recommended'),
    );

    try {
      const prompt = `A RandomForest agronomic reference model already decided whether ${cropName} can be planted now, based on the soil reading below. This decision is final -- explain it and suggest concrete actions, do not override it.

Soil reading used:
- Moisture (plant-available water): ${features.moisture_paw_percent.toFixed(1)}%
- pH: ${features.soil_ph}
- Temperature: ${features.temperature_c}°C
- Conductivity: ${features.soil_conductivity_dsm} dS/m

Model decision: ${modelResult.decision} (score ${modelResult.selected_crop_reference_score}/100)
Model message: ${modelResult.decision_message}

Respond ONLY with valid JSON using this exact structure:
{
  "reasons": [string] (2-3 short bullet reasons tying the actual readings above to the decision),
  "actions": [string] (specific actions the farmer should take next, whether that's proceeding to plant or amending the soil first)
}
Do not add any extra commentary or fields.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              "You are a concise agronomist explaining a RandomForest model's planting decision to a farmer. Never override the decision given to you -- only explain it and suggest actions.",
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed?.reasons) && Array.isArray(parsed?.actions)) {
          return {
            ...modelResult,
            cropName,
            canPlantNow,
            recommendation: modelResult.decision_message,
            reasons: parsed.reasons,
            actions: parsed.actions,
          };
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `OpenAI narration for crop evaluation failed, using plain RF result: ${error?.message ?? error}`,
      );
    }

    // Fallback: plain result built directly from the RF decision (no heuristics).
    return {
      ...modelResult,
      cropName,
      canPlantNow,
      recommendation: modelResult.decision_message,
      reasons: [
        `Reference score: ${modelResult.selected_crop_reference_score}/100 (${modelResult.decision}).`,
      ],
      actions: canPlantNow
        ? []
        : [
            `Consider ${modelResult.recommended_crop} instead (score ${modelResult.recommended_crop_reference_score}/100), or adjust soil conditions before planting ${cropName}.`,
          ],
    };
  }

  // A simpler status generator based purely on sensor data without CropProfiles
  async generateFieldInsight(deviceId: string) {
    const reading = await this.telemetryService.getLatestReading(deviceId);

    if (!reading) {
      return { error: 'No sensor readings found for this device.' };
    }

    const systemPrompt = `
      You are an expert AI Agronomist monitoring a generic crop field.

      CURRENT LIVE READINGS:
      - Moisture: ${reading.moisture}% (Target: > 40%)
      - Nitrogen: ${reading.nitrogen} ppm (Target: > 40 ppm)
      - Phosphorus: ${reading.phosphorus} ppm (Target: > 20 ppm)
      - Potassium: ${reading.potassium} ppm (Target: > 30 ppm)
      - pH: ${reading.ph} (Target: ~6.0 - 6.5)

      Analyze the current readings against general ideal conditions.
      Respond ONLY with a valid JSON object matching this exact structure:
      {
        "healthScore": number (0-100),
        "status": string ("Optimal", "Moderate", "Critical"),
        "riskLevel": string ("Low", "Medium", "High"),
        "primaryAction": string (A short, 3-5 word command, e.g., "Dose Nitrogen Now"),
        "detailedReason": string (1-2 sentence explanation of why you recommend this action)
      }
    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) return { error: 'AI returned an empty response.' };

    try {
      return JSON.parse(content);
    } catch (e) {
      return { error: 'Failed to parse AI response.' };
    }
  }

  async getChatSessions() {
    // Query distinct session IDs. In Supabase/PostgreSQL, we can get unique sessions
    // by grouping or just grabbing everything and doing it in JS if it's small,
    // but grouping is better.
    // Wait, standard postgrest doesn't easily support DISTINCT or GROUP BY without RPC.
    // Workaround: fetch all history ordered by created_at desc, and filter unique in JS.
    const { data, error } = await this.supabaseService
      .getClient()
      .from('ai_chat_history')
      .select('session_id, role, content, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error fetching sessions: ${error.message}`);
      return [];
    }

    // Group by session_id to find the latest message and generate a title
    const sessionMap = new Map<string, any>();

    for (const row of data) {
      if (!sessionMap.has(row.session_id)) {
        // If the very last message in a session was by user, use that as title.
        // Otherwise we just say "Chat Session"
        let title = 'Chat Session';
        if (row.role === 'user') {
          title =
            row.content.length > 40
              ? row.content.substring(0, 40) + '...'
              : row.content;
        }

        sessionMap.set(row.session_id, {
          sessionId: row.session_id,
          lastMessageAt: row.created_at,
          title: title,
        });
      } else {
        // Update title if we find a user message and current title is generic
        const current = sessionMap.get(row.session_id);
        if (current.title === 'Chat Session' && row.role === 'user') {
          current.title =
            row.content.length > 40
              ? row.content.substring(0, 40) + '...'
              : row.content;
        }
      }
    }

    return Array.from(sessionMap.values());
  }

  async getChatHistory(sessionId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('ai_chat_history')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `Error fetching history for session ${sessionId}: ${error.message}`,
      );
      return [];
    }

    return data;
  }

  async deleteChatHistory(sessionId: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('ai_chat_history')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      this.logger.error(
        `Error deleting history for session ${sessionId}: ${error.message}`,
      );
      throw new Error(`Failed to delete chat history: ${error.message}`);
    }
    return { success: true };
  }

  // ── Rain prediction ──────────────────────────────────────────────────────
  // lat/lon default to the fixed farm location (FARM_LATITUDE/FARM_LONGITUDE),
  // NOT the caller's browser location -- the local sensor trend this fuses
  // with is only meaningful for wherever the physical sensor node actually is.
  async predictRain(deviceId: string, lat?: number, lon?: number) {
    const latitude = lat ?? this.farmLatitude;
    const longitude = lon ?? this.farmLongitude;

    // 1. Fetch Local Telemetry History
    const history = await this.telemetryService.getEnvironmentHistory(deviceId);

    // We only need the latest few readings to see trends (e.g. last 3 readings)
    const recentHistory = history.slice(0, 3).map((r) => ({
      time: r.recorded_at,
      pressure: r.atmospheric_pressure_hpa,
      pressure_condition: r.pressure_condition,
      humidity: r.humidity_percent,
      dew_point: r.dew_point_c,
      temp: r.air_temperature_c,
      dew_point_spread: r.dew_point_spread_c,
    }));

    // 2. Fetch Regional Forecast from Open-Meteo
    let forecastData: any = null;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=precipitation_probability,precipitation`;
      const response = await fetch(url);
      if (response.ok) {
        forecastData = await response.json();
      }
    } catch (error: any) {
      this.logger.error(`Failed to fetch Open-Meteo data: ${error.message}`);
    }

    // Extract next 5 hours of precipitation data
    let regionalPrecip = 'Unknown';
    if (forecastData && forecastData.hourly) {
      const currentIndex = forecastData.hourly.time.findIndex(
        (t: string) => new Date(t) >= new Date(),
      );
      if (currentIndex !== -1) {
        const next5HoursPop =
          forecastData.hourly.precipitation_probability.slice(
            currentIndex,
            currentIndex + 5,
          );
        const next5HoursRain = forecastData.hourly.precipitation.slice(
          currentIndex,
          currentIndex + 5,
        );
        regionalPrecip = `Next 5 hours Precipitation Probabilities: ${next5HoursPop.join('%, ')}% | Next 5 hours Rainfall: ${next5HoursRain.join('mm, ')}mm`;
      }
    }

    // 3. Synthesize with OpenAI
    const systemPrompt = `
      You are an expert Meteorological AI Assistant for a Smart Agriculture Platform.
      You combine macro-level regional weather forecasts with hyper-local farm sensor telemetry to provide highly accurate short-term rain predictions.

      REGIONAL FORECAST (Open-Meteo):
      ${regionalPrecip}

      HYPER-LOCAL SENSOR TRENDS (Last 3 readings, newest first):
      ${JSON.stringify(recentHistory, null, 2)}

      INSTRUCTIONS:
      1. CRITICAL: First and foremost, analyze the local sensor trend (is pressure dropping rapidly? is dew point spread nearing 0? is rain already detected locally?). This local ground-truth data is your absolute primary source of truth.
      2. ONLY AFTER analyzing the local data, use the regional precipitation probability as a secondary confirmation. If local sensors strongly indicate rain, ignore a low regional probability.
      3. Synthesize a confident, short-term rain prediction for the farmer based primarily on the local data.
      4. If rain is expected within the next 5 hours, state the total expected rainfall (mm) and classify the rain_intensity (e.g., "Light", "Moderate", "Heavy", "None").
      5. Include a boolean "will_rain" field which is true if ANY rain is expected, false otherwise.
      6. Output ONLY a valid JSON object matching this structure:
      {
        "prediction": "A clear, concise 1-2 sentence prediction for the next 5 hours.",
        "confidence": 85,
        "reasoning": "Brief explanation of why based on local data first, then regional forecast.",
        "expected_rainfall_mm": 2.5,
        "rain_intensity": "Moderate",
        "will_rain": true
      }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message?.content || '{}');

      // Update Supabase Database with the new prediction
      if (typeof result.will_rain === 'boolean') {
        const { data: updateData, error: updateError } =
          await this.supabaseService
            .getClient()
            .from('rain_predictions')
            .update({
              will_rain: result.will_rain,
              updated_at: new Date().toISOString(),
            })
            .eq('device_id', deviceId)
            .select();

        if (updateError) {
          this.logger.error(
            `Failed to update rain_predictions table: ${updateError.message}`,
          );
        } else if (!updateData || updateData.length === 0) {
          // Row doesn't exist, insert it
          const { error: insertError } = await this.supabaseService
            .getClient()
            .from('rain_predictions')
            .insert({
              device_id: deviceId,
              will_rain: result.will_rain,
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            this.logger.error(
              `Failed to insert into rain_predictions table: ${insertError.message}`,
            );
          }
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error(`AI Rain Prediction failed: ${error.message}`);
      return {
        prediction: 'Unable to generate prediction at this time.',
        confidence: 0,
        reasoning: 'AI synthesis failed or timed out.',
      };
    }
  }

  async toggleRainPrediction(deviceId: string, enabled: boolean) {
    this.logger.log(`Toggling rain prediction for ${deviceId} to ${enabled}`);

    const update: {
      prediction_enabled: boolean;
      updated_at: string;
      will_rain?: boolean;
    } = {
      prediction_enabled: enabled,
      updated_at: new Date().toISOString(),
    };
    if (!enabled) {
      // If turned off, immediately set will_rain to false too.
      update.will_rain = false;
    }

    const { data, error: updateError } = await this.supabaseService
      .getClient()
      .from('rain_predictions')
      .update(update)
      .eq('device_id', deviceId)
      .select();

    if (updateError) {
      this.logger.error(
        `Failed to update rain_predictions.prediction_enabled: ${updateError.message}`,
      );
    } else if (!data || data.length === 0) {
      // Row doesn't exist, insert it
      const { error: insertError } = await this.supabaseService
        .getClient()
        .from('rain_predictions')
        .insert({
          device_id: deviceId,
          will_rain: false,
          prediction_enabled: enabled,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        this.logger.error(
          `Failed to insert rain_predictions row: ${insertError.message}`,
        );
      }
    }

    return { success: true, enabled };
  }

  async getRainPredictionStatus(deviceId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('rain_predictions')
      .select('will_rain, prediction_enabled')
      .eq('device_id', deviceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Error fetching prediction status for ${deviceId}: ${error.message}`,
      );
    }

    return {
      will_rain: data?.will_rain ?? false,
      prediction_enabled: data?.prediction_enabled ?? true,
    };
  }

  async getCropThresholds(cropName: string) {
    this.logger.log(`Generating AI thresholds for crop: ${cropName}`);

    const systemPrompt = `
      You are an expert Agronomy AI.
      Determine the optimal automation boundaries for a smart irrigation and fertigation system for growing the crop: ${cropName}.
      Provide the safe and optimal Low (turn ON) and High (turn OFF) thresholds for:
      - Soil Moisture (%)
      - Nitrogen (mg/kg)
      - Phosphorus (mg/kg)
      - Potassium (mg/kg)

      You MUST respond with ONLY a raw JSON object and nothing else. No markdown wrapping.
      The JSON structure MUST exactly match the following:
      {
        "moisture_threshold_low": number,
        "moisture_threshold_high": number,
        "nitrogen_threshold_low": number,
        "nitrogen_threshold_high": number,
        "phosphorus_threshold_low": number,
        "phosphorus_threshold_high": number,
        "potassium_threshold_low": number,
        "potassium_threshold_high": number
      }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const jsonStr = response.choices[0].message.content || '{}';
      return JSON.parse(jsonStr);
    } catch (error: any) {
      this.logger.error(
        `Failed to generate crop thresholds for ${cropName}: ${error.message}`,
      );
      // Fallback values if AI fails
      return {
        moisture_threshold_low: 40,
        moisture_threshold_high: 60,
        nitrogen_threshold_low: 30,
        nitrogen_threshold_high: 50,
        phosphorus_threshold_low: 30,
        phosphorus_threshold_high: 50,
        potassium_threshold_low: 30,
        potassium_threshold_high: 50,
      };
    }
  }
}
