import { Injectable, Logger } from '@nestjs/common';
import { SensorReading } from './entities/sensor-reading.entity';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private clampScore(value: number): number {
    return Math.min(100, Math.max(0, value));
  }

  private calculateSoilHealthScore(row: any): number | null {
    const dbScore =
      row?.soil_health_score ??
      row?.health_score ??
      row?.soilHealthScore ??
      row?.healthScore;
    if (dbScore != null && !Number.isNaN(Number(dbScore))) {
      return Math.round(Number(dbScore));
    }

    const moisture = row?.soil_moisture_percent ?? row?.moisture ?? null;
    const temperature =
      row?.soil_temperature_celsius ?? row?.temperature ?? null;
    const ph = row?.soil_ph ?? row?.ph ?? null;
    const nitrogen = row?.nitrogen ?? null;
    const phosphorus = row?.phosphorus ?? null;
    const potassium = row?.potassium ?? null;
    const electricalConductivity =
      row?.ec_levels ??
      row?.electricalConductivity ??
      row?.soil_conductivity ??
      null;

    const scores: number[] = [];

    if (moisture != null) {
      scores.push(this.clampScore(100 - Math.abs(moisture - 55) * 1.25));
    }
    if (temperature != null) {
      scores.push(this.clampScore(100 - Math.abs(temperature - 25) * 2));
    }
    if (ph != null) {
      scores.push(this.clampScore(100 - Math.abs(ph - 6.5) * 20));
    }
    if (nitrogen != null) {
      scores.push(this.clampScore(100 - Math.abs(nitrogen - 50) * 1.2));
    }
    if (phosphorus != null) {
      scores.push(this.clampScore(100 - Math.abs(phosphorus - 25) * 2));
    }
    if (potassium != null) {
      scores.push(this.clampScore(100 - Math.abs(potassium - 35) * 1.4));
    }
    if (electricalConductivity != null) {
      scores.push(
        this.clampScore(100 - Math.abs(electricalConductivity - 1.5) * 30),
      );
    }

    if (scores.length === 0) {
      return null;
    }

    return Math.round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length,
    );
  }

  private mapSupabaseToEntity(row: any): SensorReading | null {
    if (!row) return null;
    return {
      time: row.updated_at
        ? new Date(row.updated_at)
        : new Date(row.created_at),
      deviceId: row.device_id,
      nitrogen: row.nitrogen ?? null,
      phosphorus: row.phosphorus ?? null,
      potassium: row.potassium ?? null,
      moisture: row.soil_moisture_percent ?? null,
      temperature: row.soil_temperature_celsius ?? null,
      ph: row.soil_ph ?? null,
      soilConductivity: row.ec_levels ?? null,
      salinity: row.salinity ?? null,
      tds: row.tds_mg_l ?? null,
      electricalConductivity: row.ec_levels ?? null,
      batteryVoltage: row.battery_voltage ?? null,
      batteryStatus: row.battery_status ?? null,
      receiverWifiConnected: row.receiver_wifi_connected ?? null,
      receiverWifiSignalStrength: row.receiver_wifi_signal_strength_dbm ?? null,
      receiverWifiQuality: row.receiver_wifi_signal_quality ?? null,
      sensorStatus: row.sensor_status ?? null,
      receiverUptimeMinutes: row.receiver_uptime_minutes ?? null,
      receiverUptimeSeconds: row.receiver_uptime_seconds ?? null,
      soilHealthScore: this.calculateSoilHealthScore(row),
    };
  }

  // Get the absolute newest reading for our Live Cards
  async getLatestReading(deviceId: string): Promise<SensorReading | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('latest_soil_reading')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error) {
      this.logger.error(
        `Error fetching latest reading for ${deviceId}: ${error.message}`,
      );
      return null;
    }

    return this.mapSupabaseToEntity(data);
  }

  // Get historical data for the charts (e.g., last 50 readings)
  async getHistoricalData(deviceId: string): Promise<SensorReading[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('soil_readings')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      this.logger.error(
        `Error fetching history for ${deviceId}: ${error.message}`,
      );
      return [];
    }

    // Reverse so the chart goes left-to-right (old to new)
    return (
      data
        .map((row) => this.mapSupabaseToEntity(row))
        .filter(Boolean) as SensorReading[]
    ).reverse();
  }

  // --- ENVIRONMENT SENSOR READINGS ---

  async getEnvironmentLatest(deviceId: string): Promise<any | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('environment_sensor_readings')
      .select('*')
      .eq('device_id', deviceId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Ignore "no rows returned" error
        this.logger.error(
          `Error fetching latest environment reading for ${deviceId}: ${error.message}`,
        );
      }
      return null;
    }

    return data;
  }

  async getEnvironmentHistory(deviceId: string): Promise<any[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('environment_sensor_readings')
      .select('*')
      .eq('device_id', deviceId)
      .order('recorded_at', { ascending: false })
      .limit(24);

    if (error) {
      this.logger.error(
        `Error fetching environment history for ${deviceId}: ${error.message}`,
      );
      return [];
    }

    return data.reverse();
  }

  async getSavedAnalyses(deviceId: string): Promise<any[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('Wireless sensor Soil Analysis data')
      .select('*')
      .eq('device_id', deviceId)
      .order('saved_at', { ascending: false });

    if (error) {
      this.logger.error(`Error fetching saved analyses: ${error.message}`);
      return [];
    }
    return data || [];
  }

  // Save a user-labeled analysis into the Supabase table "Wireless sensor Soil Analysis data"
  async saveAnalysis(payload: any): Promise<any> {
    try {
      const row = {
        label: payload.label ?? 'Unnamed Analysis',
        soil_moisture:
          payload.soil_moisture ?? payload.soilMetrics?.moisture ?? null,
        temperature:
          payload.temperature ?? payload.soilMetrics?.temperature ?? null,
        soil_ph: payload.soil_ph ?? payload.soilMetrics?.ph ?? null,
        soil_conductivity:
          payload.soil_conductivity ??
          payload.soilMetrics?.conductivity ??
          null,
        soil_health_score:
          payload.soil_health_score ?? payload.soilHealthScore ?? null,
        nitrogen: payload.nitrogen ?? payload.soilMetrics?.nitrogen ?? null,
        phosphorus:
          payload.phosphorus ?? payload.soilMetrics?.phosphorus ?? null,
        potassium: payload.potassium ?? payload.soilMetrics?.potassium ?? null,
        tds: payload.tds ?? payload.soilMetrics?.tds ?? null,
        salinity: payload.salinity ?? payload.soilMetrics?.salinity ?? null,
        recommended_crop:
          payload.recommended_crop ?? payload.cropRecommendation ?? null,
        recommendation_reason:
          payload.recommendation_reason ?? payload.recommendationReason ?? null,
        device_id:
          payload.deviceId ?? payload.device_id ?? 'agribot_receiver_01',
      };

      // Table name contains spaces; supply the exact table name (Supabase client quotes internally)
      const { data, error } = await this.supabaseService
        .getClient()
        .from('Wireless sensor Soil Analysis data')
        .insert(row)
        .select()
        .single();

      if (error) {
        this.logger.error(`Error saving analysis: ${error.message}`);
        throw new Error(error.message);
      }

      return data;
    } catch (err: any) {
      this.logger.error(`saveAnalysis failed: ${err?.message ?? String(err)}`);
      throw err;
    }
  }

  // Delete analysis rows by id or ids
  async deleteAnalysis(payload: any): Promise<any> {
    try {
      const ids: string[] = payload?.ids ?? (payload?.id ? [payload.id] : []);
      if (!ids || ids.length === 0) {
        // Nothing to delete; return gracefully
        return { deleted: 0, rows: [] };
      }

      const query = this.supabaseService
        .getClient()
        .from('Wireless sensor Soil Analysis data')
        .delete();

      let result;
      if (ids.length === 1) {
        result = await query.eq('id', ids[0]).select().single();
      } else {
        result = await query.in('id', ids).select();
      }

      const { data, error } = result;
      if (error) {
        this.logger.error(`Error deleting analysis: ${error.message}`);
        throw new Error(error.message);
      }

      return { deleted: Array.isArray(data) ? data.length : 1, rows: data };
    } catch (err: any) {
      this.logger.error(
        `deleteAnalysis failed: ${err?.message ?? String(err)}`,
      );
      throw err;
    }
  }
}
