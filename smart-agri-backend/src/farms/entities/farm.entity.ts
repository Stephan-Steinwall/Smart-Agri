// src/farms/entities/farm.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Field } from '../../farms/entities/field.entity';

@Entity('farms')
export class Farm {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    location: string;

    @CreateDateColumn()
    createdAt: Date;

    // Many Farms belong to One User
    @ManyToOne(() => User, (user) => user.farms, { onDelete: 'CASCADE' })
    user: User;

    // One Farm has Many Fields
    @OneToMany(() => Field, (field) => field.farm)
    fields: Field[];
}