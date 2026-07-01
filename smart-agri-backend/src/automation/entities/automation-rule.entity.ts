// src/automation/entities/automation-rule.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Field } from '../../farms/entities/field.entity';
import { AutomationDevice } from './automation-device.entity';

export enum ConditionOperator {
    LESS_THAN = '<',
    GREATER_THAN = '>',
}

@Entity('automation_rules')
export class AutomationRule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    metric: string; // e.g., 'moisture', 'nitrogen'

    @Column({ type: 'enum', enum: ConditionOperator })
    condition: ConditionOperator;

    @Column({ type: 'float' })
    threshold: number; // e.g., 30

    @Column({ type: 'int' })
    actionDurationMinutes: number; // How long to turn the pump on

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @ManyToOne(() => Field, { onDelete: 'CASCADE' })
    field: Field;

    @ManyToOne(() => AutomationDevice, { onDelete: 'CASCADE' })
    targetDevice: AutomationDevice;
}