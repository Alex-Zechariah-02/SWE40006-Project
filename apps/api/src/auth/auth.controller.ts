import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { loginRequestSchema, type LoginRequest } from '@balance/schemas';

import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: { id: string }) {
    return this.auth.me(user.id);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async logout() {
    return { ok: true };
  }
}
