import { Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiZodResponse } from '../../common/zod-openapi';
import { adminUserPageSchema, adminUserStatusSchema } from '../../contract/staff';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';
import { StaffAdminGuard } from '../../common/guards/staff-admin.guard';
import { UserAdminService } from './user-admin.service';

/**
 * Staff USER ADMINISTRATION routes (SPEC §6, ARCHITECTURE §1b). `@Public()` skips the GLOBAL family
 * `JwtAuthGuard` (a family JWT is never valid here); then `StaffAuthGuard` authenticates the reviewer and
 * `StaffAdminGuard` requires `role='admin'` — a plain reviewer gets 403. Identity-bearing (real email),
 * kept separate from the pseudonymised review queue (security rules 8/10).
 */
@Public()
@UseGuards(StaffAuthGuard, StaffAdminGuard)
@ApiTags('staff')
@Controller('staff/users')
export class StaffUsersController {
  constructor(private readonly users: UserAdminService) {}

  @Get()
  @ApiZodResponse(adminUserPageSchema)
  list(
    @Query('status') status?: 'pending' | 'active' | 'deactivated',
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 50;
    const validStatus =
      status === 'pending' || status === 'active' || status === 'deactivated' ? status : undefined;
    return this.users.list(Number.isFinite(n) ? n : 50, validStatus, cursor);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiZodResponse(adminUserStatusSchema)
  approve(@Param('id') id: string) {
    return this.users.approve(id);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiZodResponse(adminUserStatusSchema)
  deactivate(@Param('id') id: string) {
    return this.users.deactivate(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
