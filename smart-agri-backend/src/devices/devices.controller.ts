import { Controller, Get, Param } from '@nestjs/common';
import { DevicesService } from './devices.service';

@Controller('devices')
export class DevicesController {
    constructor(private readonly devicesService: DevicesService) { }

    // Returns ALL devices (with field relation)
    @Get()
    findAll() {
        return this.devicesService.findAll();
    }

    // Returns only FIXED sensor NODEs — the ones that produce telemetry readings
    // Used by the dashboard and AI page to dynamically resolve the sensor device UUID
    @Get('sensor-nodes')
    findSensorNodes() {
        return this.devicesService.findSensorNodes();
    }

    // Returns only PORTABLE NODEs — the handheld reader the farmer carries for spot-checks
    @Get('portable-nodes')
    findPortableNodes() {
        return this.devicesService.findPortableDevices();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.devicesService.findOne(id);
    }
}
