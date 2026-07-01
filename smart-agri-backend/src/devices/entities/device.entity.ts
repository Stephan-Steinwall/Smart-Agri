// src/devices/entities/device.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, UpdateDateColumn } from 'typeorm';
import { Field } from '../../farms/entities/field.entity';

export enum DeviceType {
    HUB = 'HUB',
    NODE = 'NODE',
}

@Entity('devices')
export class Device {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    macAddress: string;

    @Column({ type: 'enum', enum: DeviceType })
    deviceType: DeviceType;

    @Column({ type: 'boolean', default: false })
    isOnline: boolean;

    @Column({ type: 'float', nullable: true })
    batteryStatus: number;

    @UpdateDateColumn()
    lastSeen: Date;

    // Many Devices belong to One Field
    @ManyToOne(() => Field, (field) => field.devices, { onDelete: 'SET NULL' })
    field: Field;
}