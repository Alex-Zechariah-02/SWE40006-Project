import type { Request } from 'express';

import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { throwContractHttpError } from '../common/contract-errors';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from './jwt.service';

export type AuthenticatedRequestUser = {
  id: string;
  role: string;
  email: string;
  organizationId: string | null;
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
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = bearerTokenFromHeader(request.headers.authorization);
    if (!token) {
      throwContractHttpError(401, 'AUTH_REQUIRED', 'Authentication required', []);
    }

    try {
      const payload = await this.jwt.verify(token);
      if (!payload.sub) {
        throw new Error('Invalid payload');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, email: true, organizationId: true }
      });

      if (!user) {
        throw new Error('Deleted user');
      }

      (request as unknown as { user: AuthenticatedRequestUser }).user = {
        id: user.id,
        role: user.role,
        email: user.email,
        organizationId: user.organizationId
      };

      return true;
    } catch {
      throwContractHttpError(401, 'AUTH_INVALID_TOKEN', 'Invalid or expired token', []);
    }
  }
}
