// src/farms/entities/field.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Farm } from '../../farms/entities/farm.entity';
import { Device } from '../../devices/entities/device.entity';

@Entity('fields')
export class Field {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string; // e.g., "North Tomato Patch"

    @Column({ nullable: true })
    cropType: string;

    @Column({ type: 'float', nullable: true })
    areaSize: number; // in acres or hectares

    // Many Fields belong to One Farm
    @ManyToOne(() => Farm, (farm) => farm.fields, { onDelete: 'CASCADE' })
    farm: Farm;

    // One Field has Many Devices
    @OneToMany(() => Device, (device) => device.field)
    devices: Device[];
}