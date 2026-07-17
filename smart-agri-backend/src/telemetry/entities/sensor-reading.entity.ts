export interface SensorReading {
    time: Date;
    deviceId: string;

    // NPK Values
    nitrogen: number | null;
    phosphorus: number | null;
    potassium: number | null;

    // Soil Conditions
    moisture: number | null;
    temperature: number | null;
    ph: number | null;

    // Electrical Data
    electricalConductivity: number | null;
    batteryLevel: number | null;
}