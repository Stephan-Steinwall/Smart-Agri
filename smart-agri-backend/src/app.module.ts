import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { User } from './users/entities/user.entity';
import { Farm } from './farms/entities/farm.entity';
import { Field } from './farms/entities/field.entity';
import { Device } from './devices/entities/device.entity';
import { SensorReading } from './telemetry/entities/sensor-reading.entity';
import { TelemetryModule } from './telemetry/telemetry.module';
import { DevicesModule } from './devices/devices.module';
import { AiModule } from './ai/ai.module';
import { CropProfile } from './crops/entities/crop-profile.entity';
import { AutomationDevice } from './automation/entities/automation-device.entity';
import { AutomationRule } from './automation/entities/automation-rule.entity';
import { PumpLog } from './automation/entities/pump-log.entity';
import { AutomationModule } from './automation/automation.module';
import { ScheduleModule } from '@nestjs/schedule';
import { Alert } from './alerts/entities/alert.entity';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'superuser',
      database: 'smart_agri_db',
      entities: [User, Farm, Field, Device, SensorReading, CropProfile, AutomationDevice, AutomationRule, PumpLog, Alert],

      // Auto-creates database tables based on your entities.
      // NOTE: Keep this 'true' for development, but 'false' in production!
      synchronize: true,

      // Uncomment the line below if you want to see the raw SQL queries in your terminal
      // logging: true, 
    }),

    TelemetryModule,
    DevicesModule,
    AiModule,
    AutomationModule,
    AlertsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements OnModuleInit {
  constructor(private dataSource: DataSource) { }

  // 3. Lifecycle hook to initialize TimescaleDB Hypertable
  async onModuleInit() {
    console.log('Database connected. Checking TimescaleDB extensions...');

    try {
      // Ensure the TimescaleDB extension is active
      await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);

      // Convert the standard sensor_readings table into a TimescaleDB Hypertable
      // partitioned by the 'time' column.
      await this.dataSource.query(`
        SELECT create_hypertable(
          'sensor_readings', 
          'time', 
          if_not_exists => TRUE
        );
      `);
      console.log('✅ TimescaleDB Hypertable initialized for sensor_readings.');
    } catch (error) {
      console.error('⚠️ Error initializing TimescaleDB:', error.message);
    }
  }
}