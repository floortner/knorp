import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiException } from '../exceptions/api-exception';

/**
 * Admin-role gate for the staff realm (ARCHITECTURE §1b, SPEC §6). Runs AFTER `StaffAuthGuard`, which
 * authenticates the trainer and sets `req.trainer` (id + role) from the staff token. User-administration
 * routes (real account identity, approve/deactivate/delete) require `role='admin'`; a plain trainer —
 * who only ever sees the pseudonymised review queue — gets `403`. Identity admin and the anonymised queue
 * never mix (security rule 8/10).
 */
@Injectable()
export class StaffAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ trainer?: { role?: string } }>();
    if (req.trainer?.role !== 'admin') {
      throw new ApiException(403, 'FORBIDDEN', 'Nur Administratoren dürfen das.');
    }
    return true;
  }
}
