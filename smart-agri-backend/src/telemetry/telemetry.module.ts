import { Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { AutomationService } from './automation.service';

@Module({
  imports: [],
  providers: [TelemetryService, AutomationService],
  controllers: [TelemetryController],
  exports: [TelemetryService],
})
export class TelemetryModule {}
