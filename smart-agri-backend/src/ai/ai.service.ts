import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { TelemetryService } from '../telemetry/telemetry.service';
import { Field } from '../farms/entities/field.entity';

@Injectable()
export class AiService {
    private openai: OpenAI;

    constructor(
        private configService: ConfigService,
        private telemetryService: TelemetryService,
        @InjectRepository(Field)
        private fieldRepo: Repository<Field>,
    ) {
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    async askAgronomist(query: string, deviceId: string) {
        // 1. Fetch Context (Current state of the farm)
        const latestReading = await this.telemetryService.getLatestReading(deviceId);

        if (!latestReading) {
            return { answer: "I'm sorry, but I cannot access the sensor data for this field right now. Please ensure the sensor node is online and transmitting." };
        }

        // 2. Build the System Prompt
        const systemPrompt = `
      You are an expert Agronomy AI Assistant managing a Smart Agriculture Platform.
      You provide concise, professional, and actionable advice to farmers.
      
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
      Keep responses under 4 sentences unless specifically asked for a detailed report.
    `;

        // 3. Call OpenAI
        const response = await this.openai.chat.completions.create({
            model: 'gpt-3.5-turbo', // You can use gpt-4o if you have access
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query },
            ],
            temperature: 0.2, // Low temperature for factual, analytical responses
        });

        return {
            answer: response.choices[0].message.content,
        };
    }

    async generateFieldInsight(fieldId: string) {
        // 1. Fetch Field + Crop Profile (no longer need to load devices here)
        const field = await this.fieldRepo.findOne({
            where: { id: fieldId },
            relations: { cropProfile: true },
        });

        if (!field || !field.cropProfile) {
            return { error: "Field or Crop Profile not found." };
        }

        // 2. Get the latest reading via the TelemetryService helper.
        //    This resolves the correct FIXED NODE at the DB level, avoiding
        //    the previous bug where in-memory device array walk could fail.
        const reading = await this.telemetryService.getLatestReadingByField(fieldId);
        if (!reading) return { error: 'No sensor readings found for this field.' };

        // 3. Force OpenAI to return structured JSON
        const systemPrompt = `
      You are an expert AI Agronomist monitoring a field of ${field.cropProfile.name}.
      
      IDEAL CONDITIONS FOR ${field.cropProfile.name.toUpperCase()}:
      - Min Moisture: ${field.cropProfile.minMoisturePercent}%
      - Min Nitrogen: ${field.cropProfile.minNitrogen} ppm
      - Min Phosphorus: ${field.cropProfile.minPhosphorus} ppm
      - Min Potassium: ${field.cropProfile.minPotassium} ppm
      - Ideal pH: ${field.cropProfile.idealPhLevel}
      
      CURRENT LIVE READINGS:
      - Moisture: ${reading.moisture}%
      - Nitrogen: ${reading.nitrogen} ppm
      - Phosphorus: ${reading.phosphorus} ppm
      - Potassium: ${reading.potassium} ppm
      - pH: ${reading.ph}

      Analyze the current readings against the ideal conditions. 
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
            response_format: { type: "json_object" } // This guarantees perfect JSON output
        });

        // Parse the JSON string from OpenAI into a real Javascript object
        const content = response.choices[0].message.content;
        if (!content) return { error: 'AI returned an empty response.' };
        return JSON.parse(content);
    }
}