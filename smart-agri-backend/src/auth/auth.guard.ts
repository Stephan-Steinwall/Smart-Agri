import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

function extractBearerToken(request: Request): string | null {
  const header = request.headers['authorization'];
  if (!header || Array.isArray(header)) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException(
        'Missing or malformed Authorization header.',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException(
        'Session expired or invalid. Please log in again.',
      );
    }
  }
}
