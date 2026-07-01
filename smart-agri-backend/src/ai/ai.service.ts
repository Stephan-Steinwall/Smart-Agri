import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TelemetryService } from '../telemetry/telemetry.service';

@Injectable()
export class AiService {
    private openai: OpenAI;

    constructor(
        private configService: ConfigService,
        private telemetryService: TelemetryService,
    ) {
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    async askAgronomist(query: string, deviceId: string) {
        // 1. Fetch Context (Current state of the farm)
        const latestReading = await this.telemetryService.getLatestReading(deviceId);

        if (!latestReading) {
            return "I'm sorry, but I cannot access the sensor data for this field right now.";
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
}