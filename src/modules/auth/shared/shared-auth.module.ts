import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { RequestOriginModule } from '../../../core/config/request-origin.module';
import { PrismaModule } from '../../../core/database/prisma.module';
import { UserValidationModule } from '../../users/shared/user-validation.module';
import { JwtCoreModule } from './jwt-core.module';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    UserValidationModule,
    JwtCoreModule,
    RequestOriginModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [JwtStrategy, GoogleStrategy, GoogleAuthGuard],
  exports: [JwtCoreModule, PassportModule, GoogleAuthGuard],
})
export class SharedAuthModule {}
