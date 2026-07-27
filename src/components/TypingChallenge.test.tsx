import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypingChallenge } from './TypingChallenge';

describe('TypingChallenge', () => {
  it('calls onSuccess when the typed sentence matches (case/whitespace-insensitive)', async () => {
    const onSuccess = vi.fn();
    render(<TypingChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    await userEvent.type(screen.getByRole('textbox'), '  you SHOULD take it easy.  ');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows a comparison and does not call onSuccess when the answer is wrong', async () => {
    const onSuccess = vi.fn();
    render(<TypingChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    await userEvent.type(screen.getByRole('textbox'), 'You should take it slow.');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/내 입력: You should take it slow\./)).toBeInTheDocument();
    expect(screen.getByText(/정답: You should take it easy\./)).toBeInTheDocument();
  });

  it('allows retrying after a wrong answer', async () => {
    const onSuccess = vi.fn();
    render(<TypingChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'wrong answer');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(onSuccess).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, 'You should take it easy.');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
