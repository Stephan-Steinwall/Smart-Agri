import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Field } from '../../farms/entities/field.entity';

@Entity('crop_profiles')
export class CropProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string; // e.g., 'Tomato', 'Paddy', 'Chilli'

    // Ideal NPK ranges (in mg/kg or ppm)
    @Column({ type: 'float' })
    minNitrogen: number;

    @Column({ type: 'float' })
    minPhosphorus: number;

    @Column({ type: 'float' })
    minPotassium: number;

    // Ideal Soil Conditions
    @Column({ type: 'float' })
    idealPhLevel: number;

    @Column({ type: 'float' })
    minMoisturePercent: number;

    @Column({ type: 'float' })
    maxSalinity: number;

    // One crop profile can be assigned to many fields
    @OneToMany(() => Field, (field) => field.cropProfile)
    fields: Field[];
}