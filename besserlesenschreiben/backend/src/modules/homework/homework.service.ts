import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { assertProfileOwned } from '../../common/ownership';
import { ApiException } from '../../common/exceptions/api-exception';
import { LlmService } from '../../services/llm/llm.service';
import { StorageService } from '../../services/storage/storage.service';
import { homeworkAnalysisSchema } from '../../contract/staff';
import { Prisma } from '../../generated/prisma/client';
import type { z } from 'zod';

type HomeworkAnalysis = z.infer<typeof homeworkAnalysisSchema>;
type HomeworkStatus = 'pending_analysis' | 'pending_review' | 'reviewed' | 'rejected';

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_DIM = 1600; // downscale for cost/speed before vision (ARCHITECTURE §10)

// Retry sweep for uploads whose fire-and-forget analysis died (process restart, provider blip):
// every SWEEP_INTERVAL_MS, re-drive rows still pending_analysis that are older than SWEEP_MIN_AGE_MS
// (young rows are likely mid-flight), a bounded batch at a time.
const SWEEP_INTERVAL_MS = 5 * 60_000;
const SWEEP_MIN_AGE_MS = 2 * 60_000;
const SWEEP_BATCH = 10;

// Exported so the cutover smoke script (scripts/llm-smoke.ts) probes the real vision prompt.
export const VISION_SYSTEM = [
  'Du analysierst das Foto einer deutschen Grundschul-Hausübung (Lesen/Schreiben).',
  'Erkenne die einzelnen Aufgaben und die Antworten des Schülers oder der Schülerin. Markiere je Aufgabe, ob sie korrekt ist,',
  'und benenne bei Fehlern eine knappe Fehlerkategorie (z. B. "vowel_length", "dehnung_h", "double_consonant").',
  'Leite daraus suggestedFocus ab: Skill-Tags, die als Nächstes geübt werden sollten.',
  'Dies ist ein ENTWURF zur fachlichen Prüfung — rate nicht, wenn etwas unleserlich ist.',
].join(' ');

/**
 * Homework upload + vision draft (family side, ARCHITECTURE §11 / SPEC §10). The photo is transcoded to
 * WebP (EXIF stripped) and stored under the caller's prefix; an async Claude-vision pass produces the
 * `llm_analysis` **draft** and moves the upload to `pending_review` for the staff queue. **Nothing mutates
 * the learning profile here** — only a reviewer's authoritative verdict does (the staff module). Free.
 * The family only ever sees the authoritative result once reviewed, never the draft. We never log image
 * bytes or analysis content (§6).
 */
