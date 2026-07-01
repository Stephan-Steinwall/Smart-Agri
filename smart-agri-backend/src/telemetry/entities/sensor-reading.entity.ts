import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('sensor_readings')
// We index by device_id and time (descending) for lightning-fast dashboard queries
@Index(['deviceId', 'time'])
export class SensorReading {

    @PrimaryColumn({ type: 'timestamptz' })
    time: Date;

    @PrimaryColumn({ type: 'uuid' })
    deviceId: string;

    // NPK Values
    @Column({ type: 'float', nullable: true })
    nitrogen: number;

    @Column({ type: 'float', nullable: true })
    phosphorus: number;

    @Column({ type: 'float', nullable: true })
    potassium: number;

    // Soil Conditions
    @Column({ type: 'float', nullable: true })
    moisture: number;

    @Column({ type: 'float', nullable: true })
    temperature: number;

    @Column({ type: 'float', nullable: true })
    ph: number;

    // Electrical Data
    @Column({ type: 'float', nullable: true })
    electricalConductivity: number;

    @Column({ type: 'float', nullable: true })
    batteryLevel: number;
}