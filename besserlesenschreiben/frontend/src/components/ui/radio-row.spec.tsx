import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { RadioRow } from './radio-row';

const OPTIONS = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'auto', label: 'Automatisch' },
] as const;

describe('RadioRow', () => {
  it('renders a radiogroup with the selected option checked', () => {
    const { getByRole } = render(
      <RadioRow label="Aussehen" value="auto" options={OPTIONS} onChange={() => {}} />,
    );
    expect(getByRole('radiogroup', { name: 'Aussehen' })).toBeInTheDocument();
    expect(getByRole('radio', { name: 'Automatisch' })).toHaveAttribute('aria-checked', 'true');
    expect(getByRole('radio', { name: 'Hell' })).toHaveAttribute('aria-checked', 'false');
  });

  it('fires onChange with the clicked value', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <RadioRow label="Aussehen" value="auto" options={OPTIONS} onChange={onChange} />,
    );
    fireEvent.click(getByRole('radio', { name: 'Dunkel' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('moves selection with arrow keys (wrapping)', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <RadioRow label="Aussehen" value="auto" options={OPTIONS} onChange={onChange} />,
    );
    fireEvent.keyDown(getByRole('radio', { name: 'Automatisch' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('light'); // wraps from last to first
  });

  it('does nothing while disabled', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <RadioRow label="Aussehen" value="auto" options={OPTIONS} onChange={onChange} disabled />,
    );
    fireEvent.click(getByRole('radio', { name: 'Hell' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
