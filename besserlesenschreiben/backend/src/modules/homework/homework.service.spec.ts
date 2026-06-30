import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import { HomeworkService } from './homework.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StorageService } from '../../services/storage/storage.service';
import type { LlmService } from '../../services/llm/llm.service';
import { ApiException } from '../../common/exceptions/api-exception';

const analysis = {
  topic: 'Anlaute',
  exerciseType: 'initial',
  items: [{ prompt: 'Apfel', childAnswer: 'Apfel', correct: true, errorType: null }],
  suggestedFocus: ['vowel_ei'],
};

function setup(opts: { owned?: boolean; row?: Record<string, unknown> | null; resultRow?: Record<string, unknown> | null } = {}) {
  const owned = opts.owned ?? true;
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    profile: { findFirst: vi.fn(async () => (owned ? { id: 'p1', accountId: 'a1' } : null)) },
    homeworkUpload: {
      create: vi.fn(async () => ({ id: 'up-1' })),
      findUnique: vi.fn(async () => opts.row ?? null),
      findFirst: vi.fn(async () => opts.resultRow ?? null),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { count: 1 };
      }),
    },
  } as unknown as PrismaService;
  const storage = {
    writeUserBinary: vi.fn(async () => 'users/a1/p1/homework/x.webp'),
    readBinary: vi.fn(async () => Buffer.from('img')),
  } as unknown as StorageService;
  const llm = { extract: vi.fn(async () => analysis) } as unknown as LlmService;
  return { svc: new HomeworkService(prisma, storage, llm), prisma, storage, llm, updates };
}

async function statusOf(p: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return (e as ApiException).getStatus();
  }
}

// A tiny valid PNG so sharp has real bytes to transcode.
async function pngBytes(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
}

describe('HomeworkService.upload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s for a profile the account does not own', async () => {
    const { svc } = setup({ owned: false });
    expect(await statusOf(svc.upload('a1', 'p1', { buffer: Buffer.from('x'), mimetype: 'image/png' }))).toBe(404);
  });

  it('rejects a non-image mime type with 422', async () => {
    const { svc } = setup();
    expect(await statusOf(svc.upload('a1', 'p1', { buffer: Buffer.from('x'), mimetype: 'application/pdf' }))).toBe(422);
  });

  it('transcodes to webp, stores it, creates a pending_analysis row', async () => {
    const { svc, storage, prisma } = setup();
    const res = await svc.upload('a1', 'p1', { buffer: await pngBytes(), mimetype: 'image/png' });
    expect(res).toEqual({ uploadId: 'up-1', status: 'pending_analysis' });
    const writeArgs = (storage.writeUserBinary as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(writeArgs[2]).toMatch(/^homework\/.*\.webp$/); // name
    expect(writeArgs[4]).toBe('image/webp'); // content type
    expect((prisma.homeworkUpload.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
  });
});

describe('HomeworkService.analyze', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs vision and moves pending_analysis → pending_review with the draft', async () => {
    const { svc, llm, updates } = setup({ row: { id: 'up-1', imageKey: 'k', status: 'pending_analysis' } });
    await svc.analyze('up-1');
    expect((llm.extract as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
    expect(updates[0]).toMatchObject({ status: 'pending_review' });
    expect(updates[0].llmAnalysis).toEqual(analysis);
  });

  it('is a no-op when the upload is not pending_analysis', async () => {
    const { svc, llm } = setup({ row: { id: 'up-1', imageKey: 'k', status: 'reviewed' } });
    await svc.analyze('up-1');
    expect((llm.extract as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});

describe('HomeworkService.result', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s an upload not owned by the account', async () => {
    const { svc } = setup({ resultRow: null });
    expect(await statusOf(svc.result('a1', 'up-1'))).toBe(404);
  });

  it('hides the draft: returns reviewedAnalysis only once reviewed', async () => {
    const pending = setup({ resultRow: { status: 'pending_review', reviewedAnalysis: null } });
    expect(await pending.svc.result('a1', 'up-1')).toEqual({ status: 'pending_review', reviewedAnalysis: null });

    const done = setup({ resultRow: { status: 'reviewed', reviewedAnalysis: analysis } });
    expect(await done.svc.result('a1', 'up-1')).toEqual({ status: 'reviewed', reviewedAnalysis: analysis });
  });
});
