import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorReading } from './entities/sensor-reading.entity';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';

@Module({
    imports: [TypeOrmModule.forFeature([SensorReading])],
    providers: [TelemetryService],
    controllers: [TelemetryController],
    exports: [TelemetryService],
})
export class TelemetryModule { }