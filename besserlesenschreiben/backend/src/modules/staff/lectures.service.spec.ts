import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LecturesService } from './lectures.service';
import { ApiException } from '../../common/exceptions/api-exception';
import type { PrismaService } from '../../prisma/prisma.service';

const ITEM = {
  type: 'placeholder' as const,
  prompt: 'Welches Wort hat ein Dehnungs-h?',
  options: ['fahren', 'fallen'],
  answer: 'fahren',
  praise: 'Genau!',
  skillTags: ['placeholder' as const],
};

const LECTURE_ROW = {
  id: 'l1',
  createdBy: 't1',
  title: 'Dehnungs-h',
  intro: 'Merke: Das h macht den Vokal lang.',
  itemIds: ['i1'],
  skillTags: ['placeholder'],
  status: 'draft',
  createdAt: new Date('2026-07-25T10:00:00Z'),
  updatedAt: new Date('2026-07-25T10:00:00Z'),
  author: { name: 'Angelika' },
};

function make(overrides: Record<string, unknown> = {}) {
  let itemSeq = 0;
  const prisma = {
    lecture: {
      findUnique: vi.fn(async () => LECTURE_ROW),
      findMany: vi.fn(async () => [LECTURE_ROW]),
      count: vi.fn(async () => 1),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...LECTURE_ROW, ...data })),
      update: vi.fn(async () => LECTURE_ROW),
      delete: vi.fn(async () => LECTURE_ROW),
    },
    itemBank: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: `i${++itemSeq}`, ...data })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => [
        { id: 'i1', exerciseType: 'placeholder', payload: { prompt: 'x', options: ['a', 'b'], answer: 'a', praise: 'p' }, audioUrl: null, syllableAudio: null, skillTags: ['placeholder'] },
      ]),
    },
    assignment: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      delete: vi.fn(async () => ({})),
    },
    profile: { findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id }))) },
    attempt: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[]),
    ),
    ...overrides,
  } as unknown as PrismaService;
  return { svc: new LecturesService(prisma), prisma };
}

beforeEach(() => vi.clearAllMocks());

describe('LecturesService authoring', () => {
  it('creates a lecture whose items are persisted as staff item_bank rows (unit 0)', async () => {
    const { svc, prisma } = make();
    await svc.create('t1', { title: 'T', intro: 'Merke!', items: [ITEM] });
    const itemCreate = (prisma.itemBank.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(itemCreate).toMatchObject({ unit: 0, generatedBy: 'staff', exerciseType: 'placeholder', skillTags: ['placeholder'] });
    // payload carries only the render fields — backend-owned columns are stripped
    expect(itemCreate.payload).toEqual({ prompt: ITEM.prompt, options: ITEM.options, answer: ITEM.answer, praise: ITEM.praise });
    const lectureCreate = (prisma.lecture.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(lectureCreate).toMatchObject({ createdBy: 't1', itemIds: ['i1'], skillTags: ['placeholder'] });
  });

  it('422s an unsolvable item (answer not among options) with a per-item error path', async () => {
    const { svc } = make();
    const bad = { ...ITEM, answer: 'schwimmen' };
    await expect(svc.create('t1', { title: 'T', intro: 'M', items: [ITEM, bad] })).rejects.toMatchObject({
      status: 422,
      response: { code: 'UNSOLVABLE_ITEM', details: [{ field: expect.stringContaining('items.1') }] },
    });
  });

  it('refuses to edit a published lecture', async () => {
    const { svc } = make({
      lecture: { findUnique: vi.fn(async () => ({ ...LECTURE_ROW, status: 'published' })), update: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), delete: vi.fn() },
    });
    await expect(svc.update('l1', { title: 'T', intro: 'M', items: [ITEM] })).rejects.toMatchObject({ status: 409 });
  });

  it('draft edit deletes the old item rows and recreates from the new items', async () => {
    const { svc, prisma } = make();
    await svc.update('l1', { title: 'Neu', intro: 'M', items: [ITEM] });
    expect(prisma.itemBank.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['i1'] } } });
    expect(prisma.itemBank.create).toHaveBeenCalledOnce();
  });

  it('unpublish is blocked while assignments exist', async () => {
    const { svc } = make({
      lecture: { findUnique: vi.fn(async () => ({ ...LECTURE_ROW, status: 'published' })), update: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), delete: vi.fn() },
      assignment: { count: vi.fn(async () => 2), findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn(), delete: vi.fn() },
    });
    await expect(svc.unpublish('l1')).rejects.toMatchObject({ status: 409 });
  });

  it('delete is draft-only and removes the item rows', async () => {
    const { svc, prisma } = make();
    await svc.remove('l1');
    expect(prisma.itemBank.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['i1'] } } });
    expect(prisma.lecture.delete).toHaveBeenCalled();
  });
});

