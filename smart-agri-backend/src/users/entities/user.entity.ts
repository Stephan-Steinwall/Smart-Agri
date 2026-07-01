// src/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Farm } from '../../farms/entities/farm.entity';

export enum UserRole {
    ADMIN = 'ADMIN',
    FARMER = 'FARMER',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column()
    passwordHash: string; // Will store the hashed password or Firebase UID

    @Column({ type: 'enum', enum: UserRole, default: UserRole.FARMER })
    role: UserRole;

    @CreateDateColumn()
    createdAt: Date;

    // A User can have multiple Farms
    @OneToMany(() => Farm, (farm) => farm.user)
    farms: Farm[];
}