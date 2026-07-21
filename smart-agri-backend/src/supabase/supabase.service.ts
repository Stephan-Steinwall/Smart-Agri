import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private clientInstance: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('SUPABASE_KEY') ||
      this.configService.get<string>('SUPABASE_PUBLISHABLE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      '';

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE key is missing from environment variables.',
      );
    }

    if (this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')) {
      this.logger.log('Using SUPABASE_SERVICE_ROLE_KEY for Supabase client.');
    } else if (
      this.configService.get<string>('SUPABASE_PUBLISHABLE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY')
    ) {
      this.logger.warn(
        'SUPABASE_SERVICE_ROLE_KEY missing; falling back to publishable/anon key for Supabase client.',
      );
    }

    this.clientInstance = createClient(supabaseUrl, supabaseKey);
  }

  getClient(): SupabaseClient {
    return this.clientInstance;
  }
}
