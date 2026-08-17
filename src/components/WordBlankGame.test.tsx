import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordBlankGame } from './WordBlankGame';

const challenge = { before: 'This place is ', after: '!', answer: 'awesome' };

describe('WordBlankGame', () => {
  it('renders the sentence with a blank in place of the target word', () => {
    render(
      <WordBlankGame challenge={challenge} meaningHint="정말 멋진" onCorrect={vi.fn()} onSkip={vi.fn()} />
    );

    expect(screen.getByText(/This place is/)).toBeInTheDocument();
    expect(screen.getByText('힌트: 정말 멋진')).toBeInTheDocument();
    expect(screen.queryByText(/awesome/)).not.toBeInTheDocument();
  });

  it('shows success feedback and a next button on a correct answer (case/whitespace-insensitive)', async () => {
    const onCorrect = vi.fn();
    render(
      <WordBlankGame challenge={challenge} meaningHint="정말 멋진" onCorrect={onCorrect} onSkip={vi.fn()} />
    );

    await userEvent.type(screen.getByRole('textbox'), '  AWESOME  ');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(screen.getByText(/정답이에요/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '다음 문제 →' }));
    expect(onCorrect).toHaveBeenCalledOnce();
  });

  it('shows an incorrect message and allows retrying on a wrong answer', async () => {
    const onCorrect = vi.fn();
    render(
      <WordBlankGame challenge={challenge} meaningHint="정말 멋진" onCorrect={onCorrect} onSkip={vi.fn()} />
    );

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'great');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(screen.getByText('다시 시도해보세요!')).toBeInTheDocument();
    expect(onCorrect).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, 'awesome');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(screen.getByText(/정답이에요/)).toBeInTheDocument();
  });

  it('calls onSkip when giving up on the current question', async () => {
    const onSkip = vi.fn();
    render(
      <WordBlankGame challenge={challenge} meaningHint="정말 멋진" onCorrect={vi.fn()} onSkip={onSkip} />
    );

    await userEvent.click(screen.getByRole('button', { name: '모르겠어요, 다음 문제' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
