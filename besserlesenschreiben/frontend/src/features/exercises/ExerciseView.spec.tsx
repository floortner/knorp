import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Exercise } from '@/lib/types';
import session from '../../../fixtures/session.example.json';
import { ExerciseView } from './ExerciseView';

const items = (session as unknown as { items: Exercise[] }).items;

const noop = () => {};

describe('ExerciseView golden render', () => {
  it('renders placeholder from backend JSON', () => {
    const { container } = render(
      <ExerciseView ex={items[0]} onAttempt={noop} onSolved={noop} soundOn={false} />,
    );
    expect(container).toMatchSnapshot();
  });
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

describe('placeholder interaction', () => {
  const placeholder = items[0];

  it('reports each attempt and solves only on the correct option', async () => {
    const user = userEvent.setup();
    const onAttempt = vi.fn();
    const onSolved = vi.fn();
    render(<ExerciseView ex={placeholder} onAttempt={onAttempt} onSolved={onSolved} soundOn={false} />);

    // placeholder fixture: answer is Apfel; distractors Birne, Kirsche
    await user.click(screen.getByRole('button', { name: 'Birne' })); // wrong
    expect(onAttempt).toHaveBeenLastCalledWith('Birne', false);
    expect(onSolved).not.toHaveBeenCalled();
    expect(screen.getByText(/Nochmal versuchen/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apfel' })); // correct
    expect(onAttempt).toHaveBeenLastCalledWith('Apfel', true);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});
