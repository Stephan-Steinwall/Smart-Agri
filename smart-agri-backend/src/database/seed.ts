// src/database/seed.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  console.log('🌱 Starting Supabase Seeder (Minimal Backend)...');

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Cannot seed.',
    );
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(
    '🧹 Clearing old data (requires RLS bypass or TRUNCATE in SQL)...',
  );
  // We cannot TRUNCATE from the JS client easily due to permissions unless we use rpc.
  // Assuming the user runs the schema first. We'll just insert new data.

  const deviceId = 'agribot_receiver_01';
  const sessionId = 'farmer_session_123';

  console.log(`📈 Generating Time-Series Data for Device: ${deviceId}...`);
  const supabaseReadings: any[] = [];
  let latestRecord: any = null;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 2); // Just 2 days of history to be fast

  let currentMoisture = 50;

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setMinutes(d.getMinutes() + 15)
  ) {
    currentMoisture -= 0.15;
    if (currentMoisture < 20) currentMoisture = 80; // simulate watering

    const record = {
      device_id: deviceId,
      created_at: new Date(d).toISOString(),
      source: 'Seeder script',
      packet_format: 'Legacy',
      battery_status: 'Normal',
      battery_voltage: 12.0,
      soil_moisture_percent: parseFloat(currentMoisture.toFixed(2)),
      soil_temperature_celsius: 25.5,
      nitrogen: 45,
      phosphorus: 35,
      potassium: 42,
      soil_ph: 6.2,
      ec_levels: 1.8,
      received_uptime_ms: 123456,
    };

    supabaseReadings.push(record);
    latestRecord = { ...record, updated_at: record.created_at };
  }

  // Insert Readings into Supabase (Batch insert)
  console.log(`Inserting ${supabaseReadings.length} historical readings...`);
  const chunkSize = 1000;
  for (let i = 0; i < supabaseReadings.length; i += chunkSize) {
    const chunk = supabaseReadings.slice(i, i + chunkSize);
    const { error } = await supabase.from('soil_readings').insert(chunk);
    if (error) {
      console.error('Error inserting soil_readings chunk:', error);
    }
  }

  if (latestRecord) {
    console.log('Inserting latest reading...');
    const { error } = await supabase
      .from('latest_soil_reading')
      .upsert(latestRecord, { onConflict: 'device_id' });
    if (error) {
      console.error('Error inserting latest_soil_reading:', error);
    }
  }

  console.log('💬 Generating Mock AI Chat History...');
  const chatHistory = [
    {
      session_id: sessionId,
      role: 'user',
      content: 'How is my soil looking today?',
    },
    {
      session_id: sessionId,
      role: 'assistant',
      content:
        'Based on the latest data, your soil moisture is optimal, but nitrogen levels are dropping slightly. Monitor it over the next 48 hours.',
    },
  ];

  const { error: chatError } = await supabase
    .from('ai_chat_history')
    .insert(chatHistory);
  if (chatError) {
    console.error('Error inserting chat history:', chatError);
  }

  console.log('✅ Seeding Complete!');
  console.log('\n======================================================');
  console.log('🚀 DEVELOPMENT TESTING IDs');
  console.log('======================================================');
  console.log(`📡 Device ID:  ${deviceId}`);
  console.log(`💬 Session ID: ${sessionId}`);
  console.log('======================================================\n');
}

bootstrap().catch((err) => {
  console.error('❌ Seeding Failed:', err);
  process.exit(1);
});
