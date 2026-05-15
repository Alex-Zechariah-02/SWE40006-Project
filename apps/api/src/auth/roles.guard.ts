import type { Request } from 'express';

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { throwContractHttpError } from '../common/contract-errors';
import { ROLES_KEY } from './roles.decorator';
import type { AuthenticatedRequestUser } from './auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as unknown as { user?: AuthenticatedRequestUser }).user;
    if (!user) {
      // If the route requires roles but auth was not applied, treat as forbidden.
      throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
    }

    if (!requiredRoles.includes(user.role)) {
      throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
    }

    return true;
  }
}

