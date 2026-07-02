import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SensorReading } from './entities/sensor-reading.entity';
import { Device, DeviceType, OperatingMode } from '../devices/entities/device.entity';

@Injectable()
export class TelemetryService {
    constructor(
        @InjectRepository(SensorReading)
        private telemetryRepo: Repository<SensorReading>,
        private dataSource: DataSource,
    ) { }

    // Get the absolute newest reading for our Live Cards
    async getLatestReading(deviceId: string) {
        return this.telemetryRepo.findOne({
            where: { deviceId },
            order: { time: 'DESC' },
        });
    }

    // Get historical data for the charts (e.g., last 50 readings)
    async getHistoricalData(deviceId: string) {
        const data = await this.telemetryRepo.find({
            where: { deviceId },
            order: { time: 'DESC' },
            take: 50, // Get last 50 data points
        });
        return data.reverse(); // Reverse so the chart goes left-to-right (old to new)
    }

    /**
     * Resolves the fixed sensor NODE for a field, then returns its history.
     * Filters on BOTH deviceType=NODE and operatingMode=FIXED to avoid
     * accidentally matching a HUB (which never produces sensor readings).
     */
    async getHistoryByField(fieldId: string) {
        const device = await this.dataSource.getRepository(Device).findOne({
            where: {
                field: { id: fieldId },
                deviceType: DeviceType.NODE,
                operatingMode: OperatingMode.FIXED,
            },
        });

        if (!device) {
            console.warn(`[TelemetryService] No fixed NODE found for field ${fieldId}`);
            return [];
        }

        console.log(`[TelemetryService] Resolved device ${device.id} (${device.alias ?? device.macAddress}) for field ${fieldId}`);
        return this.getHistoricalData(device.id);
    }

    /**
     * Convenience helper used by AiService: resolves the fixed sensor NODE
     * for a field and returns its single latest reading.
     */
    async getLatestReadingByField(fieldId: string) {
        const device = await this.dataSource.getRepository(Device).findOne({
            where: {
                field: { id: fieldId },
                deviceType: DeviceType.NODE,
                operatingMode: OperatingMode.FIXED,
            },
        });

        if (!device) {
            console.warn(`[TelemetryService] No fixed NODE found for field ${fieldId}`);
            return null;
        }

        return this.getLatestReading(device.id);
    }
}