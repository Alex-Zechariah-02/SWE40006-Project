import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';

export type AccessTokenPayload = {
  sub: string;
  role: string;
  email: string;
};

@Injectable()
export class JwtService {
  private secretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim().length === 0) {
      // Do not proceed with auth if secret is missing. This is a hard requirement
      // for any environment that enables login.
      throw new Error('JWT_SECRET is required');
    }
    return new TextEncoder().encode(secret);
  }

  private expiresIn(): string {
    return (process.env.JWT_EXPIRES_IN || '1h').trim() || '1h';
  }

  async sign(payload: AccessTokenPayload): Promise<string> {
    const token = await new SignJWT({ role: payload.role, email: payload.email })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(this.expiresIn())
      .sign(this.secretKey());

    return token;
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.secretKey(), { algorithms: ['HS256'] });
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const role = typeof payload.role === 'string' ? payload.role : '';
    const email = typeof payload.email === 'string' ? payload.email : '';

    return { sub, role, email };
  }
}

