import { Controller, Get, Param } from '@nestjs/common';
import { DevicesService } from './devices.service';

@Controller('devices')
export class DevicesController {
    constructor(private readonly devicesService: DevicesService) { }

    @Get()
    findAll() {
        return this.devicesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.devicesService.findOne(id);
    }
}
