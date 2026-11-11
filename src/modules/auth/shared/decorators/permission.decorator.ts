import { CustomDecorator, SetMetadata } from '@nestjs/common';
import { PermissionType } from '../constants/permissions.constant';

export const PERMISSION_METADATA_KEY = 'permission';

/**
 * Secures a route by requiring a single atomic permission string.
 * @param permission The required permission (e.g. PERMISSIONS.LOAN_APPLICATIONS.CREATE)
 */
export const Permission = (
  permission: PermissionType,
): CustomDecorator<string> => SetMetadata(PERMISSION_METADATA_KEY, permission);
