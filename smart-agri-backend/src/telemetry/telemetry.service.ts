import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SensorReading } from './entities/sensor-reading.entity';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private loginAttempts = new Map<
    string,
    { count: number; lockedUntil: number }
  >();
  private otpSessions = new Map<
    string,
    { code: string; user: any; expiresAt: number; attempts: number }
  >();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  private isBcryptHash(value: string): boolean {
    return /^\$2[aby]\$/.test(value);
  }

  // Verifies a password against a stored value that may still be legacy
  // plaintext. If it matches as plaintext, transparently rehashes it with
  // bcrypt and persists the hash so the account is migrated for next time.
  private async verifyAndMaybeMigratePassword(
    plain: string,
    stored: string,
    matchCol: string,
    matchVal: string | number,
    column: 'user_password_hash' | 'system_control_password_hash',
  ): Promise<boolean> {
    if (this.isBcryptHash(stored)) {
      return bcrypt.compare(plain, stored);
    }

    if (stored !== plain) return false;

    try {
      const newHash = await bcrypt.hash(plain, 10);
      const { error } = await this.supabaseService
        .getClient()
        .from('user_accounts')
        .update({ [column]: newHash })
        .eq(matchCol, matchVal);
      if (error) {
        this.logger.warn(
          `Password migration UPDATE failed for ${matchVal}: ${error.message}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Password migration to bcrypt failed for ${matchVal}: ${err?.message ?? err}`,
      );
    }

    return true;
  }

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
      sensorStatus: row.sensor_status ?? 'Connected',
      hc12PacketReceived: row.hc12_packet_received ?? true,
      hc12_packet_received: row.hc12_packet_received ?? true,
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

  // Get data specifically for the new dashboard from soil_sensor_readings table
  async getDashboardHistory(deviceId: string): Promise<any[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('soil_sensor_readings')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (error.code !== 'PGRST116') {
        this.logger.error(
          `Error fetching new dashboard data for ${deviceId}: ${error.message}`,
        );
      }
      return [];
    }

    // Map to the existing frontend structure so we don't break the UI
    return (data || [])
      .map((row) => ({
        id: row.id,
        device_id: row.device_id,
        moisture: row.soil_moisture_percent,
        temperature: row.soil_temperature_celsius,
        ph: row.soil_ph,
        electricalConductivity: row.conductivity,
        nitrogen: row.nitrogen,
        phosphorus: row.phosphorus,
        potassium: row.potassium,
        tds: row.tds_mg_l,
        salinity: row.salinity,
        time: row.created_at,
      }))
      .reverse();
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
      if (error.code !== 'PGRST116') {
        // Ignore "no rows returned" error
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
        soil_sample_label:
          payload.soil_sample_label ?? payload.label ?? 'Unnamed Analysis',
        crop_label: payload.crop_label ?? payload.cropLabel ?? null,
        soil_moisture:
          payload.soil_moisture ?? payload.soilMetrics?.moisture ?? 0,
        temperature:
          payload.temperature ?? payload.soilMetrics?.temperature ?? 0,
        soil_ph: payload.soil_ph ?? payload.soilMetrics?.ph ?? 7,
        soil_conductivity:
          payload.soil_conductivity ?? payload.soilMetrics?.conductivity ?? 0,
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
        reading_at:
          payload.reading_at ?? payload.readingAt ?? new Date().toISOString(),
        prediction_confidence:
          payload.prediction_confidence ?? payload.predictionConfidence ?? null,
        model_version: payload.model_version ?? payload.modelVersion ?? null,
        label_status: payload.label_status ?? payload.labelStatus ?? 'pending',
        labelled_by: payload.labelled_by ?? payload.labelledBy ?? null,
        verified_by: payload.verified_by ?? payload.verifiedBy ?? null,
        verified_at: payload.verified_at ?? payload.verifiedAt ?? null,
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

  // Update evaluation results for an already saved analysis record
  async updateAnalysisEvaluation(payload: {
    id: string;
    recommended_crop?: string;
    recommendation_reason?: string;
    prediction_confidence?: number;
    model_version?: string;
  }): Promise<any> {
    try {
      if (!payload?.id) {
        throw new Error(
          'Analysis ID is required for updating evaluation results.',
        );
      }
      const updateData = {
        recommended_crop: payload.recommended_crop ?? null,
        recommendation_reason: payload.recommendation_reason ?? null,
        prediction_confidence: payload.prediction_confidence ?? null,
        model_version: payload.model_version ?? null,
      };

      const { data, error } = await this.supabaseService
        .getClient()
        .from('Wireless sensor Soil Analysis data')
        .update(updateData)
        .eq('id', payload.id)
        .select()
        .single();

      if (error) {
        this.logger.error(
          `Error updating analysis evaluation: ${error.message}`,
        );
        throw new Error(error.message);
      }
      return data;
    } catch (err: any) {
      this.logger.error(
        `updateAnalysisEvaluation failed: ${err?.message ?? String(err)}`,
      );
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

  async getPumpLogs(deviceId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('pump_activation_logs')
      .select('*')
      .eq('device_id', deviceId)
      .order('start_time', { ascending: false })
      .limit(500);

    if (error) {
      this.logger.error(`Error fetching pump logs: ${error.message}`);
      return [];
    }
    return data || [];
  }

  async getSystemSwitches(deviceId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('system_switches')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Error fetching system switches: ${error.message}`);
    }

    if (data) {
      return {
        ...data,
        system_switch: data.system_switch ?? true,
        ai_automation_enabled: data.ai_automation_enabled ?? true,
        auto_grow_light_enabled: data.auto_grow_light_enabled ?? false,
        light_01: data.light_01 ?? false,
        light_02: data.light_02 ?? false,
        moisture_threshold_low: data.moisture_threshold_low ?? 20,
        moisture_threshold_high: data.moisture_threshold_high ?? 50,
        nitrogen_threshold_low: data.nitrogen_threshold_low ?? 30,
        nitrogen_threshold_high: data.nitrogen_threshold_high ?? 70,
        phosphorus_threshold_low: data.phosphorus_threshold_low ?? 30,
        phosphorus_threshold_high: data.phosphorus_threshold_high ?? 70,
        potassium_threshold_low: data.potassium_threshold_low ?? 30,
        potassium_threshold_high: data.potassium_threshold_high ?? 70,
        light_intensity_threshold_lux: data.light_intensity_threshold_lux ?? 5000,
      };
    }

    // Return defaults if not found
    return {
      pump_water: false,
      pump_nitrogen: false,
      pump_phosphorus: false,
      pump_potassium: false,
      system_switch: true,
      light_01: false,
      light_02: false,
      moisture_threshold_low: 20,
      moisture_threshold_high: 50,
      nitrogen_threshold_low: 30,
      nitrogen_threshold_high: 70,
      phosphorus_threshold_low: 30,
      phosphorus_threshold_high: 70,
      potassium_threshold_low: 30,
      potassium_threshold_high: 70,
      light_intensity_threshold_lux: 5000,
    };
  }

  async toggleSystemSwitch(deviceId: string, pumpName: string, state: boolean) {
    const validColumns = [
      'pump_water',
      'pump_nitrogen',
      'pump_phosphorus',
      'pump_potassium',
      'system_switch',
      'light_01',
      'light_02',
      'pump_mister',
    ];
    if (!validColumns.includes(pumpName)) {
      throw new Error('Invalid pump name');
    }

    const { data: updateData, error: updateError } = await this.supabaseService
      .getClient()
      .from('system_switches')
      .update({
        [pumpName]: state,
        updated_at: new Date().toISOString(),
      })
      .eq('device_id', deviceId)
      .select();

    if (updateError) {
      this.logger.error(`Error updating pump switch: ${updateError.message}`);
    } else if (!updateData || updateData.length === 0) {
      // Insert if not exists
      const { error: insertError } = await this.supabaseService
        .getClient()
        .from('system_switches')
        .insert({
          device_id: deviceId,
          [pumpName]: state,
          updated_at: new Date().toISOString(),
        });
      if (insertError) {
        this.logger.error(
          `Error inserting pump switch: ${insertError.message}`,
        );
      }
    }

    // --- pump_activation_logs Logic ---
    if (pumpName.startsWith('pump_')) {
      try {
        const purePumpName = pumpName.replace('pump_', '');
        const client = this.supabaseService.getClient();

        if (state === true) {
          // Start a new session
          const { error: logError } = await client
            .from('pump_activation_logs')
            .insert({
              session_id: randomUUID(),
              device_id: deviceId,
              pump_name: purePumpName,
              start_time: new Date().toISOString(),
              status: 'running',
            });
          if (logError)
            this.logger.error(`Error starting pump log: ${logError.message}`);
        } else {
          // Stop the currently running session
          const { data: runningSession, error: fetchError } = await client
            .from('pump_activation_logs')
            .select('*')
            .eq('device_id', deviceId)
            .eq('pump_name', purePumpName)
            .eq('status', 'running')
            .order('start_time', { ascending: false })
            .limit(1)
            .single();

          if (runningSession) {
            const endTime = new Date();
            const startTime = new Date(runningSession.start_time);
            const durationSeconds = Math.floor(
              (endTime.getTime() - startTime.getTime()) / 1000,
            );

            const { error: logError } = await client
              .from('pump_activation_logs')
              .update({
                end_time: endTime.toISOString(),
                duration_seconds: durationSeconds,
                status: 'completed',
              })
              .eq('session_id', runningSession.session_id);

            if (logError)
              this.logger.error(
                `Error completing pump log: ${logError.message}`,
              );
          }
        }
      } catch (logErr: any) {
        this.logger.error(
          `Failed to handle pump activation logs: ${logErr.message}`,
        );
      }
    }

    return { success: true, pumpName, state };
  }

  async updateThresholds(deviceId: string, body: any) {
    const { data: updateData, error: updateError } = await this.supabaseService
      .getClient()
      .from('system_switches')
      .update({
        moisture_threshold_low: body.moisture_threshold_low,
        moisture_threshold_high: body.moisture_threshold_high,
        nitrogen_threshold_low: body.nitrogen_threshold_low,
        nitrogen_threshold_high: body.nitrogen_threshold_high,
        phosphorus_threshold_low: body.phosphorus_threshold_low,
        phosphorus_threshold_high: body.phosphorus_threshold_high,
        potassium_threshold_low: body.potassium_threshold_low,
        potassium_threshold_high: body.potassium_threshold_high,
        light_intensity_threshold_lux: body.light_intensity_threshold_lux,
        updated_at: new Date().toISOString(),
      })
      .eq('device_id', deviceId)
      .select();

    if (updateError) {
      this.logger.error(`Error updating thresholds: ${updateError.message}`);
      return { success: false, message: updateError.message };
    }

    return { success: true, thresholds: updateData?.[0] };
  }

  async login(usernameOrEmail: string, password?: string) {
    if (!usernameOrEmail)
      return { success: false, message: 'Email or username is required.' };
    try {
      const cleanInput = usernameOrEmail.trim().toLowerCase();

      // 1. Check Rate Limiting (Brute-force protection)
      const attemptRecord = this.loginAttempts.get(cleanInput);
      if (attemptRecord && attemptRecord.lockedUntil > Date.now()) {
        const waitMins = Math.ceil(
          (attemptRecord.lockedUntil - Date.now()) / 60000,
        );
        return {
          success: false,
          message: `Account temporarily locked due to too many failed attempts. Please try again in ${waitMins} minute(s).`,
        };
      }

      const client = this.supabaseService.getClient();
      const { data: allUsers, error } = await client
        .from('user_accounts')
        .select('*');
      if (error) {
        this.logger.warn(`Error querying user_accounts: ${error.message}`);
        return { success: false, message: `Database error: ${error.message}` };
      }
      if (!allUsers || allUsers.length === 0) {
        return {
          success: false,
          message: 'user_accounts table is empty or account not found.',
        };
      }

      const matchedUser = allUsers.find((u) => {
        const emailMatch =
          u.email && String(u.email).trim().toLowerCase() === cleanInput;
        const userMatch =
          u.username && String(u.username).trim().toLowerCase() === cleanInput;
        return emailMatch || userMatch;
      });

      if (!matchedUser) {
        return {
          success: false,
          message: 'Account not found in user_accounts table.',
        };
      }

      if (matchedUser.account_status === 'disabled') {
        return {
          success: false,
          message: 'This account has been disabled. Contact an administrator.',
        };
      }

      const dbPassword = matchedUser.user_password_hash;
      const matchCol =
        matchedUser.id != null
          ? 'id'
          : matchedUser.email
            ? 'email'
            : 'username';
      const matchVal =
        matchedUser.id ?? matchedUser.email ?? matchedUser.username;

      if (password && dbPassword) {
        const passwordOk = await this.verifyAndMaybeMigratePassword(
          password,
          String(dbPassword),
          matchCol,
          matchVal,
          'user_password_hash',
        );

        if (!passwordOk) {
          // Record failed attempt
          const count = (attemptRecord?.count || 0) + 1;
          if (count >= 5) {
            this.loginAttempts.set(cleanInput, {
              count,
              lockedUntil: Date.now() + 15 * 60 * 1000,
            });
            return {
              success: false,
              message:
                'Too many failed login attempts. Account locked for 15 minutes.',
            };
          } else {
            this.loginAttempts.set(cleanInput, { count, lockedUntil: 0 });
            return {
              success: false,
              message: `Invalid password. ${5 - count} attempt(s) remaining before lockout.`,
            };
          }
        }
      }

      // Successful login -> Reset login attempt counts
      this.loginAttempts.delete(cleanInput);

      // 2. Generate Server-Side 6-Digit OTP Code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const sessionKey = (
        matchedUser.email ||
        matchedUser.username ||
        cleanInput
      )
        .toString()
        .toLowerCase()
        .trim();

      this.otpSessions.set(sessionKey, {
        code,
        user: matchedUser,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes expiration
        attempts: 0,
      });

      const userPhone =
        matchedUser.phone ||
        matchedUser.phone_number ||
        matchedUser.mobile ||
        '+1 (555) 382-9102';

      const is2FADisabled = userPhone.endsWith(':NO_2FA');
      const cleanPhone = userPhone.replace(':NO_2FA', '');

      const sanitizedUser = {
        email: matchedUser.email,
        username: matchedUser.username,
        phone: cleanPhone,
        full_name: matchedUser.full_name || matchedUser.name,
        two_factor_enabled: !is2FADisabled,
      };

      if (is2FADisabled) {
        // Bypass OTP entirely
        this.otpSessions.delete(sessionKey);
        const token = await this.jwtService.signAsync({
          sub: matchedUser.id ?? matchedUser.email ?? matchedUser.username,
          email: matchedUser.email,
          username: matchedUser.username,
        });
        return {
          success: true,
          requires2FA: false,
          user: sanitizedUser,
          token,
          sessionExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
      }

      this.sendSms(cleanPhone, code, matchedUser.email);

      // 3. Return sanitized profile (NEVER return password hash or OTP code to the client)
      return {
        success: true,
        requires2FA: true,
        user: sanitizedUser,
      };
    } catch (err: any) {
      this.logger.error(`Login error: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  async sendSms(phone: string, code: string, userEmail?: string) {
    const targetPhone = phone || '+1 (555) 382-9102';
    this.logger.log(
      `[AUTH/OTP SERVICE] Dispatching 2FA verification code [${code}] to ${targetPhone} for ${userEmail || 'user'}`,
    );

    // 1. WhatsApp Cloud API Check (100% Free Tier - Meta)
    const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const waToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (waPhoneId && waToken) {
      try {
        const cleanNumber = targetPhone.replace(/[^0-9]/g, '');
        const url = `https://graph.facebook.com/v20.0/${waPhoneId}/messages`;

        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanNumber,
          type: 'text',
          text: {
            preview_url: false,
            body: `🔐 *AgriBot Security Verification*\n\nYour login verification code is: *${code}*\n\nDo not share this OTP with anyone.`,
          },
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${waToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const resJson = await response.json().catch(() => ({}));

        if (response.ok) {
          this.logger.log(
            `[WHATSAPP SERVICE] Successfully dispatched live WhatsApp OTP via Meta Cloud API to +${cleanNumber}. Meta Response: ${JSON.stringify(resJson)}`,
          );
          return {
            success: true,
            phone: targetPhone,
            live: true,
            provider: 'WhatsApp Cloud API',
            message: 'WhatsApp verification code dispatched!',
          };
        } else {
          this.logger.warn(
            `[WHATSAPP SERVICE] Meta API error: ${JSON.stringify(resJson)}. Falling back to cellular SMS/Simulated broadcast.`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `[WHATSAPP SERVICE] WhatsApp dispatch error: ${err.message}. Falling back...`,
        );
      }
    }

    // 2. Twilio Cellular SMS Check
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && fromPhone) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const params = new URLSearchParams();
        params.append('To', targetPhone);
        params.append('From', fromPhone);
        params.append(
          'Body',
          `[AgriBot Security] Your verification code is: ${code}. Do not share this code.`,
        );

        const authHeader =
          'Basic ' +
          Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        });

        if (response.ok) {
          this.logger.log(
            `[SMS SERVICE] Successfully dispatched live cellular SMS via Twilio to ${targetPhone}`,
          );
          return {
            success: true,
            phone: targetPhone,
            live: true,
            provider: 'Twilio SMS',
            message: 'Cellular SMS dispatched!',
          };
        } else {
          const errText = await response.text();
          this.logger.warn(
            `[SMS SERVICE] Twilio dispatch failed: ${errText}. Using simulated broadcast.`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `[SMS SERVICE] Live SMS dispatch error: ${err.message}. Using simulated broadcast.`,
        );
      }
    }

    // 3. Simulated Gateway Broadcast
    return {
      success: true,
      phone: targetPhone,
      live: false,
      provider: 'Simulated Gateway',
      code,
      message: `Verification code broadcasted to ${targetPhone}`,
    };
  }

  async verifyOtp(emailOrUsername: string, code: string) {
    if (!emailOrUsername || !code)
      return {
        success: false,
        message: 'Email and verification code are required.',
      };
    const sessionKey = emailOrUsername.toString().toLowerCase().trim();
    const session = this.otpSessions.get(sessionKey);

    if (!session) {
      return {
        success: false,
        message:
          'No active verification session found. Please log in again or click Resend Code.',
      };
    }

    if (Date.now() > session.expiresAt) {
      this.otpSessions.delete(sessionKey);
      return {
        success: false,
        message:
          'Verification code has expired (5-minute limit). Please click Resend Code.',
      };
    }

    if (session.attempts >= 5) {
      this.otpSessions.delete(sessionKey);
      return {
        success: false,
        message:
          'Too many incorrect verification attempts. For security, please log in again.',
      };
    }

    if (String(session.code).trim() !== String(code).trim()) {
      session.attempts += 1;
      return {
        success: false,
        message: `Invalid verification code. ${5 - session.attempts} attempt(s) remaining.`,
      };
    }

    // OTP verified! Clear session and issue a real, signed session token.
    this.otpSessions.delete(sessionKey);
    const user = session.user;
    const token = await this.jwtService.signAsync({
      sub: user.id ?? user.email ?? user.username,
      email: user.email,
      username: user.username,
    });

    return {
      success: true,
      user,
      token,
      sessionExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24-hour session expiration (also encoded as the JWT's exp claim)
    };
  }

  async resendOtp(emailOrUsername: string) {
    if (!emailOrUsername)
      return { success: false, message: 'Email or username is required.' };
    const sessionKey = emailOrUsername.toString().toLowerCase().trim();
    const session = this.otpSessions.get(sessionKey);

    if (!session || !session.user) {
      return {
        success: false,
        message:
          'Your session has expired. Please return to Step 1 and log in again.',
      };
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    session.code = newCode;
    session.expiresAt = Date.now() + 5 * 60 * 1000;
    session.attempts = 0;

    const userPhone =
      session.user.phone ||
      session.user.phone_number ||
      session.user.mobile ||
      '+1 (555) 382-9102';
    await this.sendSms(userPhone, newCode, session.user.email);

    return {
      success: true,
      message: 'New verification code dispatched to your WhatsApp / SMS.',
    };
  }

  async updateAccount(body: {
    email?: string;
    oldEmail?: string;
    fullName?: string;
    username?: string;
    phone?: string;
    twoFactorEnabled?: boolean;
  }) {
    this.logger.log(
      `[AUTH SERVICE] Updating user account for ${body.oldEmail || body.email || body.username}`,
    );
    try {
      const client = this.supabaseService.getClient();
      const { data: allUsers, error: fetchErr } = await client
        .from('user_accounts')
        .select('*');
      if (fetchErr || !allUsers || allUsers.length === 0) {
        return {
          success: false,
          message: 'Could not fetch user_accounts table.',
        };
      }

      const cleanOld = body.oldEmail ? body.oldEmail.trim().toLowerCase() : '';
      const cleanEmail = body.email ? body.email.trim().toLowerCase() : '';
      const cleanUser = body.username ? body.username.trim().toLowerCase() : '';

      let target = allUsers.find((u: any) => {
        const uEmail = u.email ? String(u.email).trim().toLowerCase() : '';
        const uUser = u.username ? String(u.username).trim().toLowerCase() : '';
        const uUserEmail = u.user_email
          ? String(u.user_email).trim().toLowerCase()
          : '';
        return (
          (cleanOld && (uEmail === cleanOld || uUserEmail === cleanOld)) ||
          (cleanEmail &&
            (uEmail === cleanEmail || uUserEmail === cleanEmail)) ||
          (cleanUser && uUser === cleanUser)
        );
      });

      if (!target && allUsers.length === 1) {
        target = allUsers[0];
      }

      if (!target) {
        return {
          success: false,
          message: 'Matching user account not found in database.',
        };
      }

      const updatePayload: any = {};
      if (body.fullName) {
        if ('full_name' in target) updatePayload.full_name = body.fullName;
        if ('name' in target) updatePayload.name = body.fullName;
      }
      if (body.username && 'username' in target)
        updatePayload.username = body.username;
      if (body.email) {
        if ('email' in target) updatePayload.email = body.email;
        if ('user_email' in target) updatePayload.user_email = body.email;
      }
      if (body.phone) {
        let finalPhone = body.phone;
        if (body.twoFactorEnabled === false) {
          finalPhone += ':NO_2FA';
        }
        if ('phone' in target) updatePayload.phone = finalPhone;
        if ('phone_number' in target) updatePayload.phone_number = finalPhone;
        if ('mobile' in target) updatePayload.mobile = finalPhone;
        if ('contact_no' in target) updatePayload.contact_no = finalPhone;
        if (
          !('phone' in target) &&
          !('phone_number' in target) &&
          !('mobile' in target)
        ) {
          updatePayload.phone = finalPhone;
        }
      }
      if ('updated_at' in target)
        updatePayload.updated_at = new Date().toISOString();

      const matchCol = target.id ? 'id' : target.email ? 'email' : 'username';
      const matchVal = target.id || target.email || target.username;

      const { data: updated, error: updateErr } = await client
        .from('user_accounts')
        .update(updatePayload)
        .eq(matchCol, matchVal)
        .select();

      if (updateErr) {
        this.logger.error(`Error updating user_accounts: ${updateErr.message}`);
        return { success: false, message: updateErr.message };
      }

      let updatedUser =
        updated && updated.length > 0
          ? updated[0]
          : { ...target, ...updatePayload };

      const is2FADisabledUpdate = updatedUser.phone && updatedUser.phone.endsWith(':NO_2FA');
      if (is2FADisabledUpdate) {
        updatedUser = { ...updatedUser, phone: updatedUser.phone.replace(':NO_2FA', '') };
      }
      updatedUser.two_factor_enabled = !is2FADisabledUpdate;

      return {
        success: true,
        user: updatedUser,
        message: 'Account updated successfully in database!',
      };
    } catch (err: any) {
      this.logger.error(`updateAccount error: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  async verifySystemControlPassword(
    emailOrUsername: string,
    password?: string,
  ) {
    if (!password)
      return {
        success: false,
        message: 'System Control security password is required.',
      };
    try {
      const client = this.supabaseService.getClient();
      const { data: allUsers, error } = await client
        .from('user_accounts')
        .select('*');
      if (error) {
        this.logger.warn(
          `Error querying user_accounts for system control verification: ${error.message}`,
        );
        return { success: false, message: `Database error: ${error.message}` };
      }
      if (!allUsers || allUsers.length === 0) {
        return {
          success: false,
          message: 'user_accounts table is empty or account not found.',
        };
      }

      let matchedUser = null;
      if (emailOrUsername) {
        const cleanInput = emailOrUsername.trim().toLowerCase();
        matchedUser = allUsers.find((u) => {
          const emailMatch =
            u.email && String(u.email).trim().toLowerCase() === cleanInput;
          const userMatch =
            u.username &&
            String(u.username).trim().toLowerCase() === cleanInput;
          return emailMatch || userMatch;
        });
      }

      const targetUser = matchedUser || allUsers[0];
      const dbSystemPassword = targetUser?.system_control_password_hash;

      if (!dbSystemPassword) {
        return {
          success: false,
          message:
            'System Control password is not configured for this account.',
        };
      }

      const matchCol =
        targetUser.id != null ? 'id' : targetUser.email ? 'email' : 'username';
      const matchVal = targetUser.id ?? targetUser.email ?? targetUser.username;

      const passwordOk = await this.verifyAndMaybeMigratePassword(
        password,
        String(dbSystemPassword),
        matchCol,
        matchVal,
        'system_control_password_hash',
      );

      if (passwordOk) {
        this.logger.log(
          `[SECURITY] System Control unlocked for user: ${targetUser?.email || targetUser?.username || 'unknown'}`,
        );
        return {
          success: true,
          message: 'System Control center unlocked successfully!',
        };
      }

      return {
        success: false,
        message: 'Invalid System Control security password.',
      };
    } catch (err: any) {
      this.logger.error(`verifySystemControlPassword error: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  async verifyAccountPassword(
    emailOrUsername: string,
    accountPassword?: string,
  ) {
    if (!accountPassword)
      return { success: false, message: 'Account login password is required.' };
    try {
      const client = this.supabaseService.getClient();
      const { data: allUsers, error } = await client
        .from('user_accounts')
        .select('*');
      if (error) {
        return { success: false, message: `Database error: ${error.message}` };
      }
      if (!allUsers || allUsers.length === 0) {
        return { success: false, message: 'Account not found.' };
      }

      let matchedUser = null;
      if (emailOrUsername) {
        const cleanInput = emailOrUsername.trim().toLowerCase();
        matchedUser = allUsers.find((u) => {
          const emailMatch =
            u.email && String(u.email).trim().toLowerCase() === cleanInput;
          const userMatch =
            u.username &&
            String(u.username).trim().toLowerCase() === cleanInput;
          return emailMatch || userMatch;
        });
      }

      const targetUser = matchedUser || allUsers[0];
      const dbPassword = targetUser?.user_password_hash;
      if (!dbPassword) {
        return { success: false, message: 'Incorrect account login password.' };
      }

      const matchCol =
        targetUser.id != null ? 'id' : targetUser.email ? 'email' : 'username';
      const matchVal = targetUser.id ?? targetUser.email ?? targetUser.username;

      const passwordOk = await this.verifyAndMaybeMigratePassword(
        accountPassword,
        String(dbPassword),
        matchCol,
        matchVal,
        'user_password_hash',
      );

      if (passwordOk) {
        return {
          success: true,
          message: 'Account password verified successfully!',
        };
      }

      return { success: false, message: 'Incorrect account login password.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async updateSystemControlPassword(
    emailOrUsername: string,
    accountPassword?: string,
    oldSystemPassword?: string,
    newSystemPassword?: string,
  ) {
    if (!accountPassword || !oldSystemPassword || !newSystemPassword) {
      return { success: false, message: 'All password fields are required.' };
    }
    try {
      const accCheck = await this.verifyAccountPassword(
        emailOrUsername,
        accountPassword,
      );
      if (!accCheck.success) {
        return {
          success: false,
          message:
            'Account login password verification failed. Cannot change system control password.',
        };
      }

      const sysCheck = await this.verifySystemControlPassword(
        emailOrUsername,
        oldSystemPassword,
      );
      if (!sysCheck.success) {
        return {
          success: false,
          message: 'Old System Control password verification failed.',
        };
      }

      const client = this.supabaseService.getClient();
      const { data: allUsers } = await client.from('user_accounts').select('*');
      let matchedUser = null;
      if (emailOrUsername && allUsers) {
        const cleanInput = emailOrUsername.trim().toLowerCase();
        matchedUser = allUsers.find((u) => {
          const emailMatch =
            u.email && String(u.email).trim().toLowerCase() === cleanInput;
          const userMatch =
            u.username &&
            String(u.username).trim().toLowerCase() === cleanInput;
          return emailMatch || userMatch;
        });
      }
      const targetUser = matchedUser || (allUsers && allUsers[0]);
      if (!targetUser)
        return { success: false, message: 'Target user account not found.' };

      const matchCol =
        targetUser.id != null ? 'id' : targetUser.email ? 'email' : 'username';
      const matchVal = targetUser.id ?? targetUser.email ?? targetUser.username;

      const updatePayload: any = {
        system_control_password_hash: await bcrypt.hash(newSystemPassword, 10),
      };

      const { data: updated, error } = await client
        .from('user_accounts')
        .update(updatePayload)
        .eq(matchCol, matchVal)
        .select();

      if (error) {
        this.logger.error(
          `Error updating system_control_password_hash: ${error.message}`,
        );
        return {
          success: false,
          message: `Database update error: ${error.message}`,
        };
      }

      this.logger.log(
        `[SECURITY] System Control password updated successfully for: ${matchVal}`,
      );
      return {
        success: true,
        message:
          'System Control security password has been updated successfully!',
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async getCustomPresets() {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('custom_threshold_presets')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      this.logger.error(`Error fetching custom presets: ${error.message}`);
      throw new Error('Failed to fetch custom presets');
    }
    return data || [];
  }

  async createCustomPreset(payload: {
    preset_name: string;
    moisture_threshold_low: number;
    moisture_threshold_high: number;
    nitrogen_threshold_low: number;
    nitrogen_threshold_high: number;
    phosphorus_threshold_low: number;
    phosphorus_threshold_high: number;
    potassium_threshold_low: number;
    potassium_threshold_high: number;
  }) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('custom_threshold_presets')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // unique violation
        throw new Error('A preset with this name already exists.');
      }
      this.logger.error(`Error saving custom preset: ${error.message}`);
      throw new Error('Failed to save custom preset');
    }

    return data;
  }

  async deleteCustomPreset(id: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('custom_threshold_presets')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`Error deleting custom preset: ${error.message}`);
      throw new Error('Failed to delete custom preset');
    }

    return { success: true };
  }

  async toggleAiAutomation(deviceId: string, enabled: boolean) {
    this.logger.log(`Toggling AI Automation for ${deviceId} to ${enabled}`);

    // If we are disabling automation, we must also shut off all pumps to be safe
    const updatePayload: any = { ai_automation_enabled: enabled };
    
    if (!enabled) {
      updatePayload.pump_water = false;
      updatePayload.pump_nitrogen = false;
      updatePayload.pump_phosphorus = false;
      updatePayload.pump_potassium = false;
      this.logger.log(`AI Automation OFF: Forcing all pumps off for safety.`);
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('system_switches')
      .update(updatePayload)
      .eq('device_id', deviceId);

    if (error) {
      this.logger.error(`Error toggling AI automation: ${error.message}`);
      throw new Error('Failed to toggle AI automation');
    }

    return { success: true, ai_automation_enabled: enabled };
  }

  async toggleAutoGrowLight(deviceId: string, enabled: boolean) {
    this.logger.log(`Toggling auto grow light for ${deviceId} to ${enabled}`);

    const { error } = await this.supabaseService
      .getClient()
      .from('system_switches')
      .update({ auto_grow_light_enabled: enabled })
      .eq('device_id', deviceId);

    if (error) {
      this.logger.error(`Error toggling auto grow light: ${error.message}`);
      throw new Error('Failed to toggle auto grow light');
    }

    return { success: true, auto_grow_light_enabled: enabled };
  }

  async toggleAutoMister(deviceId: string, enabled: boolean) {
    this.logger.log(`Toggling auto humidity mister for ${deviceId} to ${enabled}`);

    const { error } = await this.supabaseService
      .getClient()
      .from('system_switches')
      .update({ auto_mister_enabled: enabled })
      .eq('device_id', deviceId);

    if (error) {
      this.logger.error(`Error toggling auto humidity mister: ${error.message}`);
      throw new Error('Failed to toggle auto humidity mister');
    }

    return { success: true, auto_mister_enabled: enabled };
  }
}
