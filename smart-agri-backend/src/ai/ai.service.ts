import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TelemetryService } from '../telemetry/telemetry.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AiService {
    private openai: OpenAI;
    private readonly logger = new Logger(AiService.name);

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
        const latestReading = await this.telemetryService.getLatestReading(deviceId);

        if (!latestReading) {
            return { answer: "I'm sorry, but I cannot access the sensor data for this device right now. Please ensure the sensor node is online and transmitting." };
        }

        // 2. Fetch Chat History from Supabase
        const { data: chatHistory, error: historyError } = await this.supabaseService.getClient()
            .from('ai_chat_history')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (historyError) {
            this.logger.error(`Failed to fetch chat history: ${historyError.message}`);
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
            const { error: insertError } = await this.supabaseService.getClient()
                .from('ai_chat_history')
                .insert([
                    { session_id: sessionId, role: 'user', content: query },
                    { session_id: sessionId, role: 'assistant', content: answer }
                ]);

            if (insertError) {
                this.logger.error(`Failed to save chat history: ${insertError.message}`);
            }
        }

        return { answer };
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
            response_format: { type: "json_object" } 
        });

        const content = response.choices[0].message.content;
        if (!content) return { error: 'AI returned an empty response.' };
        
        try {
            return JSON.parse(content);
        } catch (e) {
            return { error: 'Failed to parse AI response.' };
        }
    }
}