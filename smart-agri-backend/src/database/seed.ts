import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { Farm } from '../farms/entities/farm.entity';
import { Field } from '../farms/entities/field.entity';
import { Device, DeviceType } from '../devices/entities/device.entity';
import { SensorReading } from '../telemetry/entities/sensor-reading.entity';

async function bootstrap() {
    console.log('🌱 Starting Database Seeder...');

    // Create a standalone application context (doesn't start the HTTP server)
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    console.log('🧹 Clearing old data...');
    // Clear tables in reverse order of relationships to avoid foreign key constraints
    await dataSource.query(`TRUNCATE TABLE sensor_readings CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE devices CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE fields CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE farms CASCADE;`);
    await dataSource.query(`TRUNCATE TABLE users CASCADE;`);

    console.log('👨‍🌾 Creating Users, Farms, and Fields...');

    const userRepository = dataSource.getRepository(User);
    const farmRepository = dataSource.getRepository(Farm);
    const fieldRepository = dataSource.getRepository(Field);
    const deviceRepository = dataSource.getRepository(Device);
    const telemetryRepository = dataSource.getRepository(SensorReading);

    // 1. Create User
    const farmer = await userRepository.save({
        email: 'farmer@smartagri.com',
        passwordHash: 'hashed_password_mock',
        role: UserRole.FARMER,
    });

    // 2. Create Farm
    const farm = await farmRepository.save({
        name: 'Green Valley Farms',
        location: 'Western Province, Sri Lanka',
        user: farmer,
    });

    // 3. Create Field
    const tomatoField = await fieldRepository.save({
        name: 'North Tomato Patch',
        cropType: 'Tomatoes',
        areaSize: 2.5,
        farm: farm,
    });

    // 4. Create Devices (1 Hub, 1 Sensor Node)
    const hub = await deviceRepository.save({
        macAddress: 'AA:BB:CC:DD:EE:01',
        deviceType: DeviceType.HUB,
        isOnline: true,
        batteryStatus: 100,
        field: tomatoField,
    });

    const node1 = await deviceRepository.save({
        macAddress: 'AA:BB:CC:DD:EE:02',
        deviceType: DeviceType.NODE,
        isOnline: true,
        batteryStatus: 85,
        field: tomatoField,
    });

    console.log('📈 Generating 3 Months of Realistic Time-Series Data...');

    const readings: SensorReading[] = [];
    const endDate = new Date(); // Today
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 90); // 90 days ago

    let currentMoisture = 65; // Starting moisture
    let currentN = 50; // Starting Nitrogen
    let currentP = 30; // Starting Phosphorus
    let currentK = 40; // Starting Potassium

    // Generate data in 15-minute intervals
    for (let d = new Date(startDate); d <= endDate; d.setMinutes(d.getMinutes() + 15)) {
        const hour = d.getHours();

        // Simulate Temperature (Sine wave: peaks around 2 PM, lowest at 4 AM)
        const baseTemp = 26;
        const tempFluctuation = 6;
        const temperature = baseTemp + tempFluctuation * Math.sin(((hour - 8) / 24) * 2 * Math.PI);

        // Simulate Moisture (Drops steadily, spikes when irrigated)
        currentMoisture -= 0.15; // Slow evaporation
        if (hour >= 10 && hour <= 15) currentMoisture -= 0.2; // Faster evaporation midday
        if (currentMoisture < 25) currentMoisture = 85; // IRRIGATION EVENT (spikes back to 85%)

        // Simulate NPK (Slowly depletes, spikes slightly after "fertilizing")
        currentN -= 0.01;
        currentP -= 0.005;
        currentK -= 0.008;
        if (currentN < 20) { currentN = 70; currentP = 40; currentK = 50; } // FERTILIZER EVENT

        readings.push(
            telemetryRepository.create({
                time: new Date(d),
                deviceId: node1.id,
                temperature: parseFloat(temperature.toFixed(2)),
                moisture: parseFloat(currentMoisture.toFixed(2)),
                nitrogen: parseFloat(currentN.toFixed(2)),
                phosphorus: parseFloat(currentP.toFixed(2)),
                potassium: parseFloat(currentK.toFixed(2)),
                ph: 6.2 + (Math.random() * 0.4 - 0.2), // Stable pH around 6.2
                electricalConductivity: 1.2 + (Math.random() * 0.1),
                batteryLevel: 100 - ((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) % 100, // drops to 0, resets to 100
            })
        );
    }

    console.log(`💾 Inserting ${readings.length} records into TimescaleDB...`);

    // Bulk insert in chunks to avoid memory overflow (PostgreSQL limits parameters per query)
    const chunkSize = 2000;
    for (let i = 0; i < readings.length; i += chunkSize) {
        const chunk = readings.slice(i, i + chunkSize);
        await telemetryRepository.save(chunk);
        console.log(`... Inserted chunk ${Math.floor(i / chunkSize) + 1} / ${Math.ceil(readings.length / chunkSize)}`);
    }

    console.log('✅ Seeding Complete! Your database is now populated with AI-ready agronomy data.');
    await app.close();
}

bootstrap().catch((err) => {
    console.error('❌ Seeding Failed:', err);
    process.exit(1);
});