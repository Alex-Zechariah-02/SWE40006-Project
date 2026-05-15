import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { JwtService } from './jwt.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, JwtService, AuthGuard, RolesGuard],
  exports: [AuthService, JwtService, AuthGuard, RolesGuard]
})
export class AuthModule {}
