import { Module } from '@nestjs/common';
import { SharedApprovalsModule } from '../shared/shared-approvals.module';
import { PlatformApprovalsController } from './controllers/platform-approvals.controller';
import { PlatformApprovalsService } from './services/platform-approvals.service';

@Module({
  imports: [SharedApprovalsModule],
  controllers: [PlatformApprovalsController],
  providers: [PlatformApprovalsService],
})
export class PlatformApprovalsModule {}
