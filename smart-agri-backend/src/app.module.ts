import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TelemetryModule } from './telemetry/telemetry.module';
import { AiModule } from './ai/ai.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    TelemetryModule,
    AiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}