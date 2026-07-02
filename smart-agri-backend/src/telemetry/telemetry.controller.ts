import { Controller, Get, Param } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
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

    @Get('field-history/:fieldId')
    async getHistoryByField(@Param('fieldId') fieldId: string) {
        // We will ask the TelemetryService to handle this!
        return this.telemetryService.getHistoryByField(fieldId);
    }
}