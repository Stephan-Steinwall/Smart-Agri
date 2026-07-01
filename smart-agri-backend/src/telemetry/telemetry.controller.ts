import { Controller, Get, Param } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('api/v1/telemetry')
export class TelemetryController {
    constructor(private readonly telemetryService: TelemetryService) { }

    @Get('latest/:deviceId')
    getLatest(@Param('deviceId') deviceId: string) {
        return this.telemetryService.getLatestReading(deviceId);
    }

    @Get('history/:deviceId')
    getHistory(@Param('deviceId') deviceId: string) {
        return this.telemetryService.getHistoricalData(deviceId);
    }
}