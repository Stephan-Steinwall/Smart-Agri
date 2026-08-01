import { IsBoolean, IsIn, IsInt, Min, Max } from 'class-validator';

const VALID_SWITCHES = [
  'pump_water',
  'pump_nitrogen',
  'pump_phosphorus',
  'pump_potassium',
  'pump_mister',
  'system_switch',
  'light_01',
  'light_02',
] as const;

export class ToggleSwitchDto {
  @IsIn(VALID_SWITCHES)
  pumpName: string;

  @IsBoolean()
  state: boolean;
}

export class UpdateThresholdsDto {
  @IsInt()
  @Min(0)
  @Max(100)
  moisture_threshold_low: number;

  @IsInt()
  @Min(0)
  @Max(100)
  moisture_threshold_high: number;

  @IsInt()
  @Min(0)
  @Max(100)
  nitrogen_threshold_low: number;

  @IsInt()
  @Min(0)
  @Max(100)
  nitrogen_threshold_high: number;

  @IsInt()
  @Min(0)
  @Max(100)
  phosphorus_threshold_low: number;

  @IsInt()
  @Min(0)
  @Max(100)
  phosphorus_threshold_high: number;

  @IsInt()
  @Min(0)
  @Max(100)
  potassium_threshold_low: number;

  @IsInt()
  @Min(0)
  @Max(100)
  potassium_threshold_high: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  light_intensity_threshold_lux: number;

  @IsInt()
  @Min(0)
  @Max(100)
  humidity_threshold_percent: number;
}
