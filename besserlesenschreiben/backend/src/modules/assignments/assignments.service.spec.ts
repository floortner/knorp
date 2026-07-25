import { describe, it, expect, vi } from 'vitest';
import { AssignmentsService } from './assignments.service';
import type { PrismaService } from '../../prisma/prisma.service';

function make(rows: unknown[]) {
  const prisma = {
    profile: { findFirst: vi.fn(async () => ({ id: 'p1', accountId: 'a1' })) },
    assignment: { findMany: vi.fn(async () => rows) },
  } as unknown as PrismaService;
  return { svc: new AssignmentsService(prisma), prisma };
}

describe('AssignmentsService.list', () => {
  it('maps open + started assignments with the lecture and trainer name for the /lernen card', async () => {
    const base = { lecture: { title: 'Dehnungs-h', intro: 'Merke!', skillTags: ['placeholder'] }, assigner: { name: 'Angelika' } };
    const { svc, prisma } = make([
      { ...base, id: 'a1', sessionId: null },
      { ...base, id: 'a2', sessionId: 's1' },
    ]);
    const res = await svc.list('acc-1', 'p1');
    expect(res).toEqual([
      { assignmentId: 'a1', lectureTitle: 'Dehnungs-h', trainerName: 'Angelika', intro: 'Merke!', skillTags: ['placeholder'], status: 'open' },
      { assignmentId: 'a2', lectureTitle: 'Dehnungs-h', trainerName: 'Angelika', intro: 'Merke!', skillTags: ['placeholder'], status: 'started' },
    ]);
    // Only non-completed assignments are offered (completed ones never reappear on /lernen)
    expect((prisma.assignment.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toMatchObject({
      profileId: 'p1',
      completedAt: null,
    });
  });

  it('404s a foreign profile (ownership is asserted, never trusted)', async () => {
    const prisma = {
      profile: { findFirst: vi.fn(async () => null) },
      assignment: { findMany: vi.fn() },
    } as unknown as PrismaService;
    const svc = new AssignmentsService(prisma);
    await expect(svc.list('acc-1', 'foreign')).rejects.toMatchObject({ status: 404 });
  });
});
