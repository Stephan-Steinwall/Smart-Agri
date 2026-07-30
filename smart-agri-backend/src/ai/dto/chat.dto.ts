import { IsString, MinLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1)
  query: string;

  @IsString()
  @MinLength(1)
  deviceId: string;

  @IsString()
  @MinLength(1)
  sessionId: string;
}
