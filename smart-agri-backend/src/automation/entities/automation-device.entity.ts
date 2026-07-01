// src/automation/entities/automation-device.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Field } from '../../farms/entities/field.entity';
import { PumpLog } from './pump-log.entity';

export enum AutomationMode {
    MANUAL = 'MANUAL',
    RULE_AUTO = 'RULE_AUTO',
    AI_AUTO = 'AI_AUTO',
}

@Entity('automation_devices')
export class AutomationDevice {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string; // e.g., 'Main Water Pump', 'Nitrogen Doser'

    @Column({ type: 'boolean', default: false })
    isOn: boolean;

    @Column({ type: 'enum', enum: AutomationMode, default: AutomationMode.MANUAL })
    mode: AutomationMode;

    @ManyToOne(() => Field, (field) => field.automationDevices, { onDelete: 'CASCADE' })
    field: Field;

    @OneToMany(() => PumpLog, (pumpLog) => pumpLog.device)
    logs: PumpLog[];
}