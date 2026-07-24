import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffUsersController } from './staff-users.controller';
import { StaffStudentsController } from './staff-students.controller';
import { StaffAuthService } from './staff-auth.service';
import { ReviewService } from './review.service';
import { UserAdminService } from './user-admin.service';
import { StaffProgressService } from './staff-progress.service';
import { StudentActivityService } from './student-activity.service';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';
import { StaffAdminGuard } from '../../common/guards/staff-admin.guard';

/**
 * Staff realm (ARCHITECTURE §1a / SPEC §12 Phase 2.5): trainer auth + the homework review queue and
 * authoritative apply, the all-trainer learner directory + activity read model (ROADMAP §H1.3/§H3.1),
 * plus admin-only user administration (ARCHITECTURE §1b). PrismaService, JwtService, EmailService,
 * StorageService and FsrsService are all provided by global modules, so this module only wires its
 * own controllers/services/guards.
 */
@Module({
  controllers: [StaffController, StaffUsersController, StaffStudentsController],
  providers: [
    StaffAuthService,
    ReviewService,
    UserAdminService,
    StaffProgressService,
    StudentActivityService,
    StaffAuthGuard,
    StaffAdminGuard,
  ],
})
export class StaffModule {}
