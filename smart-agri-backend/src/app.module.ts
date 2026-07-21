import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

import { TelemetryModule } from './telemetry/telemetry.module';
import { AiModule } from './ai/ai.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '.env')],
    }),
    SupabaseModule,
    TelemetryModule,
    AiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
