import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

import { ScheduleModule } from '@nestjs/schedule';

import { TelemetryModule } from './telemetry/telemetry.module';
import { AiModule } from './ai/ai.module';
import { SupabaseModule } from './supabase/supabase.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), '.env')],
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    TelemetryModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
