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
      // 1. Get latest readings
      const { data: readingData, error: readingsError } =
        await this.supabaseService
          .getClient()
          .from('soil_sensor_readings')
          .select('*')
          .eq('device_id', deviceId)
          .order('created_at', { ascending: false })
          .limit(1);

      if (readingsError || !readingData || readingData.length === 0) return;
      const latestReading = readingData[0];

      const moisture = latestReading.soil_moisture_percent ?? latestReading.moisture ?? latestReading.soil_moisture ?? 0;
      const nitrogen = latestReading.nitrogen ?? 0;
      const phosphorus = latestReading.phosphorus ?? 0;
      const potassium = latestReading.potassium ?? 0;

      // 2. Get rain prediction
      const { data: rainData } = await this.supabaseService
        .getClient()
        .from('rain_predictions')
        .select('will_rain')
        .eq('device_id', deviceId)
        .single();

      const willRain = rainData?.will_rain ?? false;

      // 3. Get system switches and thresholds
      const settings = await this.telemetryService.getSystemSwitches(deviceId);
      if (!settings.system_switch) {
        // Master system switch is OFF, do not automatically turn pumps on.
        return;
      }

      if (!settings.ai_automation_enabled) {
        // AI automation is explicitly disabled, skip pump logic
        return;
      }

      // If the rain-blocking condition is no longer active, reset the buzzer mute flag
      if (!(moisture < settings.moisture_threshold_low && willRain && !settings.pump_water)) {
        this.telemetryService.resetBuzzerMute(deviceId);
      }

      // 4. Automation logic - Water
      if (
        moisture < settings.moisture_threshold_low &&
        !willRain &&
        !settings.pump_water
      ) {
        this.logger.log(
          `[Auto-Control] Moisture ${moisture}% < ${settings.moisture_threshold_low}%. Turning WATER pump ON.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_water',
          true,
        );
        await this.alertsService.create(
          deviceId,
          'WARNING',
          `Soil moisture dropped to ${moisture.toFixed(0)}%. Auto-irrigation started.`,
        );
      } else if (
        moisture < settings.moisture_threshold_low &&
        willRain &&
        !settings.pump_water
      ) {
        // Rain prediction is blocking irrigation!
        // Activate buzzer for 15 seconds if it hasn't been muted by the user AND the feature is enabled
        if (settings.rain_buzzer_enabled && !settings.buzzer_active && !this.telemetryService.isBuzzerMuted(deviceId)) {
          this.logger.log(`[Auto-Control] Irrigation blocked by rain prediction. Activating buzzer for 15s.`);
          await this.telemetryService.toggleSystemSwitch(
            deviceId,
            'buzzer_active',
            true,
          );
          
          // Turn off buzzer after 15 seconds
          setTimeout(async () => {
            await this.telemetryService.toggleSystemSwitch(
              deviceId,
              'buzzer_active',
              false,
            );
            this.logger.log(`[Auto-Control] Buzzer deactivated after 15s.`);
          }, 15000);
        }
      } else if (
        moisture >= settings.moisture_threshold_high &&
        settings.pump_water
      ) {
        // If the rain condition clears or moisture goes high, reset the mute flag!
        this.telemetryService.resetBuzzerMute(deviceId);

        this.logger.log(
          `[Auto-Control] Moisture ${moisture}% >= ${settings.moisture_threshold_high}%. Turning WATER pump OFF.`,
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

      // Automation logic - Nitrogen
      if (
        nitrogen < settings.nitrogen_threshold_low &&
        !settings.pump_nitrogen
      ) {
        this.logger.log(
          `[Auto-Control] Nitrogen ${nitrogen} < ${settings.nitrogen_threshold_low}. Turning NITROGEN pump ON.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_nitrogen',
          true,
        );
        await this.alertsService.create(
          deviceId,
          'WARNING',
          `Nitrogen dropped to ${nitrogen}. Auto-dosing started.`,
        );
      } else if (
        nitrogen >= settings.nitrogen_threshold_high &&
        settings.pump_nitrogen
      ) {
        this.logger.log(
          `[Auto-Control] Nitrogen ${nitrogen} >= ${settings.nitrogen_threshold_high}. Turning NITROGEN pump OFF.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_nitrogen',
          false,
        );
        await this.alertsService.create(
          deviceId,
          'INFO',
          `Target Nitrogen reached (${nitrogen}). Auto-dosing stopped.`,
        );
      }

      // Automation logic - Phosphorus
      if (
        phosphorus < settings.phosphorus_threshold_low &&
        !settings.pump_phosphorus
      ) {
        this.logger.log(
          `[Auto-Control] Phosphorus ${phosphorus} < ${settings.phosphorus_threshold_low}. Turning PHOSPHORUS pump ON.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_phosphorus',
          true,
        );
        await this.alertsService.create(
          deviceId,
          'WARNING',
          `Phosphorus dropped to ${phosphorus}. Auto-dosing started.`,
        );
      } else if (
        phosphorus >= settings.phosphorus_threshold_high &&
        settings.pump_phosphorus
      ) {
        this.logger.log(
          `[Auto-Control] Phosphorus ${phosphorus} >= ${settings.phosphorus_threshold_high}. Turning PHOSPHORUS pump OFF.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_phosphorus',
          false,
        );
        await this.alertsService.create(
          deviceId,
          'INFO',
          `Target Phosphorus reached (${phosphorus}). Auto-dosing stopped.`,
        );
      }

      // Automation logic - Potassium
      if (
        potassium < settings.potassium_threshold_low &&
        !settings.pump_potassium
      ) {
        this.logger.log(
          `[Auto-Control] Potassium ${potassium} < ${settings.potassium_threshold_low}. Turning POTASSIUM pump ON.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_potassium',
          true,
        );
        await this.alertsService.create(
          deviceId,
          'WARNING',
          `Potassium dropped to ${potassium}. Auto-dosing started.`,
        );
      } else if (
        potassium >= settings.potassium_threshold_high &&
        settings.pump_potassium
      ) {
        this.logger.log(
          `[Auto-Control] Potassium ${potassium} >= ${settings.potassium_threshold_high}. Turning POTASSIUM pump OFF.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_potassium',
          false,
        );
        await this.alertsService.create(
          deviceId,
          'INFO',
          `Target Potassium reached (${potassium}). Auto-dosing stopped.`,
        );
      }
    } catch (e: any) {
      this.logger.error(`Auto-Control failed: ${e.message}`);
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

  @Interval(30000)
  async handleAutoGrowLight() {
    const deviceId = WEATHER_DEVICE_ID;

    try {
      // 1. Get system switches to check if feature is enabled
      const settings = await this.telemetryService.getSystemSwitches(deviceId);

      if (!settings.system_switch) {
        // Master system switch is OFF
        return;
      }

      if (!settings.auto_grow_light_enabled) {
        // Feature is explicitly disabled
        return;
      }

      // 2. Get latest weather reading
      const { data: latestWeather, error: weatherError } =
        await this.supabaseService
          .getClient()
          .from('environment_sensor_readings')
          .select('light_condition, light_intensity_lux')
          .eq('device_id', deviceId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();

      if (
        weatherError ||
        !latestWeather ||
        latestWeather.light_intensity_lux === null ||
        latestWeather.light_intensity_lux === undefined
      ) {
        return;
      }

      const currentLux = latestWeather.light_intensity_lux;
      const thresholdLux = settings.light_intensity_threshold_lux;
      this.logger.log(
        `[Auto-Light Debug] Checking. currentLux: ${currentLux}, thresholdLux: ${thresholdLux}, light_01: ${settings.light_01}`,
      );
      const isDim = currentLux < thresholdLux;

      // 3. Automation logic
      if (isDim && !settings.light_01) {
        this.logger.log(
          `[Auto-Light] Light intensity ${currentLux} lux < ${thresholdLux} lux. Turning Light 1 ON.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'light_01',
          true,
        );
        await this.alertsService.create(
          deviceId,
          'INFO',
          `Light intensity dropped to ${currentLux} lux. Auto grow light activated.`,
        );
      } else if (!isDim && settings.light_01) {
        this.logger.log(
          `[Auto-Light] Light intensity ${currentLux} lux >= ${thresholdLux} lux. Turning Light 1 OFF.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'light_01',
          false,
        );
        await this.alertsService.create(
          deviceId,
          'INFO',
          `Light intensity sufficient (${currentLux} lux). Auto grow light deactivated.`,
        );
      }
    } catch (e: any) {
      this.logger.error(`Auto-Light Control failed: ${e.message}`);
    }
  }

  @Interval(30000)
  async handleAutoMister() {
    const deviceId = WEATHER_DEVICE_ID;

    try {
      // 1. Get system switches to check if feature is enabled
      const settings = await this.telemetryService.getSystemSwitches(deviceId);

      if (!settings.system_switch) {
        return;
      }

      if (!settings.auto_mister_enabled) {
        return;
      }

      // 2. Get latest weather reading
      const { data: latestWeather, error: weatherError } =
        await this.supabaseService
          .getClient()
          .from('environment_sensor_readings')
          .select('humidity_percent')
          .eq('device_id', deviceId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();

      if (
        weatherError ||
        !latestWeather ||
        latestWeather.humidity_percent === null ||
        latestWeather.humidity_percent === undefined
      ) {
        return;
      }

      const currentHumidity = latestWeather.humidity_percent;
      const thresholdHumidity = settings.humidity_threshold_percent;
      this.logger.log(
        `[Auto-Mister Debug] Checking. currentHumidity: ${currentHumidity}, threshold: ${thresholdHumidity}, pump_mister: ${settings.pump_mister}`,
      );
      const isDry = currentHumidity < thresholdHumidity;

      // 3. Automation logic
      if (isDry && !settings.pump_mister) {
        this.logger.log(
          `[Auto-Mister] Humidity ${currentHumidity}% < ${thresholdHumidity}%. Turning Mister ON.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_mister',
          true,
        );
        await this.alertsService.create(
          deviceId,
          'INFO',
          `Humidity dropped to ${currentHumidity}%. Auto mister activated.`,
        );
      } else if (!isDry && settings.pump_mister) {
        this.logger.log(
          `[Auto-Mister] Humidity ${currentHumidity}% >= ${thresholdHumidity}%. Turning Mister OFF.`,
        );
        await this.telemetryService.toggleSystemSwitch(
          deviceId,
          'pump_mister',
          false,
        );
        await this.alertsService.create(
          deviceId,
          'INFO',
          `Humidity sufficient (${currentHumidity}%). Auto mister deactivated.`,
        );
      }
    } catch (e: any) {
      this.logger.error(`Auto-Mister Control failed: ${e.message}`);
    }
  }
}
