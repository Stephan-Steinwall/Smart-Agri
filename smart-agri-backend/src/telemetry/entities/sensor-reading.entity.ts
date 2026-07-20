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
    salinity: number | null;
    tds: number | null;
    soilConductivity: number | null;
    electricalConductivity: number | null;

    // Power and connectivity
    batteryVoltage: number | null;
    batteryStatus: string | null;
    receiverWifiConnected: boolean | null;
    receiverWifiSignalStrength: number | null;
    receiverWifiQuality: string | null;
    sensorStatus: string | null;
    receiverUptimeMinutes: number | null;
    receiverUptimeSeconds: number | null;

    // Derived soil health
    soilHealthScore: number | null;
}
