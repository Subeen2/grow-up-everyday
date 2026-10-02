import { FormEvent, ReactNode, useState } from 'react';
import { EN_LEVEL_LABELS, EnProfile, JaProfile, MEMO_MAX_LENGTH } from '../lib/learnerProfile';
import { PixelButton } from './PixelButton';

interface ProfileFormShellProps {
  memo: string;
  memoPlaceholder: string;
  onMemoChange: (memo: string) => void;
  onSubmit: () => void;
  children: ReactNode;
}

function ProfileFormShell({ memo, memoPlaceholder, onMemoChange, onSubmit, children }: ProfileFormShellProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form className="explain-profile" onSubmit={handleSubmit}>
      {children}
      <label className="explain-profile__memo">
        메모 (선택)
        <input
          className="explain-panel__input"
          value={memo}
          maxLength={MEMO_MAX_LENGTH}
          placeholder={memoPlaceholder}
          onChange={(e) => onMemoChange(e.target.value)}
        />
      </label>
      <PixelButton type="submit">저장하고 설명 보기</PixelButton>
    </form>
  );
}

const JA_SCRIPTS = [
  { key: 'knowsHiragana', label: '히라가나' },
  { key: 'knowsKatakana', label: '가타카나' },
  { key: 'knowsKanji', label: '한자' },
] as const;

export function JaProfileForm({ initial, onSave }: { initial: JaProfile | null; onSave: (p: JaProfile) => void }) {
  const [profile, setProfile] = useState<JaProfile>(
    initial ?? { knowsHiragana: false, knowsKatakana: false, knowsKanji: false, memo: '' }
  );

  return (
    <ProfileFormShell
      memo={profile.memo}
      memoPlaceholder="예: 한국 한자는 조금 앎"
      onMemoChange={(memo) => setProfile((p) => ({ ...p, memo }))}
      onSubmit={() => onSave({ ...profile, memo: profile.memo.trim() })}
    >
      <fieldset className="explain-profile__group">
        <legend>내가 아는 것</legend>
        {JA_SCRIPTS.map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={profile[key]}
              onChange={() => setProfile((p) => ({ ...p, [key]: !p[key] }))}
            />{' '}
            {label}
          </label>
        ))}
      </fieldset>
    </ProfileFormShell>
  );
}

export function EnProfileForm({ initial, onSave }: { initial: EnProfile | null; onSave: (p: EnProfile) => void }) {
  const [profile, setProfile] = useState<EnProfile>(initial ?? { level: 'everyday', readsIpa: false, memo: '' });

  return (
    <ProfileFormShell
      memo={profile.memo}
      memoPlaceholder="예: 문법 용어는 잘 몰라요"
      onMemoChange={(memo) => setProfile((p) => ({ ...p, memo }))}
      onSubmit={() => onSave({ ...profile, memo: profile.memo.trim() })}
    >
      <fieldset className="explain-profile__group explain-profile__group--column">
        <legend>영어 수준</legend>
        {(Object.keys(EN_LEVEL_LABELS) as EnProfile['level'][]).map((level) => (
          <label key={level}>
            <input
              type="radio"
              name="en-level"
              checked={profile.level === level}
              onChange={() => setProfile((p) => ({ ...p, level }))}
            />{' '}
            {EN_LEVEL_LABELS[level]}
          </label>
        ))}
      </fieldset>
      <label>
        <input
          type="checkbox"
          checked={profile.readsIpa}
          onChange={() => setProfile((p) => ({ ...p, readsIpa: !p.readsIpa }))}
        />{' '}
        발음기호 읽을 줄 알아요
      </label>
    </ProfileFormShell>
  );
}
