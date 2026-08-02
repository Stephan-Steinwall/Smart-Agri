import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async listUnread(deviceId?: string) {
    let query = this.supabaseService
      .getClient()
      .from('system_alerts')
      .select('*')
      .is('read_at', null)
      .order('created_at', { ascending: false });

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Error fetching unread alerts: ${error.message}`);
      return [];
    }
    return data || [];
  }

  async markRead(id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('system_alerts')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error marking alert ${id} as read: ${error.message}`);
      throw new Error(error.message);
    }
    return data;
  }

  async markAllRead(deviceId?: string) {
    let query = this.supabaseService
      .getClient()
      .from('system_alerts')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query.select();

    if (error) {
      this.logger.error(`Error marking all alerts as read: ${error.message}`);
      throw new Error(error.message);
    }
    return data;
  }

  async create(deviceId: string, severity: AlertSeverity, message: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('system_alerts')
      .insert({ device_id: deviceId, severity, message });

    if (error) {
      this.logger.error(`Error creating alert: ${error.message}`);
    }
  }
}
