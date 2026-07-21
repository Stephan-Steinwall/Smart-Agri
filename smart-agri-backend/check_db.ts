import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('environment_sensor_readings').select('device_id').order('recorded_at', { ascending: false }).limit(10);
  console.log('environment_sensor_readings:', data);

  const { data: data2, error: err2 } = await supabase.from('soil_readings').select('device_id').order('timestamp', { ascending: false }).limit(10);
  console.log('soil_readings:', data2);
}
run();