describe('LecturesService assignment', () => {
  it('assigning an unpublished lecture is a 409', async () => {
    const { svc } = make();
    await expect(svc.assign('t1', 'l1', ['p1'])).rejects.toMatchObject({ status: 409 });
  });

  it('assigns idempotently and reports skipped duplicates', async () => {
    const { svc } = make({
      lecture: { findUnique: vi.fn(async () => ({ ...LECTURE_ROW, status: 'published' })), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      assignment: {
        createMany: vi.fn(async () => ({ count: 2 })), // 3 requested, 1 already assigned
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(),
        count: vi.fn(async () => 0),
        delete: vi.fn(),
      },
    });
    await expect(svc.assign('t1', 'l1', ['p1', 'p2', 'p3'])).resolves.toEqual({ assigned: 2, skipped: 1 });
  });

  it('derives assignment status open → started → completed with the session rollup', async () => {
    const base = { lectureId: 'l1', assignedAt: new Date('2026-07-25T09:00:00Z'), profile: { name: 'Mia' } };
    const session = { id: 's1', source: 'assigned', itemIds: ['i1'], createdAt: new Date(), completedAt: new Date() };
    const { svc } = make({
      assignment: {
        findMany: vi.fn(async () => [
          { ...base, id: 'a1', profileId: 'p1', sessionId: null, completedAt: null, session: null },
          { ...base, id: 'a2', profileId: 'p2', sessionId: 's0', completedAt: null, session: { ...session, id: 's0', completedAt: null } },
          { ...base, id: 'a3', profileId: 'p3', sessionId: 's1', completedAt: new Date(), session },
        ]),
        findFirst: vi.fn(),
        count: vi.fn(async () => 0),
        createMany: vi.fn(),
        delete: vi.fn(),
      },
      attempt: { findMany: vi.fn(async () => [{ sessionId: 's1', itemId: 'i1', isCorrect: true, timeMs: 4000 }]) },
    });
    const { items } = await svc.assignments('l1');
    expect(items.map((i) => i.status)).toEqual(['open', 'started', 'completed']);
    expect(items[2]).toMatchObject({ correctPct: 100, itemsAnswered: 1, itemsTotal: 1, activeMs: 4000 });
    expect(items[0]).toMatchObject({ correctPct: null, itemsTotal: 0 });
  });

  it('withdraw refuses completed assignments and deletes uncompleted ones', async () => {
    const { svc, prisma } = make({
      assignment: {
        findFirst: vi.fn(async () => ({ id: 'a1', lectureId: 'l1', completedAt: null })),
        delete: vi.fn(async () => ({})),
        findMany: vi.fn(),
        count: vi.fn(),
        createMany: vi.fn(),
      },
    });
    await expect(svc.withdraw('l1', 'a1')).resolves.toEqual({ ok: true });
    expect(prisma.assignment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });

    const { svc: svc2 } = make({
      assignment: {
        findFirst: vi.fn(async () => ({ id: 'a2', lectureId: 'l1', completedAt: new Date() })),
        delete: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        createMany: vi.fn(),
      },
    });
    await expect(svc2.withdraw('l1', 'a2')).rejects.toBeInstanceOf(ApiException);
  });
});
