import type { Request } from 'express';

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequestUser } from './auth.guard';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return (request as unknown as { user: AuthenticatedRequestUser }).user;
});

