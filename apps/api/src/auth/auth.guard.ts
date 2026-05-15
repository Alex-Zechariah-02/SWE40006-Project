import type { Request } from 'express';

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { throwContractHttpError } from '../common/contract-errors';
import { JwtService } from './jwt.service';

export type AuthenticatedRequestUser = {
  id: string;
  role: string;
  email: string;
};

function bearerTokenFromHeader(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = bearerTokenFromHeader(request.headers.authorization);
    if (!token) {
      throwContractHttpError(401, 'AUTH_REQUIRED', 'Authentication required', []);
    }

    try {
      const payload = await this.jwt.verify(token);
      if (!payload.sub || !payload.role || !payload.email) {
        throw new Error('Invalid payload');
      }

      (request as unknown as { user: AuthenticatedRequestUser }).user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email
      };

      return true;
    } catch {
      throwContractHttpError(401, 'AUTH_INVALID_TOKEN', 'Invalid or expired token', []);
    }
  }
}

