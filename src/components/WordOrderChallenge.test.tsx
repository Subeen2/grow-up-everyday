import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordOrderChallenge } from './WordOrderChallenge';

describe('WordOrderChallenge', () => {
  it('assembles the sentence and calls onSuccess when tapped in the correct order', async () => {
    const onSuccess = vi.fn();
    render(<WordOrderChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    for (const word of ['You', 'should', 'take', 'it', 'easy.']) {
      await userEvent.click(screen.getByRole('button', { name: word }));
    }

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows the assembled sentence as tokens are tapped', async () => {
    const onSuccess = vi.fn();
    render(<WordOrderChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: 'You' }));
    await userEvent.click(screen.getByRole('button', { name: 'should' }));

    expect(screen.getByText('You should')).toBeInTheDocument();
  });

  it('shows a wrong-order message, does not call onSuccess, and resets so it can be retried', async () => {
    const onSuccess = vi.fn();
    render(<WordOrderChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    for (const word of ['should', 'You', 'take', 'it', 'easy.']) {
      await userEvent.click(screen.getByRole('button', { name: word }));
    }

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('순서가 달라요! 다시 시도해보세요')).toBeInTheDocument();

    for (const word of ['You', 'should', 'take', 'it', 'easy.']) {
      await userEvent.click(screen.getByRole('button', { name: word }));
    }

    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
