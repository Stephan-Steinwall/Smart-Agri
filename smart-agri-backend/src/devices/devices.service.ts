import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device, DeviceType, OperatingMode } from './entities/device.entity';

@Injectable()
export class DevicesService {
    constructor(
        @InjectRepository(Device)
        private deviceRepo: Repository<Device>,
    ) { }

    // Returns all devices, eagerly loading the field relation so callers can get field IDs
    findAll() {
        return this.deviceRepo.find({
            relations: { field: true },
            order: { lastSeen: 'DESC' },
        });
    }

    // Returns only fixed sensor nodes (NODEs) — the ones that produce telemetry readings
    findSensorNodes() {
        return this.deviceRepo.find({
            where: {
                deviceType: DeviceType.NODE,
                operatingMode: OperatingMode.FIXED,
            },
            relations: { field: true },
            order: { lastSeen: 'DESC' },
        });
    }

    // Returns only portable sensor nodes (the handheld reader the farmer carries)
    findPortableDevices() {
        return this.deviceRepo.find({
            where: {
                deviceType: DeviceType.NODE,
                operatingMode: OperatingMode.PORTABLE,
            },
            relations: { field: true },
            order: { lastSeen: 'DESC' },
        });
    }

    findOne(id: string) {
        return this.deviceRepo.findOne({ where: { id }, relations: { field: true } });
    }
}
