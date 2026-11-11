import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  LifecycleUserRecord,
  UserAccountLifecycleValidator,
} from './user-account-lifecycle.validator';

@Injectable()
export class UserBusinessEligibilityValidator {
  constructor(
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
  ) {}

  async assertUserAccountIsNotBlocked(
    userId: string,
  ): Promise<LifecycleUserRecord> {
    const user = await this.userAccountLifecycleValidator.getUserIfExists(userId);

    if (user.isBlocked === true) {
      throw new ForbiddenException(
        'Action restricted: This account is on an operational hold and cannot perform loan or savings operations',
      );
    }

    return user;
  }
}
