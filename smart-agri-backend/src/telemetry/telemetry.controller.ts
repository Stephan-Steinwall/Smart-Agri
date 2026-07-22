import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get('latest/:deviceId')
  getLatest(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getLatestReading(deviceId);
  }

  @Get('history/:deviceId')
  getHistory(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getHistoricalData(deviceId);
  }

  @Get('environment/latest/:deviceId')
  getEnvironmentLatest(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getEnvironmentLatest(deviceId);
  }

  @Get('environment/history/:deviceId')
  getEnvironmentHistory(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getEnvironmentHistory(deviceId);
  }

  @Get('saved-analyses/:deviceId')
  async getSavedAnalyses(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getSavedAnalyses(deviceId);
  }

  @Post('save-analysis')
  async saveAnalysis(@Body() body: any) {
    return this.telemetryService.saveAnalysis(body);
  }

  @Post('delete-analysis')
  async deleteAnalysis(@Body() body: any) {
    return this.telemetryService.deleteAnalysis(body);
  }
}
