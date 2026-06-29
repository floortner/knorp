import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffAuthService } from './staff-auth.service';
import { ReviewService } from './review.service';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';

/**
 * Staff realm (ARCHITECTURE §1a / SPEC §12 Phase 2.5): reviewer auth + the homework review queue and
 * authoritative apply. PrismaService, JwtService, EmailService, StorageService and FsrsService are all
 * provided by global modules, so this module only wires its own controller/services/guard.
 */
@Module({
  controllers: [StaffController],
  providers: [StaffAuthService, ReviewService, StaffAuthGuard],
})
export class StaffModule {}
