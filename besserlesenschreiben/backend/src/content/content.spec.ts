import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLectureFile } from './parser';
import { loadContentDir } from './loader';
import { exerciseHash, lectureHash, stableStringify } from './hash';
import { diffSkillsLock, renderSkillsLock } from './skills-lock';

/**
 * The lecture-file pipeline (ROADMAP §I): parser/validator + canonical hashing + skills lock.
 * The German error messages are part of the product — they are the linguists' CI feedback — so the
 * main shapes are asserted here (substring, not snapshot: wording may be polished, meaning may not).
 */

const VALID = `---
title: "Test-Lektion"
intro: "Der Merksatz."
exercises:
  - id: aufgabe-1
    type: placeholder
    prompt: "Frage?"
    options: ["eins", "zwei"]
    answer: "eins"
    praise: "Toll!"
    skills: [placeholder]
---

Reservierter Erklärtext.
`;

function parseOk(raw: string, file = 'content/lectures/test-lektion.md') {
  const result = parseLectureFile(file, raw);
  if (!result.ok) throw new Error(`expected ok, got: ${JSON.stringify(result.errors)}`);
  return result.lecture;
}

function parseErrors(raw: string, file = 'content/lectures/test-lektion.md') {
  const result = parseLectureFile(file, raw);
  if (result.ok) throw new Error('expected errors, got ok');
  return result.errors;
}

describe('parseLectureFile — happy path', () => {
  it('parses a valid file: slug from filename, defaults applied, body preserved', () => {
    const lecture = parseOk(VALID);
    expect(lecture.slug).toBe('test-lektion');
    expect(lecture.title).toBe('Test-Lektion');
    expect(lecture.status).toBe('published'); // default
    expect(lecture.exercises[0].difficulty).toBe(1); // default
    expect(lecture.skillTags).toEqual(['placeholder']); // computed union
    expect(lecture.body).toBe('Reservierter Erklärtext.');
    expect(lecture.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts status: draft', () => {
    const lecture = parseOk(VALID.replace('exercises:', 'status: draft\nexercises:'));
    expect(lecture.status).toBe('draft');
  });

  it('deduplicates the computed skillTags union preserving order', () => {
    const raw = VALID.replace(
      '---\n\nReserv',
      `  - id: aufgabe-2
    type: placeholder
    prompt: "Noch eine?"
    options: ["ja", "nein"]
    answer: "ja"
    praise: "Super!"
    skills: [placeholder]
---

Reserv`,
    );
    expect(parseOk(raw).skillTags).toEqual(['placeholder']);
  });
});

describe('parseLectureFile — validation errors (German, path-addressed)', () => {
  it('rejects an invalid slug (filename)', () => {
    const errors = parseErrors(VALID, 'content/lectures/Große_Datei.md');
    expect(errors[0].message).toContain('ungültiger Dateiname');
  });

  it('rejects a file without frontmatter', () => {
    const errors = parseErrors('# nur Markdown\n');
    expect(errors[0].message).toContain('kein YAML-Frontmatter');
  });

  it('rejects broken YAML with a readable message', () => {
    const errors = parseErrors('---\ntitle: "unterminated\n---\n');
    expect(errors[0].message).toContain('YAML-Frontmatter konnte nicht gelesen werden');
  });

  it('reports a missing required field as Pflichtfeld with its path', () => {
    const errors = parseErrors(VALID.replace('intro: "Der Merksatz."\n', ''));
    expect(errors).toContainEqual(
      expect.objectContaining({ path: 'intro', message: expect.stringContaining('Pflichtfeld fehlt') }),
    );
  });

  it('rejects an over-long intro (>300) with a length message', () => {
    const errors = parseErrors(VALID.replace('"Der Merksatz."', `"${'x'.repeat(301)}"`));
    expect(errors).toContainEqual(
      expect.objectContaining({ path: 'intro', message: expect.stringContaining('höchstens 300 Zeichen') }),
    );
  });

  it('rejects unknown keys (typo protection) naming the key', () => {
    const errors = parseErrors(VALID.replace('praise:', 'phrase: "x"\n    praise:'));
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: 'exercises[0]',
        message: expect.stringContaining('phrase'),
      }),
    );
  });

  it('rejects an out-of-taxonomy skill tag as unbekannter Skill-Tag', () => {
    const errors = parseErrors(VALID.replace('skills: [placeholder]', 'skills: [erfundene-faehigkeit]'));
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: 'exercises[0].skills[0]',
        message: expect.stringContaining('unbekannter Skill-Tag'),
      }),
    );
  });

  it('rejects too many exercises (>12)', () => {
    const one = `  - id: aufgabe-N
    type: placeholder
    prompt: "Frage?"
    options: ["eins", "zwei"]
    answer: "eins"
    praise: "Toll!"
    skills: [placeholder]\n`;
    const thirteen = Array.from({ length: 13 }, (_, i) => one.replace('aufgabe-N', `aufgabe-${i}`)).join('');
    const raw = `---\ntitle: "Zu viele"\nintro: "Merksatz."\nexercises:\n${thirteen}---\n`;
    const errors = parseErrors(raw);
    expect(errors).toContainEqual(
      expect.objectContaining({ path: 'exercises', message: expect.stringContaining('höchstens 12') }),
    );
  });

  it('enforces the solvability gate: answer must be among options (German message)', () => {
    const errors = parseErrors(VALID.replace('answer: "eins"', 'answer: "drei"'));
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: 'exercises[0].answer',
        message: 'Antwort „drei" ist nicht in den Antwortmöglichkeiten (options) enthalten',
      }),
    );
  });

  it('rejects duplicate exercise ids within a file', () => {
    const raw = VALID.replace(
      '---\n\nReserv',
      `  - id: aufgabe-1
    type: placeholder
    prompt: "Doppelt?"
    options: ["ja", "nein"]
    answer: "ja"
    praise: "Super!"
    skills: [placeholder]
---

Reserv`,
    );
    const errors = parseErrors(raw);
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: 'exercises[1].id',
        message: expect.stringContaining('doppelte Aufgaben-ID'),
      }),
    );
  });

  it('collects ALL errors of a stage, never fail-fast', () => {
    const raw = VALID.replace('answer: "eins"', 'answer: "drei"').replace(
      '---\n\nReserv',
      `  - id: aufgabe-2
    type: placeholder
    prompt: "Noch eine?"
    options: ["ja", "nein"]
    answer: "vielleicht"
    praise: "Super!"
    skills: [placeholder]
---

Reserv`,
    );
    const errors = parseErrors(raw);
    expect(errors.map((e) => e.path)).toEqual(['exercises[0].answer', 'exercises[1].answer']);
  });
});

