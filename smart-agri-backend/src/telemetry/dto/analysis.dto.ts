import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

// Loosely typed on purpose: the service accepts several historical field-name
// aliases (soil_sample_label vs label, soil_ph vs soilMetrics.ph, ...) for the
// same value. This DTO only validates types, it doesn't narrow the shape.
export class SaveAnalysisDto {
  @IsOptional() @IsString() soil_sample_label?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() crop_label?: string;
  @IsOptional() @IsString() cropLabel?: string;
  @IsOptional() @IsString() label_status?: string;
  @IsOptional() @IsString() labelStatus?: string;
  @IsOptional() @IsString() labelled_by?: string;
  @IsOptional() @IsString() labelledBy?: string;
  @IsOptional() @IsString() verified_by?: string;
  @IsOptional() @IsString() verifiedBy?: string;
  @IsOptional() @IsString() verified_at?: string;
  @IsOptional() @IsString() verifiedAt?: string;
  @IsOptional() @IsString() reading_at?: string;
  @IsOptional() @IsString() readingAt?: string;
  @IsOptional() @IsString() deviceId?: string;
  @IsOptional() @IsString() device_id?: string;
  @IsOptional() @IsString() recommended_crop?: string;
  @IsOptional() @IsString() cropRecommendation?: string;
  @IsOptional() @IsString() recommendation_reason?: string;
  @IsOptional() @IsString() recommendationReason?: string;
  @IsOptional() @IsString() model_version?: string;
  @IsOptional() @IsString() modelVersion?: string;

  @IsOptional() @IsNumber() soil_moisture?: number;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsNumber() soil_ph?: number;
  @IsOptional() @IsNumber() soil_conductivity?: number;
  @IsOptional() @IsNumber() soil_health_score?: number;
  @IsOptional() @IsNumber() soilHealthScore?: number;
  @IsOptional() @IsNumber() nitrogen?: number;
  @IsOptional() @IsNumber() phosphorus?: number;
  @IsOptional() @IsNumber() potassium?: number;
  @IsOptional() @IsNumber() tds?: number;
  @IsOptional() @IsNumber() salinity?: number;
  @IsOptional() @IsNumber() prediction_confidence?: number;
  @IsOptional() @IsNumber() predictionConfidence?: number;

  @IsOptional()
  @IsObject()
  soilMetrics?: Record<string, number | null>;
}

export class UpdateAnalysisEvaluationDto {
  @IsString()
  id: string;

  @IsOptional() @IsString() recommended_crop?: string;
  @IsOptional() @IsString() recommendation_reason?: string;
  @IsOptional() @IsNumber() prediction_confidence?: number;
  @IsOptional() @IsString() model_version?: string;
}

export class DeleteAnalysisDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsArray()
  @Type(() => String)
  ids?: string[];
}
