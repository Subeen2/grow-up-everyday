import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExplainPanel } from './ExplainPanel';

const jaEntry = {
  date: '2026-09-08',
  word: '経験',
  reading: 'けいけん',
  readingKo: '케-켄',
  meaningKo: '경험',
  exampleJa: '彼は多くの経験を持っています。',
  exampleReading: 'かれは おおくの けいけんを もって います。',
  exampleReadingKo: '카레와 오-쿠노 케-켄오 못테 이마스',
  exampleKo: '그는 많은 경험을 가지고 있습니다.',
  gameExamples: ['彼女は旅行の経験が豊富です。'],
};
const jaPool = [
  { date: '2026-09-08', word: '経験', meaningKo: '경험' },
  { date: '2026-08-06', word: '試験', meaningKo: '시험' },
];
const enEntry = {
  date: '2026-09-07',
  word: 'figure out',
  partOfSpeech: 'phrasal verb',
  pronunciationKo: '피겨 아웃',
  meaningKo: '알아내다',
  exampleEn: 'I finally figured it out.',
  exampleKo: '드디어 알아냈어.',
};
const savedJaProfile = { knowsHiragana: true, knowsKatakana: false, knowsKanji: false, memo: '' };

const ok = (reply: string) => ({ ok: true, status: 200, json: async () => ({ reply }) });
const fail = (status: number) => ({ ok: false, status, json: async () => ({}) });
const sentBody = (callIndex: number) => JSON.parse((fetch as any).mock.calls[callIndex][1].body);

function renderJa() {
  return render(<ExplainPanel language="ja" entry={jaEntry} archivePool={jaPool} />);
}

