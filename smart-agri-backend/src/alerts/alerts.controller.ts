import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('unread')
  async getUnread(@Query('deviceId') deviceId?: string) {
    return this.alertsService.listUnread(deviceId);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    return this.alertsService.markRead(id);
  }
}