@Injectable()
export class HomeworkService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('HomeworkService');
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly llm: LlmService,
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => {
      void this.sweepPending().catch((err) =>
        this.logger.warn({ event: 'homework.sweep_failed', name: (err as Error)?.name }, 'sweep failed'),
      );
    }, SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.(); // never keep the process alive just for the sweep
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  /**
   * Re-drive analyses stuck in pending_analysis (fire-and-forget lost to a crash/provider outage).
   * Sequential + batch-capped so a backlog never bursts the provider; `analyze` itself re-checks the
   * status, so racing an in-flight analysis is harmless. No-op while the LLM is unavailable (stub/no key)
   * — retrying would fail identically and the rows stay retryable for after cutover.
   */
  async sweepPending(): Promise<number> {
    if (!this.llm.available) return 0;

    const stuck = await this.prisma.homeworkUpload.findMany({
      where: { status: 'pending_analysis', createdAt: { lt: new Date(Date.now() - SWEEP_MIN_AGE_MS) } },
      orderBy: { createdAt: 'asc' },
      take: SWEEP_BATCH,
      select: { id: true },
    });
    if (stuck.length === 0) return 0;

    this.logger.log({ event: 'homework.sweep', count: stuck.length }, 'retrying stuck analyses');
    let recovered = 0;
    for (const row of stuck) {
      try {
        await this.analyze(row.id);
        recovered += 1;
      } catch (err) {
        this.logger.warn(
          { event: 'homework.analyze_failed', uploadId: row.id, name: (err as Error)?.name },
          'sweep retry failed',
        );
      }
    }
    return recovered;
  }

  /** Accept a photo, store a sanitised WebP, create the row, and kick async analysis. */
  async upload(
    accountId: string,
    profileId: string,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<{ uploadId: string; status: HomeworkStatus }> {
    await assertProfileOwned(this.prisma, accountId, profileId);
    if (!ACCEPTED.has(file.mimetype)) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Nur JPEG-, PNG- oder WebP-Bilder werden akzeptiert.');
    }

    // Transcode → WebP. sharp drops EXIF by default (no .withMetadata()), satisfying the EXIF-strip rule.
    let webp: Buffer;
    try {
      webp = await sharp(file.buffer)
        .rotate() // apply orientation before metadata is dropped
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Das Bild konnte nicht verarbeitet werden.');
    }

    const key = await this.storage.writeUserBinary(accountId, profileId, `homework/${randomUUID()}.webp`, webp, 'image/webp');
    const row = await this.prisma.homeworkUpload.create({
      data: { profileId, imageKey: key, status: 'pending_analysis' },
      select: { id: true },
    });

    // Fire-and-forget vision; the upload response doesn't wait on the model. (A durable job queue replaces
    // this later; on failure the row stays pending_analysis and can be retried.)
    void this.analyze(row.id).catch((err) =>
      this.logger.warn({ event: 'homework.analyze_failed', uploadId: row.id, name: (err as Error)?.name }, 'analysis failed'),
    );

    this.logger.log({ event: 'homework.uploaded', uploadId: row.id }, 'homework uploaded');
    return { uploadId: row.id, status: 'pending_analysis' };
  }

  /** Run vision → draft, then enqueue for review. Best-effort: leaves pending_analysis on any failure. */
  async analyze(uploadId: string): Promise<void> {
    const row = await this.prisma.homeworkUpload.findUnique({
      where: { id: uploadId },
      select: { id: true, imageKey: true, status: true },
    });
    if (!row || row.status !== 'pending_analysis') return;

    const bytes = await this.storage.readBinary(row.imageKey);
    if (!bytes) {
      this.logger.warn({ event: 'homework.image_missing', uploadId }, 'image not found for analysis');
      return;
    }

    const analysis: HomeworkAnalysis = await this.llm.extract(homeworkAnalysisSchema, 'homework_analysis', {
      system: VISION_SYSTEM,
      messages: [{ role: 'user', text: 'Analysiere diese Hausübung.' }],
      image: { mediaType: 'image/webp', dataBase64: bytes.toString('base64') },
    });

    // Only advance if still pending_analysis (don't clobber a concurrent transition).
    const moved = await this.prisma.homeworkUpload.updateMany({
      where: { id: uploadId, status: 'pending_analysis' },
      data: { llmAnalysis: analysis as unknown as Prisma.InputJsonValue, status: 'pending_review' },
    });
    if (moved.count > 0) {
      this.logger.log({ event: 'homework.analyzed', uploadId }, 'draft ready, enqueued for review');
    }
  }

  /** Family status view: the authoritative result only, and only once reviewed — never the draft (§10). */
  async result(
    accountId: string,
    uploadId: string,
  ): Promise<{ status: HomeworkStatus; reviewedAnalysis: HomeworkAnalysis | null }> {
    const row = await this.prisma.homeworkUpload.findFirst({
      where: { id: uploadId, profile: { accountId } },
      select: { status: true, reviewedAnalysis: true },
    });
    if (!row) throw new ApiException(404, 'NOT_FOUND', 'Hausübung nicht gefunden.');

    const status = row.status as HomeworkStatus;
    const reviewed =
      status === 'reviewed' ? (homeworkAnalysisSchema.safeParse(row.reviewedAnalysis).data ?? null) : null;
    return { status, reviewedAnalysis: reviewed };
  }
}
