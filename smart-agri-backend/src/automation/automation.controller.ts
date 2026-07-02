import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { AutomationService } from './automation.service';

@Controller('automation')
export class AutomationController {
    constructor(private readonly automationService: AutomationService) { }

    @Get('field/:fieldId')
    getDevices(@Param('fieldId') fieldId: string) {
        return this.automationService.getDevicesForField(fieldId);
    }

    @Post('toggle')
    toggleDevice(@Body() body: { deviceId: string; turnOn: boolean }) {
        return this.automationService.toggleDevice(body.deviceId, body.turnOn);
    }
}