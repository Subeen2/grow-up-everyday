import { FormEvent, useState } from 'react';
import { describeProfile, EnProfile, JaProfile, loadProfile, saveProfile } from '../lib/learnerProfile';
import { ChatMessage, ExplainRequest, MAX_FOLLOW_UPS, QUESTION_MAX_LENGTH } from '../lib/explainContract';
import { findRelatedJaWords, recentEnWords } from '../lib/explainRetrieval';
import {
  EXPLAIN_ERROR_MESSAGES,
  ExplainError,
  ExplainErrorKind,
  getExplainApiUrl,
  requestExplanation,
  toExplainEntry,
} from '../lib/explainApi';
import type { ArchiveIndexItem, JaArchiveIndexItem, JaWordEntry, WordEntry } from '../lib/wordTypes';
import { EnProfileForm, JaProfileForm } from './LearnerProfileForm';
import { PixelButton } from './PixelButton';

type ExplainPanelProps =
  | { language: 'ja'; entry: JaWordEntry; archivePool: JaArchiveIndexItem[] }
  | { language: 'en'; entry: WordEntry; archivePool: ArchiveIndexItem[] };

type Mode = 'closed' | 'profile' | 'chat';

const SUGGESTIONS = {
  ja: ['한자 하나씩 풀어줘', '비슷한 단어 알려줘', '예문 문법 설명해줘'],
  en: ['더 쉽게 설명해줘', '비슷한 표현 알려줘', '예문 문법 설명해줘'],
};

export function ExplainPanel(props: ExplainPanelProps) {
  const [mode, setMode] = useState<Mode>('closed');
  const [profile, setProfile] = useState<JaProfile | EnProfile | null>(() => loadProfile(props.language));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ExplainErrorKind | null>(null);
  // 실패한 요청을 [다시 시도]로 그대로 재전송하기 위해 보관 (null = 첫 설명)
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);

  if (!getExplainApiUrl()) return null;

  const online = navigator.onLine;
  const followUpsUsed = messages.filter((m) => m.role === 'user').length;
  const remaining = MAX_FOLLOW_UPS - followUpsUsed;
  const canAsk = !loading && remaining > 0 && messages.length > 0;

  function buildRequest(activeProfile: JaProfile | EnProfile, sent: ChatMessage[]): ExplainRequest {
    if (props.language === 'ja') {
      return {
        language: 'ja',
        profile: activeProfile as JaProfile,
        entry: toExplainEntry(props.entry),
        relatedWords: findRelatedJaWords(props.entry.word, props.archivePool, props.entry.date),
        messages: sent,
      };
    }
    return {
      language: 'en',
      profile: activeProfile as EnProfile,
      entry: toExplainEntry(props.entry),
      relatedWords: recentEnWords(props.archivePool, props.entry.date),
      messages: sent,
    };
  }

  async function ask(activeProfile: JaProfile | EnProfile, history: ChatMessage[], question: string | null) {
    const sent: ChatMessage[] = question ? [...history, { role: 'user', content: question }] : history;
    setMessages(sent);
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const reply = await requestExplanation(buildRequest(activeProfile, sent));
      setMessages([...sent, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(history);
      setInput(question ?? '');
      setFailedQuestion(question);
      setError(err instanceof ExplainError ? err.kind : 'server');
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    if (!profile) {
      setMode('profile');
      return;
    }
    setMode('chat');
    ask(profile, [], null);
  }

  function handleSaveProfile(next: JaProfile | EnProfile) {
    if (props.language === 'ja') saveProfile('ja', next as JaProfile);
    else saveProfile('en', next as EnProfile);
    setProfile(next);
    setMode('chat');
    ask(next, [], null);
  }

  function handleSend(question: string) {
    const trimmed = question.trim();
    if (!trimmed || !canAsk || !profile) return;
    ask(profile, messages, trimmed);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend(input);
  }

  return (
    <section className="explain-panel" aria-label="내 수준 맞춤 설명">
      {mode === 'closed' && (
        <>
          <PixelButton onClick={handleOpen} disabled={!online}>
            💡 내 수준에 맞게 설명
          </PixelButton>
          {!online && <p className="explain-panel__notice">인터넷 연결이 필요해요</p>}
        </>
      )}

      {mode === 'profile' &&
        (props.language === 'ja' ? (
          <JaProfileForm initial={profile as JaProfile | null} onSave={handleSaveProfile} />
        ) : (
          <EnProfileForm initial={profile as EnProfile | null} onSave={handleSaveProfile} />
        ))}

      {mode === 'chat' && profile && (
        <div className="explain-panel__chat">
          <div className="explain-panel__header">
            <span>💡 내 수준 설명</span>
            <button type="button" className="explain-panel__edit" onClick={() => setMode('profile')}>
              내 수준: {describeProfile(profile)} · 수정
            </button>
          </div>

          <ul className="explain-panel__messages" aria-live="polite">
            {messages.map((message, i) => (
              <li key={i} className={`explain-panel__message explain-panel__message--${message.role}`}>
                {message.role === 'assistant' ? '🤖 ' : '🙋 '}
                {message.content}
              </li>
            ))}
            {loading && <li className="explain-panel__message explain-panel__message--assistant">생각 중...</li>}
          </ul>

          {error && (
            <div className="explain-panel__error" role="alert">
              <span>{EXPLAIN_ERROR_MESSAGES[error]}</span>
              {error === 'server' && (
                <PixelButton onClick={() => ask(profile, messages, failedQuestion)}>다시 시도</PixelButton>
              )}
            </div>
          )}

          <div className="explain-panel__chips">
            {SUGGESTIONS[props.language].map((question) => (
              <PixelButton key={question} onClick={() => handleSend(question)} disabled={!canAsk}>
                {question}
              </PixelButton>
            ))}
          </div>
          <form className="explain-panel__form" onSubmit={handleSubmit}>
            <input
              className="explain-panel__input"
              aria-label="질문 입력"
              placeholder="질문 입력..."
              value={input}
              maxLength={QUESTION_MAX_LENGTH}
              disabled={!canAsk}
              onChange={(e) => setInput(e.target.value)}
            />
            <PixelButton type="submit" disabled={!canAsk || !input.trim()}>
              보내기
            </PixelButton>
          </form>
          {remaining > 0 ? (
            <p className="explain-panel__remaining">
              남은 질문 {remaining}/{MAX_FOLLOW_UPS}
            </p>
          ) : (
            <p className="explain-panel__notice">이 단어는 여기까지! 다른 단어에서 또 물어봐요</p>
          )}
        </div>
      )}
    </section>
  );
}
