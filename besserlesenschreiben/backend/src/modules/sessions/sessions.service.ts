import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { assertProfileOwned } from '../../common/ownership';
import { daysAgo, startOfUtcDay, startOfUtcWeek } from '../../common/dates';
import { STARS_PER_SESSION, leagueFor, nextStreak, type League } from '../progress/gamification';
import { LlmService } from '../../services/llm/llm.service';
import { DigestService } from '../../services/digest/digest.service';
import { solvableExerciseSchema } from '../../contract/exercise';
import { SKILL_TAGS } from '../../contract/skills';
import { homeworkAnalysisSchema } from '../../contract/staff';
import { Prisma } from '../../generated/prisma/client';
import { toExercise } from './exercise.mapper';
import { selectBankItems, weakSkills } from './session-select';
import { UNIT_CATALOG, unitStatus } from './units.catalog';
import type { CreateSessionInput } from './sessions.dto';

const RECENT_WINDOW_DAYS = 14;
const RECENT_ATTEMPT_LIMIT = 200;
const LLM_ITEM_UNIT = 0; // sentinel: generated items live outside the curated unit catalogue (1..N)
const LLM_SESSION_SIZE = 6;

/**
 * What the model returns: a batch of wire-shaped exercises (id/audioUrl are placeholders we overwrite).
 * Uses the SOLVABLE schema — a generated exercise whose answer isn't among its options (etc.) or that
 * carries an unknown skill tag is rejected, never persisted.
 */
const generatedSessionSchema = z.object({
  exercises: z.array(solvableExerciseSchema).min(1).max(LLM_SESSION_SIZE),
});

// One compact, valid exemplar per common type — few-shot examples are the biggest lever on structured
// generation quality. Kept byte-stable so the system prompt can be prompt-cached across calls.
const FEW_SHOT = JSON.stringify({
  exercises: [
    { type: 'count', word: 'Banane', syll: ['Ba', 'na', 'ne'], answer: 3, opts: [2, 3, 4], skillTags: ['syllable_count'], praise: 'Toll gezählt!', id: 'x', audioUrl: null },
    { type: 'rhyme', word: 'Haus', options: ['Maus', 'Tisch', 'Ball'], answer: 'Maus', skillTags: ['rhyme'], praise: 'Das reimt sich!', id: 'x', audioUrl: null },
    { type: 'order', word: 'Sonne', syll: ['Son', 'ne'], tiles: ['ne', 'Son'], skillTags: ['syllable_order'], praise: 'Super sortiert!', id: 'x', audioUrl: null },
  ],
});

const LLM_SYSTEM = [
  'Du generierst deutsche Grundschul-Übungen zum Lesen und Schreiben.',
  `Erzeuge bis zu ${LLM_SESSION_SIZE} abwechslungsreiche Übungen, die GENAU auf die genannten Förderschwerpunkte und die Klassenstufe zielen.`,
  'Jede Übung MUSS eindeutig korrekt lösbar sein: bei "count" ist answer die richtige Silbenzahl und in opts enthalten;',
  'bei "order"/"arrange" sind tiles genau die syll in anderer Reihenfolge; bei "pairs" sind beide pair-Wörter in tiles und reimen sich;',
  'bei allen Auswahlübungen ist answer in options enthalten; bei "build" lässt sich answer aus tiles legen.',
  `Verwende in skillTags NUR Werte aus dieser Liste: ${SKILL_TAGS.join(', ')}.`,
  'Setze einen kurzen, motivierenden deutschen praise. id darf ein Platzhalter sein, audioUrl=null.',
  `Beispiel für gültiges JSON:\n${FEW_SHOT}`,
].join(' ');

/**
 * A coarse difficulty band from the child's current unit (unlockedUnit 1..N). Sent to the model so a
 * grade-1 child and an advanced child get differently-calibrated content, and stored as the generated
 * item's `difficulty` so bank selection can order it sensibly.
 */
