import { Controller, Get, Param, Post, Patch, Delete, Body, HttpCode } from '@nestjs/common';
import { DevicesService, CreateDeviceDto, UpdateDeviceDto } from './devices.service';

@Controller('devices')
export class DevicesController {
    constructor(private readonly devicesService: DevicesService) { }

    // Returns ALL devices (with field relation) — used by Device Config page
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

    // Provision a new IoT hardware device into the platform
    @Post()
    create(@Body() dto: CreateDeviceDto) {
        return this.devicesService.create(dto);
    }

    // Update an existing device — reassign field, change alias, update GPS coords
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
        return this.devicesService.update(id, dto);
    }

    // Decommission a device — remove from the platform
    @Delete(':id')
    @HttpCode(200)
    delete(@Param('id') id: string) {
        return this.devicesService.delete(id);
    }
}
