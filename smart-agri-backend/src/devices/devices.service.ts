import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';

@Injectable()
export class DevicesService {
    constructor(
        @InjectRepository(Device)
        private deviceRepo: Repository<Device>,
    ) { }

    findAll() {
        return this.deviceRepo.find({ order: { lastSeen: 'DESC' } });
    }

    findOne(id: string) {
        return this.deviceRepo.findOneBy({ id });
    }
}