describe('hashing — canonical + version-bump semantics', () => {
  const ex = {
    type: 'placeholder',
    prompt: 'Frage?',
    options: ['eins', 'zwei'],
    answer: 'eins',
    praise: 'Toll!',
    skills: ['placeholder'],
    difficulty: 1,
  };

  it('stableStringify is key-order independent', () => {
    expect(stableStringify({ b: 1, a: [{ y: 2, x: 3 }] })).toBe(stableStringify({ a: [{ x: 3, y: 2 }] , b: 1 }));
  });

  it('exerciseHash changes with content, not with exercise id', () => {
    expect(exerciseHash({ ...ex })).toBe(exerciseHash({ ...ex }));
    expect(exerciseHash({ ...ex, prompt: 'Andere Frage?' })).not.toBe(exerciseHash(ex));
  });

  it('lectureHash: status change does NOT bump, reorder DOES bump', () => {
    const base = parseOk(VALID);
    const draft = parseOk(VALID.replace('exercises:', 'status: draft\nexercises:'));
    expect(draft.contentHash).toBe(base.contentHash); // draft→published is not a content change

    const two = { title: 't', intro: 'i', exercises: [{ id: 'a', hash: 'h1' }, { id: 'b', hash: 'h2' }] };
    const reordered = { ...two, exercises: [two.exercises[1], two.exercises[0]] };
    expect(lectureHash(reordered)).not.toBe(lectureHash(two));
  });
});

describe('loadContentDir — the committed content/ directory is valid', () => {
  const contentDir = join(__dirname, '..', '..', '..', '..', 'content');

  it('loads without errors and skips _-prefixed files', () => {
    const { lectures, errors } = loadContentDir(contentDir);
    expect(errors).toEqual([]);
    expect(lectures.length).toBeGreaterThan(0);
    expect(lectures.some((l) => l.slug.startsWith('_'))).toBe(false);
  });

  it('the committed skills.lock.json matches the taxonomy', async () => {
    const { SKILL_TAGS } = await import('../contract/skills.js');
    const lock = JSON.parse(readFileSync(join(contentDir, 'skills.lock.json'), 'utf8')) as string[];
    expect(diffSkillsLock(lock, SKILL_TAGS)).toEqual({ added: [], removed: [] });
  });
});

describe('skills lock', () => {
  it('flags additions and removals separately', () => {
    expect(diffSkillsLock(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
    expect(diffSkillsLock(['a'], ['a'])).toEqual({ added: [], removed: [] });
  });

  it('renders sorted with trailing newline', () => {
    expect(renderSkillsLock(['b', 'a'])).toBe('[\n  "a",\n  "b"\n]\n');
  });
});
