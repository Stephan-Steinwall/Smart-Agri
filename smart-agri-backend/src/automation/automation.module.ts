import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { AiModule } from '../ai/ai.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [SupabaseModule, TelemetryModule, AiModule, AlertsModule],
  providers: [AutomationService],
})
export class AutomationModule {}
