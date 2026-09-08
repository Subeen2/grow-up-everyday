import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OxChallenge } from './OxChallenge';

const target = { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' };
const other = { date: '2026-07-20', word: 'figure out', meaningKo: '알아내다' };

describe('OxChallenge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the word and a meaning, and calls onSuccess when "O" is picked for a true question', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9); // wantsFalse = false
    const onSuccess = vi.fn();

    render(<OxChallenge targetEntry={target} archivePool={[target, other]} onSuccess={onSuccess} />);

    expect(screen.getByText('awesome - 정말 멋진')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'O' }));

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows a wrong-answer message and does not call onSuccess when the wrong button is picked', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9); // wantsFalse = false, so this is a true question
    const onSuccess = vi.fn();

    render(<OxChallenge targetEntry={target} archivePool={[target, other]} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: 'X' }));

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('땡! 다시 골라보세요')).toBeInTheDocument();
  });

  it('allows retrying after a wrong answer', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9); // wantsFalse = false, so this is a true question
    const onSuccess = vi.fn();

    render(<OxChallenge targetEntry={target} archivePool={[target, other]} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: 'X' }));
    expect(onSuccess).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'O' }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('substitutes another meaning and calls onSuccess when "X" is picked for a false question', async () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // wantsFalse = true
      .mockReturnValueOnce(0); // pickRandomOtherWord picks the first candidate
    const onSuccess = vi.fn();

    render(<OxChallenge targetEntry={target} archivePool={[target, other]} onSuccess={onSuccess} />);

    expect(screen.getByText('awesome - 알아내다')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'X' }));

    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
