import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { AiService } from '../ai/ai.service';
import { AlertsService } from '../alerts/alerts.service';

const WEATHER_DEVICE_ID = 'esp32_weather_01';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private rainPredictionInFlight = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly telemetryService: TelemetryService,
    private readonly aiService: AiService,
    private readonly alertsService: AlertsService,
  ) {}

  @Interval(10000)
  async handleAutoIrrigation() {
    const deviceId = WEATHER_DEVICE_ID; // Default target device

    try {
      // 1. Get latest moisture
      const { data: latestReading, error: moistureError } =
        await this.supabaseService
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
      // The isPumpOn checks below also naturally debounce the alerts: once a
      // transition fires, the next 10s tick reads the new state back from
      // Supabase and the same branch no longer matches, so this can't spam.
      if (moisture < 20 && !willRain && !isPumpOn) {
        this.logger.log(
          `[Auto-Irrigation] Moisture is ${moisture}% and no rain expected. Turning pump ON.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_water',
          true,
        );
        await this.alertsService.create(
          deviceId,
          'WARNING',
          `Soil moisture dropped to ${moisture.toFixed(0)}% with no rain expected. Auto-irrigation started.`,
        );
      } else if (moisture >= 50 && isPumpOn) {
        this.logger.log(
          `[Auto-Irrigation] Target moisture reached (${moisture}%). Turning pump OFF.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_water',
          false,
        );
        await this.alertsService.create(
          deviceId,
          'INFO',
          `Target soil moisture reached (${moisture.toFixed(0)}%). Auto-irrigation stopped.`,
        );
      }
    } catch (e: any) {
      this.logger.error(`Auto-Irrigation failed: ${e.message}`);
    }
  }

  // Keeps rain_predictions.will_rain fresh autonomously. Previously this only
  // updated when a user happened to have the Local Weather page open (a
  // 5-minute client-side poll), so the auto-irrigation logic above could act
  // on stale rain data indefinitely if nobody was looking at the dashboard.
  @Interval(15 * 60 * 1000)
  async handleAutonomousRainPrediction() {
    if (this.rainPredictionInFlight) return;
    this.rainPredictionInFlight = true;

    const deviceId = WEATHER_DEVICE_ID;
    try {
      const status = await this.aiService.getRainPredictionStatus(deviceId);
      if (!status.prediction_enabled) return;

      await this.aiService.predictRain(deviceId);
      this.logger.log(
        `[Rain Prediction] Refreshed autonomous forecast for ${deviceId}.`,
      );
    } catch (e: any) {
      this.logger.error(`Autonomous rain prediction failed: ${e.message}`);
    } finally {
      this.rainPredictionInFlight = false;
    }
  }
}