function gradeBand(unlockedUnit: number): { label: string; difficulty: number } {
  if (unlockedUnit <= 2) return { label: 'Anfang (erste Klasse, sehr einfach, kurze Wörter)', difficulty: 1 };
  if (unlockedUnit <= 5) return { label: 'Mitte (zweite Klasse, mittlere Wörter)', difficulty: 2 };
  return { label: 'Fortgeschritten (dritte Klasse, längere Wörter, kniffliger)', difficulty: 3 };
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger('SessionsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly digest: DigestService,
  ) {}

  /** GET /units — the catalogue with live per-profile status + item counts. */
  async units(accountId: string, profileId?: string) {
    const profile = profileId
      ? await assertProfileOwned(this.prisma, accountId, profileId)
      : await this.prisma.profile.findFirst({ where: { accountId }, orderBy: { createdAt: 'asc' } });
    const unlocked = profile?.unlockedUnit ?? 1;

    const counts = await this.prisma.itemBank.groupBy({ by: ['unit'], _count: { _all: true } });
    const countByUnit = new Map(counts.map((c) => [c.unit, c._count._all]));

    return UNIT_CATALOG.map((u) => ({
      unit: u.unit,
      title: u.title,
      subtitle: u.subtitle,
      focus: u.focus,
      exerciseTypes: u.exerciseTypes,
      itemCount: countByUnit.get(u.unit) ?? 0,
      status: unitStatus(u.unit, unlocked),
      theme: u.theme,
    }));
  }

  /**
   * POST /sessions — generate a deterministic bank session (SPEC §8A). Zero LLM calls: the DB decides
   * what to drill from recent weakness + FSRS-due skills, the item bank supplies the content.
   */
  async createBank(accountId: string, dto: CreateSessionInput) {
    const profile = await assertProfileOwned(this.prisma, accountId, dto.profileId);
    const unit = dto.unit ?? profile.unlockedUnit;
    if (unit > profile.unlockedUnit) {
      throw new ApiException(403, 'UNIT_LOCKED', 'Diese Einheit ist noch gesperrt.');
    }

    const items = await this.prisma.itemBank.findMany({ where: { unit } });
    if (items.length === 0) {
      throw new ApiException(404, 'NO_ITEMS', 'Für diese Einheit gibt es noch keine Übungen.');
    }

    const now = new Date();
    const recent = await this.prisma.attempt.findMany({
      where: { profileId: profile.id, createdAt: { gte: daysAgo(now, RECENT_WINDOW_DAYS) } },
      select: { skillTags: true, isCorrect: true, timeMs: true },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ATTEMPT_LIMIT,
    });
    const due = await this.prisma.reviewState.findMany({
      where: { profileId: profile.id, due: { lte: now } },
      select: { skillTag: true },
    });
    const priority = new Set<string>([...weakSkills(recent), ...due.map((d) => d.skillTag)]);

    const selected = selectBankItems(items, priority);
    const session = await this.prisma.session.create({
      data: { profileId: profile.id, unit, itemIds: selected.map((i) => i.id), source: 'bank' },
    });

    this.logger.log(
      { event: 'session.created', sessionId: session.id, unit, items: selected.length, prioritised: priority.size },
      'bank session generated',
    );

    return {
      sessionId: session.id,
      profileId: profile.id,
      unit,
      generatedAt: session.createdAt,
      items: selected.map(toExercise),
    };
  }

  /**
   * POST /sessions {source:'llm'} — generate a lecture on the fly (SPEC §8B, free ★). The DB still decides
   * WHAT to drill (recent weakness + FSRS-due + professionally-reviewed homework focus); the LLM only
   * produces NEW content for those skills, validated against the Exercise contract, stored as
   * `generated_by='llm'` items (unit 0, outside the curated catalogue) and returned as a normal session.
   */
  async createLlm(accountId: string, dto: CreateSessionInput) {
    const profile = await assertProfileOwned(this.prisma, accountId, dto.profileId);
    if (!this.llm.available) {
      throw new ApiException(503, 'PROVIDER_UNAVAILABLE', 'KI-Sitzungen sind in dieser Umgebung nicht verfügbar.');
    }
    const unit = dto.unit ?? profile.unlockedUnit;
    const now = new Date();

    // WHAT to drill: recent weak skills + FSRS-due + the staff-validated homework focus.
    const recent = await this.prisma.attempt.findMany({
      where: { profileId: profile.id, createdAt: { gte: daysAgo(now, RECENT_WINDOW_DAYS) } },
      select: { skillTags: true, isCorrect: true, timeMs: true },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ATTEMPT_LIMIT,
    });
    const due = await this.prisma.reviewState.findMany({
      where: { profileId: profile.id, due: { lte: now } },
      select: { skillTag: true },
    });
    const reviewedHw = await this.prisma.homeworkUpload.findMany({
      where: { profileId: profile.id, status: 'reviewed' },
      orderBy: { reviewedAt: 'desc' },
      take: 5,
      select: { reviewedAnalysis: true },
    });
    const hwFocus = reviewedHw.flatMap(
      (r) => homeworkAnalysisSchema.safeParse(r.reviewedAnalysis).data?.suggestedFocus ?? [],
    );
    const focus = [...new Set<string>([...weakSkills(recent), ...due.map((d) => d.skillTag), ...hwFocus])];

    // The compact, LLM-facing performance view (best-effort context).
    let digestMd = '';
    try {
      digestMd = (await this.digest.generate(accountId, profile.id)).markdown;
    } catch {
      /* digest is optional context */
    }

    const band = gradeBand(profile.unlockedUnit);
    const focusLine = focus.length ? focus.join(', ') : 'Grundlagen: Silben, Anlaute, Reime';
    const generated = await this.llm.extract(generatedSessionSchema, 'generated_session', {
      system: LLM_SYSTEM,
      messages: [
        {
          role: 'user',
          text: `Klassenstufe: ${band.label}\nFörderschwerpunkte: ${focusLine}\n\nLernstand:\n${digestMd}`,
        },
      ],
    });

    // Persist the new items (unit 0 sentinel) + the session, then return the wire shape.
    const created = await this.prisma.$transaction(async (tx) => {
      const items = [];
      for (const ex of generated.exercises) {
        // Strip the backend-owned fields; the rest is the per-type render payload (incl. praise).
        const payload: Record<string, unknown> = { ...ex };
        for (const k of ['id', 'type', 'audioUrl', 'syllableAudio', 'skillTags']) delete payload[k];
        items.push(
          await tx.itemBank.create({
            data: {
              unit: LLM_ITEM_UNIT,
              exerciseType: ex.type,
              payload: payload as Prisma.InputJsonValue,
              skillTags: ex.skillTags,
              difficulty: band.difficulty,
              audioUrl: null,
              generatedBy: 'llm',
            },
          }),
        );
      }
      const session = await tx.session.create({
        data: { profileId: profile.id, unit, itemIds: items.map((i) => i.id), source: 'llm' },
      });
      return { session, items };
    });

    this.logger.log(
      { event: 'session.created', sessionId: created.session.id, source: 'llm', items: created.items.length, focus: focus.length },
      'llm session generated',
    );

    return {
      sessionId: created.session.id,
      profileId: profile.id,
      unit,
      generatedAt: created.session.createdAt,
      items: created.items.map(toExercise),
    };
  }

  /**
   * POST /sessions/:id/complete — award stars, advance the streak, return the league standing.
   * Idempotent: a second call returns the already-recorded standing without double-awarding.
   */
  async complete(accountId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new ApiException(404, 'NOT_FOUND', 'Session nicht gefunden.');
    const profile = await assertProfileOwned(this.prisma, accountId, session.profileId);
    const now = new Date();

    // A finished session whose unit is the last in the catalogue means the child cleared everything —
    // the backend owns this so the client never hardcodes the unit count (SPEC §12).
    const allUnitsComplete = session.unit === UNIT_CATALOG.length;

    if (session.completedAt) {
      return {
        starsAwarded: session.starsAward ?? 0,
        streakDays: profile.streakDays,
        league: await this.weeklyLeague(profile.id, now),
        allUnitsComplete,
      };
    }

    const stars = STARS_PER_SESSION;
    const streakDays = nextStreak(profile.lastActive, now, profile.streakDays);
    const shouldUnlock = session.unit === profile.unlockedUnit && profile.unlockedUnit < UNIT_CATALOG.length;
    const profileUpdate = {
      stars: { increment: stars },
      streakDays,
      lastActive: startOfUtcDay(now),
      ...(shouldUnlock ? { unlockedUnit: { increment: 1 } } : {}),
    };
    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: sessionId }, data: { completedAt: now, starsAward: stars } }),
      this.prisma.profile.update({ where: { id: profile.id }, data: profileUpdate }),
    ]);

    if (shouldUnlock) {
      this.logger.log(
        { event: 'session.unit_unlocked', unlockedUnit: profile.unlockedUnit + 1 },
        'next unit unlocked',
      );
    }
    this.logger.log({ event: 'session.completed', sessionId, stars, streakDays }, 'session completed');
    return { starsAwarded: stars, streakDays, league: await this.weeklyLeague(profile.id, now), allUnitsComplete };
  }

  /** League from stars earned since Monday this week (sum of completed sessions' awards). */
  private async weeklyLeague(profileId: string, now: Date): Promise<League> {
    const agg = await this.prisma.session.aggregate({
      _sum: { starsAward: true },
      where: { profileId, completedAt: { gte: startOfUtcWeek(now) } },
    });
    return leagueFor(agg._sum.starsAward ?? 0);
  }
}
