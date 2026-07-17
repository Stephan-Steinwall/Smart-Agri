import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
    private readonly logger = new Logger(SupabaseService.name);
    private clientInstance: SupabaseClient;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
            this.logger.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.');
        }

        this.clientInstance = createClient(supabaseUrl, supabaseKey);
    }

    getClient(): SupabaseClient {
        return this.clientInstance;
    }
}
