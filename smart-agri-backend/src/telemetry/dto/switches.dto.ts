import { IsBoolean, IsIn } from 'class-validator';

const VALID_SWITCHES = [
  'pump_water',
  'pump_nitrogen',
  'pump_phosphorus',
  'pump_potassium',
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
