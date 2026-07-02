// src/devices/entities/device.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, UpdateDateColumn } from 'typeorm';
import { Field } from '../../farms/entities/field.entity';

export enum DeviceType {
    HUB = 'HUB',
    NODE = 'NODE',
}

export enum OperatingMode {
    PORTABLE = 'PORTABLE', // Carried around by the farmer
    FIXED = 'FIXED',       // Stuck in the ground permanently
}

@Entity('devices')
export class Device {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    macAddress: string;

    @Column({ nullable: true })
    alias: string; // Human-readable name, e.g. "Sensor Node Alpha"

    @Column({ type: 'enum', enum: DeviceType })
    deviceType: DeviceType;

    @Column({ type: 'boolean', default: false })
    isOnline: boolean;

    @Column({ type: 'float', nullable: true })
    batteryStatus: number;

    @Column({ type: 'enum', enum: OperatingMode, default: OperatingMode.FIXED })
    operatingMode: OperatingMode;

    @Column({ type: 'float', nullable: true })
    loraSignalStrength: number; // dBm, e.g. -75

    @Column({ type: 'float', nullable: true })
    latitude: number; // GPS latitude for map pins

    @Column({ type: 'float', nullable: true })
    longitude: number; // GPS longitude for map pins

    @UpdateDateColumn()
    lastSeen: Date;

    // Many Devices belong to One Field
    @ManyToOne(() => Field, (field) => field.devices, { onDelete: 'SET NULL', nullable: true })
    field: Field | null;
}