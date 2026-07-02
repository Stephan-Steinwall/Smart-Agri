import { Controller, Get, Patch, Param } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('api/v1/alerts')
export class AlertsController {
    constructor(private readonly alertsService: AlertsService) { }

    @Get('unread')
    getUnread() {
        return this.alertsService.getUnreadAlerts();
    }

    @Patch(':id/read')
    markAsRead(@Param('id') id: string) {
        return this.alertsService.markAsRead(id);
    }
}