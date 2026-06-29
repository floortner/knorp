import { SetMetadata } from '@nestjs/common';

export const IS_STAFF_PUBLIC_KEY = 'isStaffPublic';

/**
 * Marks a staff route as not requiring a staff session (the staff auth endpoints themselves). The
 * StaffController applies `StaffAuthGuard` at the class level so every route is default-deny; this
 * decorator is the explicit opt-out, so a newly-added staff route is protected unless it says otherwise.
 */
export const StaffPublic = () => SetMetadata(IS_STAFF_PUBLIC_KEY, true);
