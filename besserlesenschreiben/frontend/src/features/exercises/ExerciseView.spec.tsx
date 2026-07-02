import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Exercise } from '@/lib/types';
import session from '../../../fixtures/session.example.json';
import { ExerciseView } from './ExerciseView';

const items = (session as unknown as { items: Exercise[] }).items;

const noop = () => {};

describe('ExerciseView golden render', () => {
  // Pins the rendering contract for all 14 Vokaltraining types against the golden fixture.
  for (const ex of items) {
    it(`renders ${ex.type} from backend JSON`, () => {
      const { container } = render(
        <ExerciseView ex={ex} onAttempt={noop} onSolved={noop} soundOn={false} />,
      );
      expect(container).toMatchSnapshot();
    });
  }
});

describe('renderer safety', () => {
  it('throws on an unknown exercise type (so the lesson boundary can catch it)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bogus = { id: 'x', type: 'mystery', skillTags: [] } as unknown as Exercise;
    expect(() =>
      render(<ExerciseView ex={bogus} onAttempt={noop} onSolved={noop} soundOn={false} />),
    ).toThrow(/Unhandled exercise type: mystery/);
    spy.mockRestore();
  });
});

describe('single-choice interaction (fixvowel)', () => {
  const fixvowel = items.find((i) => i.type === 'fixvowel')!;

  it('reports each attempt and solves only on the correct option', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={fixvowel} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // fixvowel fixture: Hend + a → Hand; distractors Ball, Wand
    await user.click(screen.getByRole('button', { name: 'Ball' })); // wrong
    expect(onAttempt).toHaveBeenLastCalledWith('Ball', false);
    expect(onSolved).not.toHaveBeenCalled();
    expect(screen.getByText(/Nochmal versuchen/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hand' })); // correct
    expect(onAttempt).toHaveBeenLastCalledWith('Hand', true);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});

describe('binary interaction (realword)', () => {
  const realword = items.find((i) => i.type === 'realword')!;

  it('solves on the correct side and reports the plain answer key', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={realword} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // realword fixture: "Tür" is a real word
    await user.click(screen.getByRole('button', { name: /Quatschwort/ })); // wrong
    expect(onAttempt).toHaveBeenLastCalledWith('quatsch', false);
    expect(onSolved).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Echtes Wort/ }));
    expect(onAttempt).toHaveBeenLastCalledWith('wort', true);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});

describe('findvowel: duplicate letters stay tappable, telemetry gets the plain letter', () => {
  const findvowel = items.find((i) => i.type === 'findvowel')!;

  it('reports the letter value (not the indexed key)', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={findvowel} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // findvowel fixture: Schal → vowel a
    await user.click(screen.getByRole('button', { name: 'a' }));
    expect(onAttempt).toHaveBeenLastCalledWith('a', true);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});

describe('swapvowel: any accepted vowel solves', () => {
  const swapvowel = items.find((i) => i.type === 'swapvowel')!;

  it('accepts a vowel from answers and rejects one outside it', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={swapvowel} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // swapvowel fixture: Hand → only u makes a real word (Hund); o/i do not
    await user.click(screen.getByRole('button', { name: 'o' }));
    expect(onAttempt).toHaveBeenLastCalledWith('o', false);

    await user.click(screen.getByRole('button', { name: 'u' }));
    expect(onAttempt).toHaveBeenLastCalledWith('u', true);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});

describe('raster interaction', () => {
  const raster = items.find((i) => i.type === 'raster')!;

  it('solves when the parts are placed as Anfang → Vokal → Ende', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={raster} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // raster fixture: Schnur = Schn · u · r
    await user.click(screen.getByRole('button', { name: 'Schn' }));
    await user.click(screen.getByRole('button', { name: 'u' }));
    await user.click(screen.getByRole('button', { name: 'r' }));

    expect(onAttempt).toHaveBeenCalledWith('Schn|u|r', true);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});

describe('tile-order interaction (sylarrange)', () => {
  const sylarrange = items.find((i) => i.type === 'sylarrange')!;

  it('solves when tiles are tapped in the syllable order', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={sylarrange} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // sylarrange fixture: Gleichgewicht, syll [Gleich, ge, wicht]
    await user.click(screen.getByRole('button', { name: 'Gleich' }));
    await user.click(screen.getByRole('button', { name: 'ge' }));
    await user.click(screen.getByRole('button', { name: 'wicht' }));

    expect(onAttempt).toHaveBeenCalledWith('Gleich|ge|wicht', true);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});

describe('sentencefix interaction', () => {
  const sentencefix = items.find((i) => i.type === 'sentencefix')!;

  it('solves when the misspelled word is tapped and shows the correction', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={sentencefix} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // sentencefix fixture: "Die Schöle ist aus." → Schöle (richtig: Schule)
    await user.click(screen.getByRole('button', { name: 'ist' }));
    expect(onAttempt).toHaveBeenLastCalledWith('ist', false);

    await user.click(screen.getByRole('button', { name: 'Schöle' }));
    expect(onAttempt).toHaveBeenLastCalledWith('Schöle', true);
    expect(onSolved).toHaveBeenCalledOnce();
    expect(screen.getByText(/Richtig heißt es: Schule/)).toBeInTheDocument();
  });
});
