import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { throwContractHttpError } from '../common/contract-errors';
import { JwtService } from './jwt.service';

type PublicUser = {
  id: string;
  email: string;
  role: string;
  displayName: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  private peppered(password: string): string {
    const pepper = (process.env.PASSWORD_PEPPER || '').trim();
    return `${password}${pepper}`;
  }

  private toPublicUser(user: { id: string; email: string; role: string; displayName: string }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName
    };
  }

  async login(email: string, password: string): Promise<{ user: PublicUser; accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Do not reveal whether the email exists.
    if (!user) {
      throwContractHttpError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials', []);
    }

    const ok = await bcrypt.compare(this.peppered(password), user.passwordHash);
    if (!ok) {
      throwContractHttpError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials', []);
    }

    const accessToken = await this.jwt.sign({ sub: user.id, role: user.role, email: user.email });
    return { user: this.toPublicUser(user), accessToken };
  }

  async me(userId: string): Promise<{ user: PublicUser }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // Token may be valid but user deleted/hidden; treat as invalid.
      throwContractHttpError(401, 'AUTH_INVALID_TOKEN', 'Invalid or expired token', []);
    }
    return { user: this.toPublicUser(user) };
  }
}

