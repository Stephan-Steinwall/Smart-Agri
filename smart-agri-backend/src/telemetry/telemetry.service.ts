import { Injectable, Logger } from '@nestjs/common';
import { SensorReading } from './entities/sensor-reading.entity';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TelemetryService {
    private readonly logger = new Logger(TelemetryService.name);

    constructor(private readonly supabaseService: SupabaseService) {}

    private mapSupabaseToEntity(row: any): SensorReading | null {
        if (!row) return null;
        return {
            time: row.updated_at ? new Date(row.updated_at) : new Date(row.created_at),
            deviceId: row.device_id,
            nitrogen: row.nitrogen ?? null,
            phosphorus: row.phosphorus ?? null,
            potassium: row.potassium ?? null,
            moisture: row.soil_moisture_percent ?? null,
            temperature: row.soil_temperature_celsius ?? null,
            ph: row.soil_ph ?? null,
            electricalConductivity: row.ec_levels ?? null,
            batteryLevel: row.battery_voltage ?? null,
        };
    }

    // Get the absolute newest reading for our Live Cards
    async getLatestReading(deviceId: string): Promise<SensorReading | null> {
        const { data, error } = await this.supabaseService.getClient()
            .from('latest_soil_reading')
            .select('*')
            .eq('device_id', deviceId)
            .single();

        if (error) {
            this.logger.error(`Error fetching latest reading for ${deviceId}: ${error.message}`);
            return null;
        }
        
        return this.mapSupabaseToEntity(data);
    }

    // Get historical data for the charts (e.g., last 50 readings)
    async getHistoricalData(deviceId: string): Promise<SensorReading[]> {
        const { data, error } = await this.supabaseService.getClient()
            .from('soil_readings')
            .select('*')
            .eq('device_id', deviceId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            this.logger.error(`Error fetching history for ${deviceId}: ${error.message}`);
            return [];
        }

        // Reverse so the chart goes left-to-right (old to new)
        return (data.map((row) => this.mapSupabaseToEntity(row)).filter(Boolean) as SensorReading[]).reverse(); 
    }
}