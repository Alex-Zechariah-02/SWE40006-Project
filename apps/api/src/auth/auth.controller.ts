import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginBodySchema)) body: z.infer<typeof loginBodySchema>) {
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
