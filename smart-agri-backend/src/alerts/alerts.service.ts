// src/alerts/alerts.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertSeverity } from './entities/alert.entity';
import { Device } from '../devices/entities/device.entity';

@Injectable()
export class AlertsService {
    private readonly logger = new Logger(AlertsService.name);

    constructor(
        @InjectRepository(Alert) private alertRepo: Repository<Alert>,
        @InjectRepository(Device) private deviceRepo: Repository<Device>,
    ) { }

    // Get all unread alerts for the frontend
    async getUnreadAlerts() {
        return this.alertRepo.find({
            where: { isRead: false },
            order: { timestamp: 'DESC' },
            take: 10,
        });
    }

    async markAsRead(id: string) {
        await this.alertRepo.update(id, { isRead: true });
        return { success: true };
    }

    // --- THE WATCHDOG (Runs automatically every 5 minutes) ---
    @Cron(CronExpression.EVERY_5_MINUTES)
    async checkSystemHealth() {
        this.logger.log('🔍 Running System Health Watchdog...');

        const devices = await this.deviceRepo.find({ relations: { field: true } });
        const now = new Date().getTime();

        for (const device of devices) {
            // 1. Check Battery Level
            if (device.batteryStatus !== null && device.batteryStatus < 20) {
                await this.createAlert(
                    `Low Battery (${device.batteryStatus}%) on Device ${device.macAddress}`,
                    AlertSeverity.WARNING,
                    device.field?.id,
                );
            }

            // 2. Check Offline Status (If hasn't reported data in > 30 minutes)
            // Assuming 'lastSeen' is updated every time data comes in
            if (device.lastSeen) {
                const minutesSinceLastSeen = (now - new Date(device.lastSeen).getTime()) / (1000 * 60);

                if (minutesSinceLastSeen > 30 && device.isOnline) {
                    // Mark device as offline in the DB
                    device.isOnline = false;
                    await this.deviceRepo.save(device);

                    await this.createAlert(
                        `Device ${device.macAddress} went OFFLINE. Last seen ${Math.floor(minutesSinceLastSeen)} mins ago.`,
                        AlertSeverity.CRITICAL,
                        device.field?.id,
                    );
                }
            }
        }
    }

    // Helper to prevent spamming the exact same alert every 5 minutes
    private async createAlert(message: string, severity: AlertSeverity, fieldId?: string) {
        // Check if this exact unread message already exists
        const existing = await this.alertRepo.findOne({ where: { message, isRead: false } });
        if (existing) return;

        const alert = this.alertRepo.create({ message, severity, field: { id: fieldId } });
        await this.alertRepo.save(alert);
        this.logger.warn(`🚨 New Alert Generated: ${message}`);
    }
}