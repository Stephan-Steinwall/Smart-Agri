import { Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';

@Module({
    imports: [],
    providers: [TelemetryService],
    controllers: [TelemetryController],
    exports: [TelemetryService],
})
export class TelemetryModule { }