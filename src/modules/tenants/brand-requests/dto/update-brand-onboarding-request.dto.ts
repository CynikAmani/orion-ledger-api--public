import { PartialType } from '@nestjs/swagger';
import { CreateBrandOnboardingRequestDto } from './create-brand-onboarding-request.dto';

export class UpdateBrandOnboardingRequestDto extends PartialType(
  CreateBrandOnboardingRequestDto,
) {}
