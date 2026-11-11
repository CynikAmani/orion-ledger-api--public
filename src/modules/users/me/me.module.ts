import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { SharedUsersModule } from '../shared/shared-users.module';
import { MeController } from './controllers/me.controller';
import { MeIdentityDocumentService } from './services/me-identity-document.service';
import { MeService } from './services/me.service';

@Module({
  imports: [PrismaModule, SharedUsersModule],
  controllers: [MeController],
  providers: [MeService, MeIdentityDocumentService],
})
export class MeModule {}