import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffUsersController } from './staff-users.controller';
import { StaffLexemesController } from './staff-lexemes.controller';
import { StaffAuthService } from './staff-auth.service';
import { ReviewService } from './review.service';
import { UserAdminService } from './user-admin.service';
import { LexemeAdminService } from './lexeme-admin.service';
import { StaffProgressService } from './staff-progress.service';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';
import { StaffAdminGuard } from '../../common/guards/staff-admin.guard';

/**
 * Staff realm (ARCHITECTURE §1a / SPEC §12 Phase 2.5): reviewer auth + the homework review queue and
 * authoritative apply, plus admin-only user administration (ARCHITECTURE §1b). PrismaService, JwtService,
 * EmailService, StorageService and FsrsService are all provided by global modules, so this module only
 * wires its own controllers/services/guards.
 */
@Module({
  controllers: [StaffController, StaffUsersController, StaffLexemesController],
  providers: [StaffAuthService, ReviewService, UserAdminService, LexemeAdminService, StaffProgressService, StaffAuthGuard, StaffAdminGuard],
})
export class StaffModule {}
