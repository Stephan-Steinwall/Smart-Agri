// src/automation/entities/pump-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { AutomationDevice } from './automation-device.entity';

export enum TriggerSource {
    USER = 'USER',
    RULE_ENGINE = 'RULE_ENGINE',
    AI = 'AI',
}

@Entity('pump_logs')
export class PumpLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'boolean' })
    action: boolean; // true = ON, false = OFF

    @Column({ type: 'int', nullable: true })
    durationMinutes: number; // e.g., ran for 2 minutes

    @Column({ type: 'enum', enum: TriggerSource })
    triggeredBy: TriggerSource;

    @CreateDateColumn()
    timestamp: Date;

    @ManyToOne(() => AutomationDevice, (device) => device.logs, { onDelete: 'CASCADE' })
    device: AutomationDevice;
}