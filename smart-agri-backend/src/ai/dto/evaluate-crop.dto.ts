import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Inline soil metrics for evaluating a saved/historical sample instead of the
// device's live reading (e.g. re-scoring a row from "Wireless sensor Soil
// Analysis data"). All optional because a live evaluation omits this entirely.
export class SoilMetricsDto {
  @IsOptional() @IsNumber() moisture?: number;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsNumber() ph?: number;
  @IsOptional() @IsNumber() conductivity?: number;
}

export class EvaluateCropDto {
  @IsString()
  @MinLength(1)
  deviceId: string;

  @IsString()
  @MinLength(1)
  cropName: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SoilMetricsDto)
  soilMetrics?: SoilMetricsDto;
}
