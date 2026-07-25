import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertProfileOwned } from '../../common/ownership';

/**
 * The student's open assignments (ROADMAP §H1) — data for the "Übung von {trainer}" card on /lernen.
 * An assignment is an OFFER, never a push: only non-completed ones are listed (started ones stay
 * restartable), newest first. `trainerName` personalises the card (known-trainer model).
 */
@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(accountId: string, profileId: string) {
    const profile = await assertProfileOwned(this.prisma, accountId, profileId);
    const rows = await this.prisma.assignment.findMany({
      where: { profileId: profile.id, completedAt: null },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
      include: {
        lecture: { select: { title: true, intro: true, skillTags: true } },
        assigner: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      assignmentId: r.id,
      lectureTitle: r.lecture.title,
      trainerName: r.assigner.name,
      intro: r.lecture.intro,
      skillTags: r.lecture.skillTags,
      status: r.sessionId ? ('started' as const) : ('open' as const),
    }));
  }
}
