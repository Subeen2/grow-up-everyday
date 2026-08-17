import { useEffect, useState } from 'react';
import { BlankChallenge, buildBlankChallengeFromPool, pickRandomEntry } from './wordBlankGame';

export interface WordBlankGameApi<TEntry extends { date: string }, TIndexItem extends { date: string }> {
  fetchArchiveIndex(): Promise<TIndexItem[]>;
  fetchWordByDate(date: string): Promise<TEntry | null>;
}

export interface WordBlankGameConfig<TEntry> {
  getWord(entry: TEntry): string;
  getSentencePool(entry: TEntry): string[];
}

export type WordBlankGameState<TEntry> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; score: number; streak: number }
  | { status: 'question'; entry: TEntry; challenge: BlankChallenge; score: number; streak: number };

const MAX_PICK_ATTEMPTS = 8;

export function useWordBlankGameState<TEntry extends { date: string }, TIndexItem extends { date: string }>(
  api: WordBlankGameApi<TEntry, TIndexItem>,
  config: WordBlankGameConfig<TEntry>
) {
  const [pool, setPool] = useState<TIndexItem[]>([]);
  const [state, setState] = useState<WordBlankGameState<TEntry>>({ status: 'loading' });

  async function loadQuestion(
    candidatePool: TIndexItem[],
    excludeDate: string | undefined,
    score: number,
    streak: number
  ) {
    let remaining = candidatePool;
    for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
      const picked = pickRandomEntry(remaining, excludeDate);
      if (!picked) break;
      excludeDate = undefined;
      remaining = remaining.filter((item) => item.date !== picked.date);

      const entry = await api.fetchWordByDate(picked.date);
      if (!entry) continue;
      const challenge = buildBlankChallengeFromPool(config.getSentencePool(entry), config.getWord(entry));
      if (!challenge) continue;

      setState({ status: 'question', entry, challenge, score, streak });
      return;
    }
    setState({ status: 'empty', score, streak });
  }

  useEffect(() => {
    api
      .fetchArchiveIndex()
      .then((items) => {
        setPool(items);
        loadQuestion(items, undefined, 0, 0);
      })
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
    // Intentionally runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCorrect() {
    if (state.status !== 'question') return;
    loadQuestion(pool, state.entry.date, state.score + 1, state.streak + 1);
  }

  function handleSkip() {
    if (state.status !== 'question') return;
    loadQuestion(pool, state.entry.date, state.score, 0);
  }

  return { state, handleCorrect, handleSkip };
}
