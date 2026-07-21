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
      
      CURRENT SENSOR DATA CONTEXT:
      - Time of reading: ${latestReading.time}
      - Soil Moisture: ${latestReading.moisture}% (Optimal range: 40-70%)
      - Temperature: ${latestReading.temperature}°C
      - Nitrogen (N): ${latestReading.nitrogen} ppm
      - Phosphorus (P): ${latestReading.phosphorus} ppm
      - Potassium (K): ${latestReading.potassium} ppm
      - pH Level: ${latestReading.ph}
      
      INSTRUCTIONS:
      Answer the user's question directly based on the data above. Do not hallucinate data. 
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

    // 4. Call OpenAI
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: 0.2, // Low temperature for factual, analytical responses
    });

    const answer = response.choices[0].message.content;

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
}
