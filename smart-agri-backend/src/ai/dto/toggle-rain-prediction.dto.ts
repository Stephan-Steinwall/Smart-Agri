import { IsBoolean } from 'class-validator';

export class ToggleRainPredictionDto {
  @IsBoolean()
  enabled: boolean;
}
