import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { PrismaModule } from '../../core/database/prisma.module';
import { AuthSessionModule } from '../auth/auth/auth.module';
import { SandboxController } from './controllers/sandbox.controller';
import { SandboxCleanupService } from './services/sandbox-cleanup.service';
import { SandboxService } from './services/sandbox.service';
import { SandboxSessionCleanupTask } from './tasks/sandbox-session-cleanup.task';

@Module({
  imports: [PrismaModule, AuditModule, AuthSessionModule],
  controllers: [SandboxController],
  providers: [SandboxService, SandboxCleanupService, SandboxSessionCleanupTask],
})
export class SandboxModule {}
