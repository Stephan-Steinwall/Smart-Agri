import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorReading } from './entities/sensor-reading.entity';

@Injectable()
export class TelemetryService {
    constructor(
        @InjectRepository(SensorReading)
        private telemetryRepo: Repository<SensorReading>,
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
}