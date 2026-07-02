// src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { Field } from '../farms/entities/field.entity';

@Module({
  // Import the Field entity so we can look up Crop Profiles
  imports: [TelemetryModule, TypeOrmModule.forFeature([Field])],
  providers: [AiService],
  controllers: [AiController]
})
export class AiModule { }