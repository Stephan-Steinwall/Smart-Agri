import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device, DeviceType, OperatingMode } from './entities/device.entity';
import { Field } from '../farms/entities/field.entity';

export class CreateDeviceDto {
    macAddress: string;
    alias?: string;
    deviceType: DeviceType;
    operatingMode: OperatingMode;
    fieldId?: string | null;
    latitude?: number;
    longitude?: number;
    loraSignalStrength?: number;
}

export class UpdateDeviceDto {
    alias?: string;
    fieldId?: string | null;
    operatingMode?: OperatingMode;
    latitude?: number;
    longitude?: number;
    loraSignalStrength?: number;
    isOnline?: boolean;
    batteryStatus?: number;
}

@Injectable()
export class DevicesService {
    constructor(
        @InjectRepository(Device)
        private deviceRepo: Repository<Device>,
        @InjectRepository(Field)
        private fieldRepo: Repository<Field>,
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

    // Provision a brand new hardware device into the platform
    async create(dto: CreateDeviceDto): Promise<Device> {
        let field: Field | undefined = undefined;
        if (dto.fieldId) {
            const foundField = await this.fieldRepo.findOne({ where: { id: dto.fieldId } });
            if (foundField) field = foundField;
        }

        const device = this.deviceRepo.create({
            macAddress: dto.macAddress,
            alias: dto.alias ?? undefined,
            deviceType: dto.deviceType,
            operatingMode: dto.operatingMode,
            isOnline: false,
            batteryStatus: undefined,
            loraSignalStrength: dto.loraSignalStrength ?? undefined,
            latitude: dto.latitude ?? undefined,
            longitude: dto.longitude ?? undefined,
            field: field,
        });

        return this.deviceRepo.save(device);
    }

    // Update an existing device (reassign field, change alias, update telemetry, etc.)
    async update(id: string, dto: UpdateDeviceDto): Promise<Device> {
        const device = await this.deviceRepo.findOne({ where: { id }, relations: { field: true } });
        if (!device) throw new NotFoundException(`Device ${id} not found`);

        if (dto.alias !== undefined) device.alias = dto.alias;
        if (dto.operatingMode !== undefined) device.operatingMode = dto.operatingMode;
        if (dto.latitude !== undefined) device.latitude = dto.latitude;
        if (dto.longitude !== undefined) device.longitude = dto.longitude;
        if (dto.loraSignalStrength !== undefined) device.loraSignalStrength = dto.loraSignalStrength;
        if (dto.isOnline !== undefined) device.isOnline = dto.isOnline;
        if (dto.batteryStatus !== undefined) device.batteryStatus = dto.batteryStatus;

        // Field reassignment (can set to null to un-assign)
        if ('fieldId' in dto) {
            if (dto.fieldId === null) {
                device.field = null;
            } else if (dto.fieldId) {
                const field = await this.fieldRepo.findOne({ where: { id: dto.fieldId } });
                device.field = field;
            }
        }

        return this.deviceRepo.save(device);
    }

    // Decommission / remove a device from the platform
    async delete(id: string): Promise<{ success: boolean }> {
        const device = await this.deviceRepo.findOne({ where: { id } });
        if (!device) throw new NotFoundException(`Device ${id} not found`);
        await this.deviceRepo.remove(device);
        return { success: true };
    }
}
