import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TelemetryService } from '../telemetry/telemetry.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AiService {
  private openai: OpenAI;
  private readonly logger = new Logger(AiService.name);
  private readonly cropProfiles = [
    {
      name: 'Maize',
      idealMoisture: 58,
      idealPh: 6.0,
      idealTemperature: 25,
      idealNitrogen: 50,
      idealPhosphorus: 25,
      idealPotassium: 35,
      description: 'Thrives in warm, moderately moist soils with balanced NPK.',
    },
    {
      name: 'Rice',
      idealMoisture: 75,
      idealPh: 6.0,
      idealTemperature: 28,
      idealNitrogen: 45,
      idealPhosphorus: 20,
      idealPotassium: 30,
      description: 'Prefers wetter soil and slightly warmer conditions.',
    },
    {
      name: 'Tomato',
      idealMoisture: 50,
      idealPh: 6.3,
      idealTemperature: 22,
      idealNitrogen: 40,
      idealPhosphorus: 20,
      idealPotassium: 40,
      description: 'Works well in well-drained, moderately moist soil.',
    },
    {
      name: 'Potato',
      idealMoisture: 48,
      idealPh: 5.8,
      idealTemperature: 18,
      idealNitrogen: 35,
      idealPhosphorus: 25,
      idealPotassium: 45,
      description: 'Best in cooler soil with balanced nutrients.',
    },
    {
      name: 'Lettuce',
      idealMoisture: 65,
      idealPh: 6.2,
      idealTemperature: 16,
      idealNitrogen: 30,
      idealPhosphorus: 15,
      idealPotassium: 25,
      description: 'Prefers cooler conditions and consistently moist soil.',
    },
  ];

  constructor(
    private configService: ConfigService,
    private telemetryService: TelemetryService,
    private supabaseService: SupabaseService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async askAgronomist(query: string, deviceId: string, sessionId: string) {
    const targetDeviceId = deviceId || 'agribot_receiver_01';

    // 1. Fetch Context from all 5 core system tables in parallel
    const [
      latestReading,
      switchesRes,
      pumpLogsRes,
      savedAnalysesRes,
      cropProfilesRes,
      recentReadingsRes,
    ] = await Promise.all([
      this.telemetryService.getLatestReading(targetDeviceId).catch(() => null),
      this.supabaseService.getClient().from('system_switches').select('*').eq('device_id', targetDeviceId).maybeSingle(),
      this.supabaseService.getClient().from('pump_activation_logs').select('*').eq('device_id', targetDeviceId).order('start_time', { ascending: false }).limit(5),
      this.supabaseService.getClient().from('Wireless sensor Soil Analysis data').select('*').eq('device_id', targetDeviceId).order('saved_at', { ascending: false }).limit(5),
      this.supabaseService.getClient().from('crop_reference_profiles').select('*').eq('active', true).limit(10),
      this.supabaseService.getClient().from('soil_readings').select('*').eq('device_id', targetDeviceId).order('created_at', { ascending: false }).limit(3),
    ]);

    const switches = switchesRes?.data || null;
    const pumpLogs = pumpLogsRes?.data || [];
    const savedAnalyses = savedAnalysesRes?.data || [];
    const cropProfiles = cropProfilesRes?.data || [];
    const recentReadings = recentReadingsRes?.data || [];

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

    const readingContext = latestReading
      ? `CURRENT LIVE READINGS (${latestReading.time || 'Latest'}):
- Moisture: ${latestReading.moisture}% (Optimal range: 40-70%)
- Temperature: ${latestReading.temperature}°C
- Soil pH: ${latestReading.ph} (Optimal range: 6.0-6.8)
- Soil Conductivity / EC: ${latestReading.soilConductivity ?? latestReading.electricalConductivity ?? 'N/A'} dS/m
- Nitrogen (N): ${latestReading.nitrogen} mg/kg
- Phosphorus (P): ${latestReading.phosphorus} mg/kg
- Potassium (K): ${latestReading.potassium} mg/kg
- TDS: ${latestReading.tds ?? 'N/A'} ppm | Salinity: ${latestReading.salinity ?? 'N/A'}‰
- Sensor Status: ${latestReading.sensorStatus || 'Connected'} | Battery: ${latestReading.batteryStatus || 'N/A'} (${latestReading.batteryVoltage || 'N/A'}V)`
      : `CURRENT LIVE READINGS: No live telemetry currently available for ${targetDeviceId}.`;

    const switchesContext = switches
      ? `SYSTEM SWITCHES & ACTUATORS (Table: 'system_switches', Device: ${targetDeviceId}):
- Main System Switch: ${switches.system_switch ? 'ENABLED 🟢' : 'DISABLED 🔴'}
- Water Pump: ${switches.pump_water ? 'RUNNING 🟢' : 'OFF 🔴'}
- Nitrogen Pump: ${switches.pump_nitrogen ? 'RUNNING 🟢' : 'OFF 🔴'}
- Phosphorus Pump: ${switches.pump_phosphorus ? 'RUNNING 🟢' : 'OFF 🔴'}
- Potassium Pump: ${switches.pump_potassium ? 'RUNNING 🟢' : 'OFF 🔴'}
- Auxiliary Lights: Light 01 [${switches.light_01 ? 'ON' : 'OFF'}], Light 02 [${switches.light_02 ? 'ON' : 'OFF'}]`
      : `SYSTEM SWITCHES: No actuator switch records found for ${targetDeviceId}.`;

    const pumpLogsContext = pumpLogs.length > 0
      ? `RECENT PUMP ACTIVATION LOGS (Table: 'pump_activation_logs', last ${pumpLogs.length} events):
${pumpLogs.map((l: any) => `- Pump: [${l.pump_name?.toUpperCase()}] | Status: ${l.status} | Duration: ${l.duration_seconds ?? 'N/A'}s | Started: ${new Date(l.start_time).toLocaleString()}`).join('\n')}`
      : `RECENT PUMP ACTIVATION LOGS: No recent pump activation logs found.`;

    const analysesContext = savedAnalyses.length > 0
      ? `RECENT SAVED SOIL ANALYSES & ML EVALUATIONS (Table: 'Wireless sensor Soil Analysis data', last ${savedAnalyses.length} records):
${savedAnalyses.map((a: any) => `- Sample "${a.soil_sample_label}" (${new Date(a.saved_at).toLocaleDateString()}) | Crop: ${a.recommended_crop || a.crop_label || 'N/A'} | Score/Confidence: ${a.prediction_confidence ?? 'N/A'}/100 | Status: ${a.label_status} | Rationale: ${a.recommendation_reason || 'N/A'} | pH: ${a.soil_ph}, EC: ${a.soil_conductivity} dS/m, Moisture: ${a.soil_moisture}%`).join('\n')}`
      : `RECENT SAVED SOIL ANALYSES: No saved evaluation records found.`;

    const profilesContext = cropProfiles.length > 0
      ? `AGRONOMIC CROP REFERENCE PROFILES (Table: 'crop_reference_profiles'):
${cropProfiles.map((c: any) => `- ${c.crop_name} (${c.scientific_name}): pH range [${c.ph_opt_min} - ${c.ph_opt_max}], Temp range [${c.temperature_opt_min_c} - ${c.temperature_opt_max_c}°C], PAW Moisture [${c.moisture_paw_min} - ${c.moisture_paw_max}%], Max EC Guidance: ${c.ec_guidance_max_dsm} dS/m | Drainage: ${c.drainage_requirement}`).join('\n')}`
      : `AGRONOMIC CROP REFERENCE PROFILES: No profiles loaded.`;

    const historicalReadingsContext = recentReadings.length > 0
      ? `RECENT RAW SOIL READINGS HISTORY (Table: 'soil_readings', last ${recentReadings.length} packets):
${recentReadings.map((r: any) => `- [${new Date(r.created_at).toLocaleTimeString()}] Moisture: ${r.soil_moisture_percent}%, pH: ${r.soil_ph}, Temp: ${r.soil_temperature_celsius}°C, EC: ${r.ec_levels}, NPK: ${r.nitrogen}/${r.phosphorus}/${r.potassium}, Battery: ${r.battery_voltage}V (${r.battery_status}), WiFi Signal: ${r.receiver_wifi_signal_strength_dbm} dBm (${r.receiver_wifi_signal_quality})`).join('\n')}`
      : `RECENT RAW SOIL READINGS HISTORY: No historical raw readings recorded.`;

    // 3. Build the System Prompt (RAG Context)
    const systemPrompt = `
      You are an expert Agronomy AI Assistant managing the Smart Agriculture Platform.
      You have real-time access to all 5 core system database tables and hardware telemetry for device ID: "${targetDeviceId}".
      You provide concise, professional, accurate, and actionable advice to farmers and system administrators based on the raw telemetry, saved records, pump logs, switch states, and reference profiles provided below.
      
      --- SYSTEM DATABASE RAG CONTEXT ---
      ${readingContext}
      
      ${switchesContext}
      
      ${pumpLogsContext}
      
      ${analysesContext}
      
      ${profilesContext}
      
      ${historicalReadingsContext}
      -----------------------------------
      
      INSTRUCTIONS:
      1. Answer the user's question directly, clearly, and accurately using the real-time system context above.
      2. If asked about saved analyses, soil evaluations, or ML recommendations, refer directly to the 'Wireless sensor Soil Analysis data' records.
      3. If asked about irrigation, pumps, or fertigation, check both the real-time switch states ('system_switches') and historical run logs ('pump_activation_logs').
      4. If asked about crop compatibility or ideal growth conditions, refer to the exact agronomic thresholds in 'crop_reference_profiles'.
      5. If asked about battery voltage, WiFi signal strength, or sensor status, refer to the live readings or historical 'soil_readings'.
      6. Do not hallucinate data. If a specific record is not present in the context above, state clearly what data is available.
      7. Keep responses concise, practical, and formatted cleanly with bullet points or bold text where appropriate.
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

    // 4. Call OpenAI with graceful fallback
    let answer = '';
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.2,
      });
      answer = response.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      this.logger.warn(
        `OpenAI chat completion failed, generating offline RAG response: ${err?.message}`,
      );
      answer = this.generateOfflineChatFallback(query, {
        latestReading,
        switches,
        pumpLogs,
        savedAnalyses,
        cropProfiles,
        recentReadings,
      });
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

  private generateOfflineChatFallback(query: string, context: any): string {
    const q = query.toLowerCase();
    const parts: string[] = [];

    if (q.includes('pump') || q.includes('irrigat') || q.includes('water') || q.includes('switch') || q.includes('light')) {
      parts.push('**Actuator & Switch Status:**');
      if (context.switches) {
        parts.push(`- Main Switch: ${context.switches.system_switch ? 'Enabled 🟢' : 'Disabled 🔴'}`);
        parts.push(`- Water Pump: ${context.switches.pump_water ? 'Running 🟢' : 'Off 🔴'} | N/P/K Pumps: ${context.switches.pump_nitrogen ? 'N:ON' : 'N:OFF'}, ${context.switches.pump_phosphorus ? 'P:ON' : 'P:OFF'}, ${context.switches.pump_potassium ? 'K:ON' : 'K:OFF'}`);
      } else {
        parts.push('- No switch state recorded.');
      }
      if (context.pumpLogs?.length > 0) {
        parts.push('\n**Recent Pump Activity:**');
        context.pumpLogs.forEach((l: any) => {
          parts.push(`- [${l.pump_name?.toUpperCase()}] ran for ${l.duration_seconds ?? 'N/A'}s (${l.status})`);
        });
      }
    }

    if (q.includes('saved') || q.includes('evaluat') || q.includes('analysis') || q.includes('record') || q.includes('score')) {
      parts.push('**Recent Saved Soil Analyses:**');
      if (context.savedAnalyses?.length > 0) {
        context.savedAnalyses.forEach((a: any) => {
          parts.push(`- "${a.soil_sample_label}" (${new Date(a.saved_at).toLocaleDateString()}): Recommended **${a.recommended_crop || 'N/A'}** (Score: ${a.prediction_confidence ?? 'N/A'}/100, Status: ${a.label_status})`);
        });
      } else {
        parts.push('- No saved analysis records found.');
      }
    }

    if (q.includes('crop') || q.includes('profile') || q.includes('ph') || q.includes('temp') || q.includes('ideal') || q.includes('grow')) {
      parts.push('**Crop Reference Profiles:**');
      if (context.cropProfiles?.length > 0) {
        context.cropProfiles.slice(0, 5).forEach((c: any) => {
          parts.push(`- **${c.crop_name}**: Optimal pH ${c.ph_opt_min}-${c.ph_opt_max}, Temp ${c.temperature_opt_min_c}-${c.temperature_opt_max_c}°C, Moisture ${c.moisture_paw_min}-${c.moisture_paw_max}%, Max EC: ${c.ec_guidance_max_dsm} dS/m`);
        });
      } else {
        parts.push('- No reference profiles available.');
      }
    }

    if (parts.length === 0 || q.includes('status') || q.includes('read') || q.includes('sensor') || q.includes('moisture') || q.includes('battery') || q.includes('wifi')) {
      parts.push('**Live Farm Telemetry Summary:**');
      if (context.latestReading) {
        const r = context.latestReading;
        parts.push(`- **Soil Moisture:** ${r.moisture}% | **pH:** ${r.ph} | **Temp:** ${r.temperature}°C`);
        parts.push(`- **Nutrients (NPK):** ${r.nitrogen} / ${r.phosphorus} / ${r.potassium} mg/kg`);
        parts.push(`- **EC:** ${r.soilConductivity ?? r.electricalConductivity ?? 'N/A'} dS/m | **Battery:** ${r.batteryVoltage ?? 'N/A'}V (${r.batteryStatus ?? 'N/A'})`);
      } else {
        parts.push('- No real-time sensor telemetry currently available.');
      }
    }

    return parts.join('\n');
  }

  private clampScore(value: number): number {
    return Math.min(100, Math.max(0, value));
  }

  private calculateCropScore(reading: any, profile: any): number {
    const scores: number[] = [];

    if (reading.moisture != null) {
      scores.push(
        this.clampScore(
          100 - Math.abs(reading.moisture - profile.idealMoisture) * 1.2,
        ),
      );
    }
    if (reading.ph != null) {
      scores.push(
        this.clampScore(100 - Math.abs(reading.ph - profile.idealPh) * 20),
      );
    }
    if (reading.temperature != null) {
      scores.push(
        this.clampScore(
          100 - Math.abs(reading.temperature - profile.idealTemperature) * 2,
        ),
      );
    }
    if (reading.nitrogen != null) {
      scores.push(
        this.clampScore(
          100 - Math.abs(reading.nitrogen - profile.idealNitrogen) * 1.2,
        ),
      );
    }
    if (reading.phosphorus != null) {
      scores.push(
        this.clampScore(
          100 - Math.abs(reading.phosphorus - profile.idealPhosphorus) * 2,
        ),
      );
    }
    if (reading.potassium != null) {
      scores.push(
        this.clampScore(
          100 - Math.abs(reading.potassium - profile.idealPotassium) * 1.4,
        ),
      );
    }

    if (scores.length === 0) {
      return 0;
    }

    return Math.round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length,
    );
  }

  private buildCropPrompt(reading: any): string {
    const lines = [
      `- Moisture: ${reading.moisture ?? 'unknown'}%`,
      `- pH: ${reading.ph ?? 'unknown'}`,
      `- Temperature: ${reading.temperature ?? 'unknown'}°C`,
      `- Nitrogen (N): ${reading.nitrogen ?? 'unknown'} ppm`,
      `- Phosphorus (P): ${reading.phosphorus ?? 'unknown'} ppm`,
      `- Potassium (K): ${reading.potassium ?? 'unknown'} ppm`,
      `- Soil Conductivity: ${reading.soilConductivity ?? reading.electricalConductivity ?? 'unknown'} dS/m`,
      `- TDS: ${reading.tds ?? 'unknown'} ppm`,
      `- Salinity: ${reading.salinity ?? 'unknown'}‰`,
    ];

    const profileLines = this.cropProfiles
      .map(
        (profile) =>
          `- ${profile.name}: moisture ${profile.idealMoisture}%, pH ${profile.idealPh}, temperature ${profile.idealTemperature}°C, nitrogen ${profile.idealNitrogen} ppm, phosphorus ${profile.idealPhosphorus} ppm, potassium ${profile.idealPotassium} ppm.`,
      )
      .join('\n');

    return `You are an expert agronomist. Based on the live soil sensor readings and the crop profiles below, analyze all relevant soil factors including moisture, pH, temperature, nitrogen, phosphorus, potassium, conductivity, TDS, and salinity. Select the best crop match for this field, rank up to two strong alternatives, and provide soil preparation guidance to follow before planting the chosen crop.
Respond ONLY with valid JSON using this exact structure:
{
  "recommendedCrop": {"crop": string, "score": number, "description": string},
  "alternatives": [{"crop": string, "score": number, "description": string}],
  "summary": string,
  "prePlantRecommendations": [string]
}

Live sensor reading:
${lines.join('\n')}

Crop profiles:
${profileLines}

Do not add any extra commentary or fields.`;
  }

  private buildPrePlantRecommendations(reading: any, profile: any): string[] {
    const recommendations: string[] = [];

    if (reading.moisture != null) {
      const diff = reading.moisture - profile.idealMoisture;
      if (Math.abs(diff) > 5) {
        recommendations.push(
          diff > 0
            ? `Reduce soil moisture toward ${profile.idealMoisture}% before planting ${profile.name}.`
            : `Increase soil moisture toward ${profile.idealMoisture}% before planting ${profile.name}.`,
        );
      } else {
        recommendations.push(
          `Keep soil moisture near ${profile.idealMoisture}% before planting.`,
        );
      }
    }

    if (reading.ph != null) {
      const diff = reading.ph - profile.idealPh;
      if (Math.abs(diff) > 0.3) {
        recommendations.push(
          diff > 0
            ? `Lower soil pH toward ${profile.idealPh} before planting ${profile.name}.`
            : `Raise soil pH toward ${profile.idealPh} before planting ${profile.name}.`,
        );
      } else {
        recommendations.push(`Keep soil pH around ${profile.idealPh}.`);
      }
    }

    if (reading.nitrogen != null) {
      const diff = reading.nitrogen - profile.idealNitrogen;
      if (Math.abs(diff) > 10) {
        recommendations.push(
          diff > 0
            ? `Adjust nitrogen levels down if too high before planting ${profile.name}.`
            : `Add nitrogen-rich amendments to reach around ${profile.idealNitrogen} ppm.`,
        );
      } else {
        recommendations.push(
          `Maintain nitrogen near ${profile.idealNitrogen} ppm.`,
        );
      }
    }

    if (reading.phosphorus != null) {
      const diff = reading.phosphorus - profile.idealPhosphorus;
      if (Math.abs(diff) > 10) {
        recommendations.push(
          diff > 0
            ? `Lower phosphorus input before planting ${profile.name}.`
            : `Add phosphorus fertilizer if needed before planting ${profile.name}.`,
        );
      } else {
        recommendations.push(
          `Keep phosphorus near ${profile.idealPhosphorus} ppm.`,
        );
      }
    }

    if (reading.potassium != null) {
      const diff = reading.potassium - profile.idealPotassium;
      if (Math.abs(diff) > 10) {
        recommendations.push(
          diff > 0
            ? `Reduce potassium amendments if current levels are high.`
            : `Apply potassium-rich fertilizer if levels are low.`,
        );
      } else {
        recommendations.push(
          `Keep potassium near ${profile.idealPotassium} ppm.`,
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push(
        `Review soil moisture, pH, and nutrient balance before planting ${profile.name}.`,
      );
    }

    return recommendations;
  }

  private buildEvaluateCropPrompt(reading: any, cropName: string): string {
    const lines = [
      `- Moisture: ${reading.moisture ?? 'unknown'}%`,
      `- pH: ${reading.ph ?? 'unknown'}`,
      `- Temperature: ${reading.temperature ?? 'unknown'}°C`,
      `- Nitrogen (N): ${reading.nitrogen ?? 'unknown'} ppm`,
      `- Phosphorus (P): ${reading.phosphorus ?? 'unknown'} ppm`,
      `- Potassium (K): ${reading.potassium ?? 'unknown'} ppm`,
      `- Soil Conductivity: ${reading.soilConductivity ?? reading.electricalConductivity ?? 'unknown'} dS/m`,
      `- TDS: ${reading.tds ?? 'unknown'} ppm`,
      `- Salinity: ${reading.salinity ?? 'unknown'}‰`,
    ];

    return `You are an expert agronomist. Based on the live soil sensor readings below, determine whether the user can plant ${cropName} now. Analyze all relevant soil factors including moisture, pH, temperature, nitrogen, phosphorus, potassium, conductivity, TDS, and salinity. If planting is not recommended, provide the soil adjustments required before planting. Respond ONLY with valid JSON using this exact structure:\n{\n  "cropName": string,\n  "canPlantNow": boolean,\n  "recommendation": string,\n  "reasons": [string],\n  "actions": [string]\n}\n\nLive sensor readings:\n${lines.join('\n')}\nDo not add extra commentary or fields.`;
  }

  private buildEvaluateCropFallback(reading: any, cropName: string) {
    const normalizedName = cropName.trim().toLowerCase();
    const profile = this.cropProfiles.find(
      (profile) => profile.name.toLowerCase() === normalizedName,
    );
    const reasons: string[] = [];
    const actions: string[] = [];
    let canPlantNow = false;

    if (profile) {
      const score = this.calculateCropScore(reading, profile);
      canPlantNow = score >= 70;

      if (reading.moisture != null) {
        const diff = reading.moisture - profile.idealMoisture;
        reasons.push(
          `Moisture is ${reading.moisture.toFixed(0)}%, ideal for ${profile.name} is ${profile.idealMoisture}%.`,
        );
        actions.push(
          diff > 5
            ? `Reduce soil moisture to about ${profile.idealMoisture}% before planting ${profile.name}.`
            : diff < -5
              ? `Increase moisture to about ${profile.idealMoisture}% before planting ${profile.name}.`
              : `Maintain moisture near ${profile.idealMoisture}%.`,
        );
      }
      if (reading.ph != null) {
        const diff = reading.ph - profile.idealPh;
        reasons.push(
          `pH is ${reading.ph.toFixed(1)}, ideal for ${profile.name} is ${profile.idealPh}.`,
        );
        actions.push(
          diff > 0.3
            ? `Lower pH toward ${profile.idealPh} before planting ${profile.name}.`
            : diff < -0.3
              ? `Raise pH toward ${profile.idealPh} before planting ${profile.name}.`
              : `Keep pH around ${profile.idealPh}.`,
        );
      }
      if (reading.nitrogen != null) {
        const diff = reading.nitrogen - profile.idealNitrogen;
        actions.push(
          diff < -10
            ? `Add nitrogen-rich amendment to reach around ${profile.idealNitrogen} ppm.`
            : diff > 10
              ? `Reduce nitrogen input before planting ${profile.name}.`
              : `Keep nitrogen near ${profile.idealNitrogen} ppm.`,
        );
      }
      if (reading.phosphorus != null) {
        const diff = reading.phosphorus - profile.idealPhosphorus;
        actions.push(
          diff < -10
            ? `Apply phosphorus fertilizer to reach about ${profile.idealPhosphorus} ppm.`
            : diff > 10
              ? `Reduce phosphorus application before planting ${profile.name}.`
              : `Keep phosphorus near ${profile.idealPhosphorus} ppm.`,
        );
      }
      if (reading.potassium != null) {
        const diff = reading.potassium - profile.idealPotassium;
        actions.push(
          diff < -10
            ? `Apply potassium-rich fertilizer to reach about ${profile.idealPotassium} ppm.`
            : diff > 10
              ? `Reduce potassium amendments before planting ${profile.name}.`
              : `Keep potassium near ${profile.idealPotassium} ppm.`,
        );
      }

      return {
        cropName: profile.name,
        canPlantNow,
        recommendation: canPlantNow
          ? `Current soil conditions are reasonably aligned for planting ${profile.name}.`
          : `Current soil conditions are not ideal for planting ${profile.name} yet.`,
        reasons,
        actions,
      };
    }

    return {
      cropName,
      canPlantNow: false,
      recommendation: `No specific profile exists for ${cropName}. Review soil conditions and adjust moisture, pH, and nutrients before planting.`,
      reasons: [
        `The crop name could not be matched to a known profile.`,
        `General soil health factors still determine whether planting is safe.`,
      ],
      actions: [
        `Verify soil moisture and keep it within 40-70%.`,
        `Adjust pH toward neutral (around 6.0-6.5).`,
        `Balance nitrogen, phosphorus, and potassium before planting.`,
      ],
    };
  }

  async evaluateCrop(deviceId: string, cropName: string) {
    const reading = await this.telemetryService.getLatestReading(deviceId);

    if (!reading) {
      return { error: 'No sensor readings found for this device.' };
    }

    const prompt = this.buildEvaluateCropPrompt(reading, cropName);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a concise agronomist helping farmers decide whether to plant a specific crop based on soil sensor data.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (
          parsed?.cropName &&
          typeof parsed?.canPlantNow === 'boolean' &&
          Array.isArray(parsed?.actions)
        ) {
          return parsed;
        }
      }
    } catch (error) {
      this.logger.warn(
        `AI crop evaluation failed, using fallback analysis: ${error?.message ?? error}`,
      );
    }

    return this.buildEvaluateCropFallback(reading, cropName);
  }

  async suggestCrop(deviceId: string) {
    const reading = await this.telemetryService.getLatestReading(deviceId);

    if (!reading) {
      return { error: 'No sensor readings found for this device.' };
    }

    const prompt = this.buildCropPrompt(reading);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a concise agronomist helping farmers choose the best crop based on soil data.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (
          parsed?.recommendedCrop &&
          Array.isArray(parsed?.alternatives) &&
          Array.isArray(parsed?.prePlantRecommendations)
        ) {
          return parsed;
        }
      }
    } catch (error) {
      this.logger.warn(
        `AI crop suggestion failed, falling back to heuristic scoring: ${error?.message ?? error}`,
      );
    }

    const rankedCrops = this.cropProfiles
      .map((profile) => {
        const score = this.calculateCropScore(reading, profile);
        const reasons: string[] = [];

        if (reading.moisture != null) {
          reasons.push(
            `Moisture ${reading.moisture.toFixed(0)}% aligns with ${profile.name.toLowerCase()} growing needs.`,
          );
        }
        if (reading.ph != null) {
          reasons.push(
            `Soil pH ${reading.ph.toFixed(1)} is compatible with ${profile.name.toLowerCase()} cultivation.`,
          );
        }

        return {
          crop: profile.name,
          score,
          reasons,
          description: profile.description,
        };
      })
      .sort((a, b) => b.score - a.score);

    const [recommendedCrop, ...alternatives] = rankedCrops;
    const selectedProfile = this.cropProfiles.find(
      (profile) => profile.name === recommendedCrop.crop,
    );

    return {
      recommendedCrop,
      alternatives: alternatives.slice(0, 2),
      summary: `Based on the latest readings, ${recommendedCrop.crop} is the strongest match for this field.`,
      prePlantRecommendations: selectedProfile
        ? this.buildPrePlantRecommendations(reading, selectedProfile)
        : [],
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

  async predictRain(deviceId: string, lat: number, lon: number) {
    // 1. Fetch Local Telemetry History
    const history = await this.telemetryService.getEnvironmentHistory(deviceId);
    
    // We only need the latest few readings to see trends (e.g. last 3 readings)
    const recentHistory = history.slice(0, 3).map(r => ({
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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability,precipitation`;
      const response = await fetch(url);
      if (response.ok) {
        forecastData = await response.json();
      }
    } catch (error: any) {
      this.logger.error(`Failed to fetch Open-Meteo data: ${error.message}`);
    }

    // Extract next 5 hours of precipitation data
    let regionalPrecip = "Unknown";
    if (forecastData && forecastData.hourly) {
       const currentIndex = forecastData.hourly.time.findIndex((t: string) => new Date(t) >= new Date());
       if (currentIndex !== -1) {
          const next5HoursPop = forecastData.hourly.precipitation_probability.slice(currentIndex, currentIndex + 5);
          const next5HoursRain = forecastData.hourly.precipitation.slice(currentIndex, currentIndex + 5);
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
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message?.content || '{}');
      
      // Update Supabase Database with the new prediction
      if (typeof result.will_rain === 'boolean') {
        const { data: updateData, error: updateError } = await this.supabaseService.getClient()
          .from('rain_predictions')
          .update({
            will_rain: result.will_rain,
            updated_at: new Date().toISOString()
          })
          .eq('device_id', deviceId)
          .select();
          
        if (updateError) {
          this.logger.error(`Failed to update rain_predictions table: ${updateError.message}`);
        } else if (!updateData || updateData.length === 0) {
          // Row doesn't exist, insert it
          const { error: insertError } = await this.supabaseService.getClient()
            .from('rain_predictions')
            .insert({
              device_id: deviceId,
              will_rain: result.will_rain,
              updated_at: new Date().toISOString()
            });
            
          if (insertError) {
            this.logger.error(`Failed to insert into rain_predictions table: ${insertError.message}`);
          }
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error(`AI Rain Prediction failed: ${error.message}`);
      return {
        prediction: "Unable to generate prediction at this time.",
        confidence: 0,
        reasoning: "AI synthesis failed or timed out."
      };
    }
  }

  async toggleRainPrediction(deviceId: string, enabled: boolean) {
    this.logger.log(`Toggling rain prediction for ${deviceId} to ${enabled}`);
    if (!enabled) {
      // If turned off, immediately set will_rain to false
      const { data, error: updateError } = await this.supabaseService.getClient()
        .from('rain_predictions')
        .update({
          will_rain: false,
          updated_at: new Date().toISOString()
        })
        .eq('device_id', deviceId)
        .select();
        
      if (updateError) {
        this.logger.error(`Failed to force disable rain_prediction (update): ${updateError.message}`);
      } else if (!data || data.length === 0) {
        // Row doesn't exist, insert it
        const { error: insertError } = await this.supabaseService.getClient()
          .from('rain_predictions')
          .insert({
            device_id: deviceId,
            will_rain: false,
            updated_at: new Date().toISOString()
          });
          
        if (insertError) {
          this.logger.error(`Failed to force disable rain_prediction (insert): ${insertError.message}`);
        }
      }
    }
    return { success: true, enabled };
  }

  async getRainPredictionStatus(deviceId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('rain_predictions')
      .select('will_rain')
      .eq('device_id', deviceId)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Error fetching prediction status for ${deviceId}: ${error.message}`);
    }
    
    return { will_rain: data?.will_rain ?? false };
  }
}


