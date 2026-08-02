import { IsOptional, IsString, MinLength, IsBoolean } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class SendSmsDto {
  @IsString()
  @MinLength(1)
  phone: string;

  @IsString()
  @MinLength(1)
  code: string;

  @IsOptional()
  @IsString()
  userEmail?: string;
}

export class VerifyOtpDto {
  @IsString()
  @MinLength(1)
  emailOrUsername: string;

  @IsString()
  @MinLength(1)
  code: string;
}

export class ResendOtpDto {
  @IsString()
  @MinLength(1)
  emailOrUsername: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  oldEmail?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;
}

export class VerifySystemControlDto {
  @IsString()
  @MinLength(1)
  emailOrUsername: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class VerifyAccountPasswordDto {
  @IsString()
  @MinLength(1)
  emailOrUsername: string;

  @IsOptional()
  @IsString()
  accountPassword?: string;
}

export class UpdateSystemControlPasswordDto {
  @IsString()
  @MinLength(1)
  emailOrUsername: string;

  @IsOptional()
  @IsString()
  accountPassword?: string;

  @IsOptional()
  @IsString()
  oldSystemPassword?: string;

  @IsOptional()
  @IsString()
  newSystemPassword?: string;
}
