import { useEffect, useRef, useState } from 'react';
import { isCorrectJaAnswer } from '../lib/voiceChallenge';
import { PixelButton } from './PixelButton';

interface VoiceChallengeTarget {
  exampleJa: string;
  exampleReading: string;
}

interface VoiceChallengeProps {
  targetEntry: VoiceChallengeTarget;
  onSuccess: () => void;
}

type ChallengeStatus =
  | { kind: 'idle' }
  | { kind: 'listening' }
  | { kind: 'incorrect'; submitted: string }
  | { kind: 'unsupported' }
  | { kind: 'error' };

function getSpeechRecognitionCtor(): (new () => any) | undefined {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

export function VoiceChallenge({ targetEntry, onSuccess }: VoiceChallengeProps) {
  const [status, setStatus] = useState<ChallengeStatus>({ kind: 'idle' });
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!getSpeechRecognitionCtor()) {
      setStatus({ kind: 'unsupported' });
    }
  }, []);

  useEffect(() => {
    return () => recognitionRef.current?.abort?.();
  }, []);

  function handleStart() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatus({ kind: 'unsupported' });
      return;
    }
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string;
      if (isCorrectJaAnswer(transcript, targetEntry)) {
        setStatus({ kind: 'idle' });
        onSuccess();
      } else {
        setStatus({ kind: 'incorrect', submitted: transcript });
      }
    };
    recognition.onerror = () => setStatus({ kind: 'error' });

    setStatus({ kind: 'listening' });
    recognition.start();
  }

  if (status.kind === 'unsupported') {
    return (
      <div className="voice-challenge">
        <p className="voice-challenge__unsupported">
          이 브라우저는 음성인식을 지원하지 않아요. Chrome/Edge로 접속해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="voice-challenge">
      <PixelButton onClick={handleStart} disabled={status.kind === 'listening'}>
        {status.kind === 'listening' ? '듣고 있어요...' : '🎤 말하기'}
      </PixelButton>
      {status.kind === 'error' && <p className="voice-challenge__error">다시 시도해주세요</p>}
      {status.kind === 'incorrect' && (
        <div className="voice-challenge__comparison">
          <p className="voice-challenge__submitted">내가 말한 문장: {status.submitted}</p>
          <p className="voice-challenge__target">정답: {targetEntry.exampleJa}</p>
        </div>
      )}
    </div>
  );
}
