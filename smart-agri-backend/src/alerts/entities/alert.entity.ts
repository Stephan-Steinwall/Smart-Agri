// src/alerts/entities/alert.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Field } from '../../farms/entities/field.entity';

export enum AlertSeverity {
    INFO = 'INFO',
    WARNING = 'WARNING',
    CRITICAL = 'CRITICAL',
}

@Entity('alerts')
export class Alert {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    message: string;

    @Column({ type: 'enum', enum: AlertSeverity })
    severity: AlertSeverity;

    @Column({ type: 'boolean', default: false })
    isRead: boolean;

    @CreateDateColumn()
    timestamp: Date;

    @ManyToOne(() => Field, { nullable: true, onDelete: 'CASCADE' })
    field: Field; // Nullable because a Hub going offline isn't always tied to just one field
}