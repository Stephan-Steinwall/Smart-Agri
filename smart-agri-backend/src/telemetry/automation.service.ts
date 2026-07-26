import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { TelemetryService } from './telemetry.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly telemetryService: TelemetryService
  ) {}

  @Interval(10000)
  async handleAutoIrrigation() {
    const deviceId = 'esp32_weather_01'; // Default target device

    try {
      // 1. Get latest moisture
      const { data: latestReading, error: moistureError } = await this.supabaseService
        .getClient()
        .from('soil_sensor_readings')
        .select('soil_moisture_percent')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (moistureError || !latestReading) return;
      const moisture = latestReading.soil_moisture_percent;

      // 2. Get rain prediction
      const { data: rainData } = await this.supabaseService
        .getClient()
        .from('rain_predictions')
        .select('will_rain')
        .eq('device_id', deviceId)
        .single();

      const willRain = rainData?.will_rain ?? false;

      // 3. Get pump status
      const { data: pumpData } = await this.supabaseService
        .getClient()
        .from('system_switches')
        .select('pump_water')
        .eq('device_id', deviceId)
        .single();

      const isPumpOn = pumpData?.pump_water ?? false;

      // 4. Automation logic
      if (moisture < 20 && !willRain && !isPumpOn) {
        this.logger.log(`[Auto-Irrigation] Moisture is ${moisture}% and no rain expected. Turning pump ON.`);
        await this.telemetryService.toggleSystemSwitch(deviceId, 'pump_water', true);
      } else if (moisture >= 50 && isPumpOn) {
        this.logger.log(`[Auto-Irrigation] Target moisture reached (${moisture}%). Turning pump OFF.`);
        await this.telemetryService.toggleSystemSwitch(deviceId, 'pump_water', false);
      }

    } catch (e: any) {
      this.logger.error(`Auto-Irrigation failed: ${e.message}`);
    }
  }
}
