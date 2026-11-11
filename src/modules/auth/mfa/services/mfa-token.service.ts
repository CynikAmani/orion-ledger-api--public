import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  MFA_TOKEN_PURPOSE,
  MFA_TOKEN_TTL,
} from '../constants/mfa.constant';

interface MfaTokenPayload {
  sub: string;
  purpose: typeof MFA_TOKEN_PURPOSE;
}

@Injectable()
export class MfaTokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(id: number): Promise<string> {
    const payload: MfaTokenPayload = {
      sub: String(id),
      purpose: MFA_TOKEN_PURPOSE,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: MFA_TOKEN_TTL,
    });
  }

  async verify(token: string): Promise<number> {
    try {
      const payload = await this.jwtService.verifyAsync<MfaTokenPayload>(token);

      if (payload.purpose !== MFA_TOKEN_PURPOSE || !payload.sub) {
        throw new UnauthorizedException('Invalid or expired MFA token');
      }

      const id = Number(payload.sub);
      if (!Number.isInteger(id) || id <= 0) {
        throw new UnauthorizedException('Invalid or expired MFA token');
      }

      return id;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired MFA code');  
    }
  }
}
