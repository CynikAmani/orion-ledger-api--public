import { BadRequestException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { PrismaService } from '../../../../core/database/prisma.service';

export interface GoogleOAuthProfile {
  email: string;
  fullname: string;
  googleId: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly prisma: PrismaService) {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackURL = process.env.GOOGLE_CALLBACK_URL;

    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error(
        'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL environment variables must be defined',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<void> {
    const googleId = profile.id as string;
    const email = profile.emails?.[0]?.value as string | undefined;
    const fullname = this.resolveFullname(profile);
    const avatarUrl = profile.photos?.[0]?.value as string | undefined;

    if (!email) {
      throw new BadRequestException('A Google email is required');
    }

    const payload: GoogleOAuthProfile = {
      email,
      fullname,
      googleId,
      avatarUrl,
    };

    done(null, payload);
  }

  private resolveFullname(profile: any): string {
    if (profile.displayName) {
      return profile.displayName;
    }

    const givenName = profile.name?.givenName ?? '';
    const familyName = profile.name?.familyName ?? '';

    return [givenName, familyName].filter(Boolean).join(' ').trim();
  }
}
