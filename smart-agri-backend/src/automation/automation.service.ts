import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationDevice } from './entities/automation-device.entity';
import { PumpLog, TriggerSource } from './entities/pump-log.entity';

@Injectable()
export class AutomationService {
    constructor(
        @InjectRepository(AutomationDevice)
        private autoDeviceRepo: Repository<AutomationDevice>,
        @InjectRepository(PumpLog)
        private pumpLogRepo: Repository<PumpLog>,
    ) { }

    // 1. Fetch all pumps and their history for a specific field
    async getDevicesForField(fieldId: string) {
        return this.autoDeviceRepo.find({
            where: { field: { id: fieldId } },
            relations: { logs: true }, // Bring the history logs with it
            order: { name: 'ASC' },
        });
    }

    // 2. The Manual Toggle Logic
    async toggleDevice(deviceId: string, turnOn: boolean) {
        const device = await this.autoDeviceRepo.findOne({ where: { id: deviceId } });
        if (!device) throw new NotFoundException('Device not found');

        // Update the device status
        device.isOn = turnOn;
        await this.autoDeviceRepo.save(device);

        // Create an un-editable audit log of who did this
        const log = this.pumpLogRepo.create({
            action: turnOn,
            triggeredBy: TriggerSource.USER, // Because the farmer clicked the button
            device: device,
        });
        await this.pumpLogRepo.save(log);

        // IMPORTANT: In the future, this is exactly where you will add the code 
        // to push a message to Firebase/MQTT to physically turn the ESP32 relay ON!

        return { success: true, device, message: `Device turned ${turnOn ? 'ON' : 'OFF'}` };
    }
}