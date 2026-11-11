import { UpdateManagedUserDto } from '../shared/dto/update-managed-user.dto';

export interface ManagedUserUpdateSnapshot {
  fullname: string;
  email: string | null;
  phone: string | null;
  nationalId: string | null;
  genderId: number | null;
  districtId: number | null;
}

export interface ManagedUserUpdateNotificationPlan {
  profileChanged: boolean;
}

export function resolveManagedUserUpdateNotifications(
  current: ManagedUserUpdateSnapshot,
  updateDto: UpdateManagedUserDto,
): ManagedUserUpdateNotificationPlan {
  const profileChanged =
    (updateDto.fullname !== undefined && updateDto.fullname !== current.fullname) ||
    (updateDto.email !== undefined && updateDto.email !== current.email) ||
    (updateDto.phone !== undefined && updateDto.phone !== current.phone) ||
    (updateDto.nationalId !== undefined &&
      updateDto.nationalId !== current.nationalId) ||
    (updateDto.genderId !== undefined && updateDto.genderId !== current.genderId) ||
    (updateDto.districtId !== undefined &&
      updateDto.districtId !== current.districtId);

  return { profileChanged };
}

export function rolePublicIdsEqual(current: string[], next: string[]): boolean {
  if (current.length !== next.length) {
    return false;
  }

  const sortedCurrent = [...current].sort();
  const sortedNext = [...next].sort();

  return sortedCurrent.every((publicId, index) => publicId === sortedNext[index]);
}

const MANAGED_USER_AUDIT_FIELDS = [
  'fullname',
  'email',
  'phone',
  'nationalId',
  'genderId',
  'districtId',
] as const;

/** previousX / X pairs so audit normalization stores TRANSITION from/to rows. */
export function buildManagedUserProfileAuditPayload(
  current: ManagedUserUpdateSnapshot,
  updateDto: Partial<ManagedUserUpdateSnapshot>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of MANAGED_USER_AUDIT_FIELDS) {
    if (updateDto[field] === undefined) {
      continue;
    }

    const from = current[field] ?? null;
    const to = updateDto[field] ?? null;
    if (from === to) {
      continue;
    }

    const suffix = field.charAt(0).toUpperCase() + field.slice(1);
    payload[`previous${suffix}`] = from;
    payload[field] = to;
  }

  return payload;
}