describe('ExplainPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_EXPLAIN_API_URL', 'https://explain.test');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders nothing when the API URL is not configured', () => {
    vi.stubEnv('VITE_EXPLAIN_API_URL', '');
    const { container } = renderJa();
    expect(container).toBeEmptyDOMElement();
  });

  it('asks for a profile first, saves it, then requests the first explanation', async () => {
    (fetch as any).mockResolvedValue(ok('経는 지날 경이에요'));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));
    await userEvent.click(screen.getByLabelText('히라가나'));
    await userEvent.click(screen.getByRole('button', { name: '저장하고 설명 보기' }));

    expect(await screen.findByText(/経는 지날 경이에요/)).toBeInTheDocument();
    const body = sentBody(0);
    expect(body.language).toBe('ja');
    expect(body.profile).toEqual(savedJaProfile);
    expect(body.messages).toEqual([]);
    expect(body.relatedWords).toEqual([{ word: '試験', meaningKo: '시험' }]);
    expect(body.entry.gameExamples).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('learnerProfile:ja')!)).toEqual(savedJaProfile);
    expect(screen.getByRole('button', { name: /내 수준: 히라가나 · 수정/ })).toBeInTheDocument();
  });

  it('skips the form when a profile is already saved', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    (fetch as any).mockResolvedValue(ok('바로 도착한 답'));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));

    expect(await screen.findByText(/바로 도착한 답/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '저장하고 설명 보기' })).not.toBeInTheDocument();
  });

  it('sends follow-ups with the conversation so far and counts down remaining questions', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    (fetch as any).mockResolvedValueOnce(ok('첫 설명')).mockResolvedValueOnce(ok('비슷한 단어는 試験'));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));
    await screen.findByText(/첫 설명/);
    expect(screen.getByText('남은 질문 5/5')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '비슷한 단어 알려줘' }));

    expect(await screen.findByText(/비슷한 단어는 試験/)).toBeInTheDocument();
    expect(sentBody(1).messages).toEqual([
      { role: 'assistant', content: '첫 설명' },
      { role: 'user', content: '비슷한 단어 알려줘' },
    ]);
    expect(screen.getByText('남은 질문 4/5')).toBeInTheDocument();
  });

  it('disables input after 5 follow-ups', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    (fetch as any).mockResolvedValue(ok('답'));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));
    await screen.findByText('남은 질문 5/5');
    for (let i = 0; i < 5; i++) {
      await waitFor(() => expect(screen.getByLabelText('질문 입력')).toBeEnabled());
      await userEvent.type(screen.getByLabelText('질문 입력'), `질문${i}{Enter}`);
    }

    expect(await screen.findByText('이 단어는 여기까지! 다른 단어에서 또 물어봐요')).toBeInTheDocument();
    expect(screen.getByLabelText('질문 입력')).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it('does not send a whitespace-only question', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    (fetch as any).mockResolvedValue(ok('첫 설명'));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));
    await screen.findByText(/첫 설명/);
    await userEvent.type(screen.getByLabelText('질문 입력'), '   {Enter}');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  });

  it('shows the rate limit message on 429', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    (fetch as any).mockResolvedValue(fail(429));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));

    expect(await screen.findByText('오늘 질문을 다 썼어요. 내일 다시 와주세요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('keeps the conversation on a server error and retries the same question', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    (fetch as any)
      .mockResolvedValueOnce(ok('첫 설명'))
      .mockResolvedValueOnce(fail(502))
      .mockResolvedValueOnce(ok('재시도 성공'));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));
    await screen.findByText(/첫 설명/);
    await userEvent.type(screen.getByLabelText('질문 입력'), '한자 뜻?{Enter}');

    expect(await screen.findByText('잠깐 문제가 생겼어요')).toBeInTheDocument();
    expect(screen.getByText(/첫 설명/)).toBeInTheDocument();
    expect(screen.getByLabelText('질문 입력')).toHaveValue('한자 뜻?');

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText(/재시도 성공/)).toBeInTheDocument();
    expect(sentBody(2).messages.at(-1)).toEqual({ role: 'user', content: '한자 뜻?' });
    expect(screen.queryByText('잠깐 문제가 생겼어요')).not.toBeInTheDocument();
  });

  it('renders HTML in a reply as plain text', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    (fetch as any).mockResolvedValue(ok('<b>굵게</b><img src=x onerror="alert(1)">'));
    const { container } = renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));

    expect(await screen.findByText(/<b>굵게<\/b>/)).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses the English form and sends recent words for the en track', async () => {
    (fetch as any).mockResolvedValue(ok('쉽게 말하면'));
    render(
      <ExplainPanel
        language="en"
        entry={enEntry}
        archivePool={[
          { date: '2026-09-07', word: 'figure out', meaningKo: '알아내다' },
          { date: '2026-09-06', word: 'awesome', meaningKo: '멋진' },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));
    expect(screen.getByLabelText('일상 표현은 조금 알아요')).toBeChecked();
    await userEvent.click(screen.getByLabelText('기초 단어도 어려워요'));
    await userEvent.click(screen.getByRole('button', { name: '저장하고 설명 보기' }));

    await screen.findByText(/쉽게 말하면/);
    const body = sentBody(0);
    expect(body.language).toBe('en');
    expect(body.profile).toEqual({ level: 'beginner', readsIpa: false, memo: '' });
    expect(body.relatedWords).toEqual([{ word: 'awesome', meaningKo: '멋진' }]);
  });

  it('editing the profile clears the conversation and explains again', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    (fetch as any).mockResolvedValueOnce(ok('예전 설명')).mockResolvedValueOnce(ok('새 설명'));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));
    await screen.findByText(/예전 설명/);
    await userEvent.click(screen.getByRole('button', { name: /내 수준: 히라가나 · 수정/ }));
    expect(screen.getByLabelText('히라가나')).toBeChecked();
    await userEvent.click(screen.getByLabelText('한자'));
    await userEvent.click(screen.getByRole('button', { name: '저장하고 설명 보기' }));

    expect(await screen.findByText(/새 설명/)).toBeInTheDocument();
    expect(screen.queryByText(/예전 설명/)).not.toBeInTheDocument();
    expect(sentBody(1).profile.knowsKanji).toBe(true);
    expect(sentBody(1).messages).toEqual([]);
  });

  it('offers retry when the first explanation fails on the network', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    (fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok('다시 받은 설명'));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));
    expect(await screen.findByText('인터넷 연결이 필요해요')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText(/다시 받은 설명/)).toBeInTheDocument();
  });

  it('disables profile editing while a request is in flight', async () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify(savedJaProfile));
    let resolveFetch!: (value: unknown) => void;
    (fetch as any).mockReturnValueOnce(new Promise((resolve) => (resolveFetch = resolve)));
    renderJa();

    await userEvent.click(screen.getByRole('button', { name: '💡 내 수준에 맞게 설명' }));
    expect(screen.getByRole('button', { name: /내 수준: 히라가나 · 수정/ })).toBeDisabled();

    resolveFetch(ok('첫 설명'));
    await screen.findByText(/첫 설명/);
    expect(screen.getByRole('button', { name: /내 수준: 히라가나 · 수정/ })).toBeEnabled();
  });
});
