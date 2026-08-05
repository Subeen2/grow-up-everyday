import { act } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceChallenge } from './VoiceChallenge';

const targetEntry = {
  exampleJa: '今日は大丈夫です。',
  exampleReading: 'きょうはだいじょうぶです',
};

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: { results: { 0: { transcript: string } }[][] }) => void) | null = null;
  onerror: (() => void) | null = null;
  abort = vi.fn();
  start() {
    FakeRecognition.instances.push(this);
  }
}

function resolveWithTranscript(text: string) {
  const instance = FakeRecognition.instances[FakeRecognition.instances.length - 1];
  act(() => {
    instance.onresult?.({ results: [[{ transcript: text }]] } as any);
  });
}

describe('VoiceChallenge', () => {
  afterEach(() => {
    delete (window as any).SpeechRecognition;
    FakeRecognition.instances = [];
  });

  it('shows an unsupported message when the browser has no SpeechRecognition', () => {
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={vi.fn()} />);
    expect(screen.getByText(/음성인식을 지원하지 않아요/)).toBeInTheDocument();
  });

  it('calls onSuccess when the recognized transcript matches the kanji example', async () => {
    (window as any).SpeechRecognition = FakeRecognition;
    const onSuccess = vi.fn();
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByText('🎤 말하기'));
    resolveWithTranscript('今日は大丈夫です。');

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('calls onSuccess when the recognized transcript matches the hiragana reading', async () => {
    (window as any).SpeechRecognition = FakeRecognition;
    const onSuccess = vi.fn();
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByText('🎤 말하기'));
    resolveWithTranscript('きょうはだいじょうぶです');

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows a comparison and does not call onSuccess when the transcript is wrong', async () => {
    (window as any).SpeechRecognition = FakeRecognition;
    const onSuccess = vi.fn();
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByText('🎤 말하기'));
    resolveWithTranscript('明日は大丈夫です。');

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/내가 말한 문장: 明日は大丈夫です。/)).toBeInTheDocument();
    expect(screen.getByText(/정답: 今日は大丈夫です。/)).toBeInTheDocument();
  });

  it('shows a retry message on a recognition error', async () => {
    class ErrorRecognition extends FakeRecognition {
      start() {
        this.onerror?.();
      }
    }
    (window as any).SpeechRecognition = ErrorRecognition;
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={vi.fn()} />);

    await userEvent.click(screen.getByText('🎤 말하기'));

    expect(screen.getByText('다시 시도해주세요')).toBeInTheDocument();
  });

  it('aborts an in-flight recognition when unmounted', async () => {
    (window as any).SpeechRecognition = FakeRecognition;
    const { unmount } = render(
      <VoiceChallenge targetEntry={targetEntry} onSuccess={vi.fn()} />
    );

    await userEvent.click(screen.getByText('🎤 말하기'));
    const instance = FakeRecognition.instances[FakeRecognition.instances.length - 1];

    unmount();

    expect(instance.abort).toHaveBeenCalledOnce();
  });
});
