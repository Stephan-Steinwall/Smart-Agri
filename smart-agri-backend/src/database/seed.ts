// src/database/seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

// Import all entities
import { User, UserRole } from '../users/entities/user.entity';
import { Farm } from '../farms/entities/farm.entity';
import { Field } from '../farms/entities/field.entity';
import { Device, DeviceType, OperatingMode } from '../devices/entities/device.entity';
import { SensorReading } from '../telemetry/entities/sensor-reading.entity';
import { CropProfile } from '../crops/entities/crop-profile.entity';
import { AutomationDevice, AutomationMode } from '../automation/entities/automation-device.entity';
import { PumpLog, TriggerSource } from '../automation/entities/pump-log.entity';
import { AutomationRule, ConditionOperator } from '../automation/entities/automation-rule.entity';

// Green Valley Farms — Western Province, Sri Lanka
// Farm center: ~6.9271, 79.8612
const FARM_CENTER = { lat: 6.9271, lng: 79.8612 };

async function bootstrap() {
    console.log('🌱 Starting Advanced Database Seeder (Phase 1)...');

    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    console.log('🧹 Clearing old data (including new tables)...');
    await dataSource.query(`TRUNCATE TABLE pump_logs CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE automation_rules CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE automation_devices CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE crop_profiles CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE sensor_readings CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE devices CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE fields CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE farms CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE users CASCADE;`);

    // Repositories
    const userRepo = dataSource.getRepository(User);
    const farmRepo = dataSource.getRepository(Farm);
    const fieldRepo = dataSource.getRepository(Field);
    const deviceRepo = dataSource.getRepository(Device);
    const telemetryRepo = dataSource.getRepository(SensorReading);
    const cropRepo = dataSource.getRepository(CropProfile);
    const autoDeviceRepo = dataSource.getRepository(AutomationDevice);
    const pumpLogRepo = dataSource.getRepository(PumpLog);
    const ruleRepo = dataSource.getRepository(AutomationRule);

    console.log('🍅 Creating Crop Profiles...');
    const tomatoProfile = await cropRepo.save({
        name: 'Tomato',
        minNitrogen: 50,
        minPhosphorus: 30,
        minPotassium: 40,
        idealPhLevel: 6.2,
        minMoisturePercent: 40,
        maxSalinity: 2.5,
    });

    const chilliProfile = await cropRepo.save({
        name: 'Chilli',
        minNitrogen: 45,
        minPhosphorus: 25,
        minPotassium: 35,
        idealPhLevel: 6.0,
        minMoisturePercent: 35,
        maxSalinity: 2.0,
    });

    console.log('👨‍🌾 Creating Users, Farms, and Fields...');
    const farmer = await userRepo.save({
        email: 'farmer@smartagri.com',
        passwordHash: 'hashed_password_mock',
        role: UserRole.FARMER,
    });

    const farm = await farmRepo.save({
        name: 'Green Valley Farms',
        location: 'Western Province, Sri Lanka',
        user: farmer,
    });

    // Assigning Crop Profiles to Fields
    const fieldA = await fieldRepo.save({
        name: 'Field A - Tomatoes',
        areaSize: 2.5,
        farm: farm,
        cropProfile: tomatoProfile,
        currentHealthScore: 78, // Mock initial score
    });

    const fieldB = await fieldRepo.save({
        name: 'Field B - Chillies',
        areaSize: 1.5,
        farm: farm,
        cropProfile: chilliProfile,
        currentHealthScore: 91,
    });

    console.log('⚙️ Installing Automation Devices & Rules...');
    // Add a Water Pump to Field A
    const waterPumpA = await autoDeviceRepo.save({
        name: 'Main Water Pump',
        isOn: false,
        mode: AutomationMode.AI_AUTO, // Let AI control this!
        field: fieldA,
    });

    // Add a Nutrient Pump to Field A
    const nPumpA = await autoDeviceRepo.save({
        name: 'Nitrogen Doser',
        isOn: false,
        mode: AutomationMode.MANUAL,
        field: fieldA,
    });

    // Create an Automation Rule: If moisture < 30%, Turn ON Water Pump for 5 mins
    await ruleRepo.save({
        metric: 'moisture',
        condition: ConditionOperator.LESS_THAN,
        threshold: 30,
        actionDurationMinutes: 5,
        isActive: true,
        field: fieldA,
        targetDevice: waterPumpA,
    });

    console.log('📡 Provisioning IoT Devices (Fixed & Portable) with GPS coordinates...');

    // Central Hub — located near farm entrance
    const hub = await deviceRepo.save({
        macAddress: 'AA:BB:CC:DD:EE:01',
        alias: 'Central Hub',
        deviceType: DeviceType.HUB,
        operatingMode: OperatingMode.FIXED,
        isOnline: true,
        batteryStatus: 100,
        loraSignalStrength: -55,
        latitude: FARM_CENTER.lat,
        longitude: FARM_CENTER.lng,
        field: fieldA,
    });

    // Fixed Sensor Node Alpha — buried in Field A (Tomatoes), ~100m north-west
    const node1 = await deviceRepo.save({
        macAddress: 'AA:BB:CC:DD:EE:02',
        alias: 'Sensor Node Alpha',
        deviceType: DeviceType.NODE,
        operatingMode: OperatingMode.FIXED,
        isOnline: true,
        batteryStatus: 85,
        loraSignalStrength: -68,
        latitude: FARM_CENTER.lat + 0.0008,  // ~90m north
        longitude: FARM_CENTER.lng - 0.0006, // ~60m west
        field: fieldA,
    });

    // Fixed Sensor Node Beta — buried in Field B (Chillies), ~200m south-east
    const node2 = await deviceRepo.save({
        macAddress: 'AA:BB:CC:DD:EE:04',
        alias: 'Sensor Node Beta',
        deviceType: DeviceType.NODE,
        operatingMode: OperatingMode.FIXED,
        isOnline: true,
        batteryStatus: 72,
        loraSignalStrength: -79,
        latitude: FARM_CENTER.lat - 0.0015, // ~165m south
        longitude: FARM_CENTER.lng + 0.0012, // ~120m east
        field: fieldB,
    });

    // Portable Reader — the handheld reader the farmer carries for spot-checks
    const portableReader = await deviceRepo.save({
        macAddress: 'AA:BB:CC:DD:EE:03',
        alias: 'Portable Reader',
        deviceType: DeviceType.NODE,
        operatingMode: OperatingMode.PORTABLE,
        isOnline: true,
        batteryStatus: 92,
        latitude: FARM_CENTER.lat + 0.0003,
        longitude: FARM_CENTER.lng + 0.0004,
    });

    console.log('📈 Generating Time-Series Data (Fixed Node Alpha) & Pump Logs...');
    const readings: SensorReading[] = [];
    const logs: PumpLog[] = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    let currentMoisture = 50;
    let currentN = 55;

    for (let d = new Date(startDate); d <= endDate; d.setMinutes(d.getMinutes() + 15)) {
        const hour = d.getHours();

        currentMoisture -= 0.15;
        if (hour >= 10 && hour <= 15) currentMoisture -= 0.2;

        // Simulate our Rule Engine: If moisture drops below 30, the pump turns on!
        if (currentMoisture < 30) {
            currentMoisture = 85; // Soil is wet again

            // Log the pump action
            logs.push(pumpLogRepo.create({
                action: true,
                durationMinutes: 5,
                triggeredBy: TriggerSource.RULE_ENGINE,
                timestamp: new Date(d),
                device: waterPumpA,
            }));
        }

        currentN -= 0.05;

        readings.push(
            telemetryRepo.create({
                time: new Date(d),
                deviceId: node1.id,
                temperature: parseFloat((26 + 6 * Math.sin(((hour - 8) / 24) * 2 * Math.PI)).toFixed(2)),
                moisture: parseFloat(currentMoisture.toFixed(2)),
                nitrogen: parseFloat(currentN.toFixed(2)),
                phosphorus: 35,
                potassium: 42,
                ph: parseFloat((6.2 + (Math.random() * 0.2 - 0.1)).toFixed(2)),
                electricalConductivity: 1.8,
                batteryLevel: 85,
            })
        );
    }

    console.log('📈 Generating Portable Reader Spot-Check Readings (last 24h)...');
    // Simulate 8 spot-checks the farmer took yesterday across the farm
    const spotCheckOffsets = [
        { latOff: 0.0005, lngOff: -0.0003 },
        { latOff: 0.0010, lngOff: 0.0002 },
        { latOff: -0.0005, lngOff: 0.0008 },
        { latOff: 0.0002, lngOff: 0.0010 },
        { latOff: -0.0008, lngOff: -0.0002 },
        { latOff: 0.0012, lngOff: -0.0005 },
        { latOff: -0.0003, lngOff: 0.0015 },
        { latOff: 0.0007, lngOff: 0.0007 },
    ];

    for (let i = 0; i < spotCheckOffsets.length; i++) {
        const checkTime = new Date();
        checkTime.setHours(checkTime.getHours() - (i * 2 + 1)); // Every 2 hours over past 16h

        readings.push(
            telemetryRepo.create({
                time: checkTime,
                deviceId: portableReader.id,
                temperature: parseFloat((24 + Math.random() * 8).toFixed(2)),
                moisture: parseFloat((35 + Math.random() * 30).toFixed(2)),
                nitrogen: parseFloat((40 + Math.random() * 20).toFixed(2)),
                phosphorus: parseFloat((28 + Math.random() * 14).toFixed(2)),
                potassium: parseFloat((35 + Math.random() * 15).toFixed(2)),
                ph: parseFloat((5.8 + Math.random() * 0.8).toFixed(2)),
                electricalConductivity: parseFloat((1.4 + Math.random() * 0.8).toFixed(2)),
                batteryLevel: 92,
            })
        );
    }

    // Insert Readings
    const chunkSize = 2000;
    for (let i = 0; i < readings.length; i += chunkSize) {
        await telemetryRepo.save(readings.slice(i, i + chunkSize));
    }

    // Insert Pump Logs
    await pumpLogRepo.save(logs);

    console.log('✅ Phase 1 Seeding Complete! The system is now Automation and AI ready.');

    console.log('\n======================================================');
    console.log('🚀 DEVELOPMENT TESTING UUIDs (Copy-paste these!)');
    console.log('======================================================');
    console.log(`🍅 Tomato Field ID:      ${fieldA.id}`);
    console.log(`🌶️ Chilli Field ID:      ${fieldB.id}`);
    console.log(`🏛️ Central Hub ID:       ${hub.id}`);
    console.log(`📡 Fixed Node Alpha ID:  ${node1.id}`);
    console.log(`📡 Fixed Node Beta ID:   ${node2.id}`);
    console.log(`📱 Portable Node ID:     ${portableReader.id}`);
    console.log('======================================================\n');
    await app.close();
}

bootstrap().catch((err) => {
    console.error('❌ Seeding Failed:', err);
    process.exit(1);
});