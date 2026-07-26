import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LecturesService } from './lectures.service';
import { ApiException } from '../../common/exceptions/api-exception';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * The teaching console's read + assign model (§H1/§I3). Authoring specs died with the write routes —
 * lectures come from the content library (import specs: src/content/). What matters here: the wire
 * never sees superseded rows, and assignment counts/dedupe span all versions of a slug.
 */

const LECTURE_ROW = {
  id: 'l2',
  slug: 'dehnungs-h',
  version: 2,
  title: 'Dehnungs-h',
  intro: 'Merke: Das h macht den Vokal lang.',
  itemIds: ['i1'],
  skillTags: ['placeholder'],
  status: 'published',
  createdAt: new Date('2026-07-25T10:00:00Z'),
  updatedAt: new Date('2026-07-25T10:00:00Z'),
};

function make(overrides: Record<string, unknown> = {}) {
  const prisma = {
    lecture: {
      findUnique: vi.fn(async () => LECTURE_ROW),
      findMany: vi.fn(async () => [LECTURE_ROW]),
      count: vi.fn(async () => 1),
    },
    itemBank: {
      findMany: vi.fn(async () => [
        { id: 'i1', exerciseType: 'placeholder', payload: { prompt: 'x', options: ['a', 'b'], answer: 'a', praise: 'p' }, audioUrl: null, syllableAudio: null, skillTags: ['placeholder'] },
      ]),
    },
    assignment: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      delete: vi.fn(async () => ({})),
    },
    profile: { findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id }))) },
    attempt: { findMany: vi.fn(async () => []) },
    ...overrides,
  } as unknown as PrismaService;
  return { svc: new LecturesService(prisma), prisma };
}

beforeEach(() => vi.clearAllMocks());

describe('LecturesService browse (content-library read model)', () => {
  it('list filters superseded versions and carries slug + version on the wire', async () => {
    const { svc, prisma } = make();
    const { items } = await svc.list(10);
    const where = (prisma.lecture.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where).toEqual({ status: { not: 'superseded' } });
    expect(items[0]).toMatchObject({ lectureId: 'l2', slug: 'dehnungs-h', version: 2, status: 'published' });
  });

  it('detail of a superseded version 404s (only the current version is addressable)', async () => {
    const { svc } = make({
      lecture: {
        findUnique: vi.fn(async () => ({ ...LECTURE_ROW, id: 'l1', version: 1, status: 'superseded' })),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    });
    await expect(svc.detail('l1')).rejects.toMatchObject({ status: 404 });
  });

  it('assignment counts aggregate across ALL versions of the slug', async () => {
    const { svc } = make({
      assignment: {
        // v1 (id l1) has a completed assignment, v2 (id l2) an open one — both count for the slug.
        findMany: vi.fn(async () => [
          { lectureId: 'l1', sessionId: 's1', completedAt: new Date(), lecture: { slug: 'dehnungs-h' } },
          { lectureId: 'l2', sessionId: null, completedAt: null, lecture: { slug: 'dehnungs-h' } },
        ]),
        findFirst: vi.fn(),
        createMany: vi.fn(),
        delete: vi.fn(),
      },
    });
    const { items } = await svc.list(10);
    expect(items[0].assignmentCounts).toEqual({ open: 1, started: 0, completed: 1 });
  });
});

describe('LecturesService assignment', () => {
  it('assigning a draft lecture is a 409', async () => {
    const { svc } = make({
      lecture: { findUnique: vi.fn(async () => ({ ...LECTURE_ROW, status: 'draft' })), findMany: vi.fn(), count: vi.fn() },
    });
    await expect(svc.assign('t1', 'l2', ['p1'])).rejects.toMatchObject({ status: 409 });
  });

  it('cross-version dedupe: a profile with an OPEN assignment on any version of the slug is skipped', async () => {
    const { svc, prisma } = make({
      assignment: {
        // p1 still has the v1 assignment open → skipped; p2 is eligible.
        findMany: vi.fn(async () => [{ profileId: 'p1' }]),
        findFirst: vi.fn(),
        createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
        delete: vi.fn(),
      },
    });
    await expect(svc.assign('t1', 'l2', ['p1', 'p2'])).resolves.toEqual({ assigned: 1, skipped: 1 });
    const openWhere = (prisma.assignment.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(openWhere).toMatchObject({ completedAt: null, lecture: { slug: 'dehnungs-h' } });
    const created = (prisma.assignment.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(created).toEqual([{ lectureId: 'l2', profileId: 'p2', assignedBy: 't1' }]);
  });

  it('a COMPLETED older-version assignment does not block assigning the new version', async () => {
    const { svc } = make(); // open-assignment query returns [] — the completed v1 row never matches it
    await expect(svc.assign('t1', 'l2', ['p1'])).resolves.toEqual({ assigned: 1, skipped: 0 });
  });

  it('derives assignment status open → started → completed with the session rollup', async () => {
    const base = { lectureId: 'l2', assignedAt: new Date('2026-07-25T09:00:00Z'), profile: { name: 'Mia' } };
    const session = { id: 's1', source: 'assigned', itemIds: ['i1'], createdAt: new Date(), completedAt: new Date() };
    const { svc } = make({
      assignment: {
        findMany: vi.fn(async () => [
          { ...base, id: 'a1', profileId: 'p1', sessionId: null, completedAt: null, session: null },
          { ...base, id: 'a2', profileId: 'p2', sessionId: 's0', completedAt: null, session: { ...session, id: 's0', completedAt: null } },
          { ...base, id: 'a3', profileId: 'p3', sessionId: 's1', completedAt: new Date(), session },
        ]),
        findFirst: vi.fn(),
        createMany: vi.fn(),
        delete: vi.fn(),
      },
      attempt: { findMany: vi.fn(async () => [{ sessionId: 's1', itemId: 'i1', isCorrect: true, timeMs: 4000 }]) },
    });
    const { items } = await svc.assignments('l2');
    expect(items.map((i) => i.status)).toEqual(['open', 'started', 'completed']);
    expect(items[2]).toMatchObject({ correctPct: 100, itemsAnswered: 1, itemsTotal: 1, activeMs: 4000 });
    expect(items[0]).toMatchObject({ correctPct: null, itemsTotal: 0 });
  });

  it('withdraw refuses completed assignments and deletes uncompleted ones', async () => {
    const { svc, prisma } = make({
      assignment: {
        findFirst: vi.fn(async () => ({ id: 'a1', lectureId: 'l2', completedAt: null })),
        delete: vi.fn(async () => ({})),
        findMany: vi.fn(async () => []),
        createMany: vi.fn(),
      },
    });
    await expect(svc.withdraw('l2', 'a1')).resolves.toEqual({ ok: true });
    expect(prisma.assignment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });

    const { svc: svc2 } = make({
      assignment: {
        findFirst: vi.fn(async () => ({ id: 'a2', lectureId: 'l2', completedAt: new Date() })),
        delete: vi.fn(),
        findMany: vi.fn(async () => []),
        createMany: vi.fn(),
      },
    });
    await expect(svc2.withdraw('l2', 'a2')).rejects.toBeInstanceOf(ApiException);
  });
});
