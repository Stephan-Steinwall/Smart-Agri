// src/farms/entities/field.entity.ts (Update existing)
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Farm } from './farm.entity';
import { Device } from '../../devices/entities/device.entity';
import { CropProfile } from '../../crops/entities/crop-profile.entity';
import { AutomationDevice } from '../../automation/entities/automation-device.entity';

@Entity('fields')
export class Field {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ type: 'float', nullable: true })
    areaSize: number;

    @Column({ type: 'float', nullable: true })
    currentHealthScore: number; // e.g., 78.5 (Calculated by the backend)

    // RELATIONSHIPS
    @ManyToOne(() => Farm, (farm) => farm.fields, { onDelete: 'CASCADE' })
    farm: Farm;

    @ManyToOne(() => CropProfile, (profile) => profile.fields, { nullable: true })
    cropProfile: CropProfile;

    @OneToMany(() => Device, (device) => device.field)
    devices: Device[];

    @OneToMany(() => AutomationDevice, (autoDevice) => autoDevice.field)
    automationDevices: AutomationDevice[];
}