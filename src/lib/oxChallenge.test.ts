import { buildOxQuestion } from './oxChallenge';
import { ArchiveIndexItem } from './wordTypes';

const target: ArchiveIndexItem = { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' };
const other: ArchiveIndexItem = { date: '2026-07-20', word: 'figure out', meaningKo: '알아내다' };

describe('buildOxQuestion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the real meaning and isTrue: true when the coin flip lands on true', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9); // wantsFalse = false

    const question = buildOxQuestion(target, [target, other]);

    expect(question).toEqual({ word: 'awesome', shownMeaning: '정말 멋진', isTrue: true });
  });

  it('falls back to the real meaning when there is no other candidate, even if the coin flip wants false', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1); // wantsFalse = true

    const question = buildOxQuestion(target, [target]);

    expect(question).toEqual({ word: 'awesome', shownMeaning: '정말 멋진', isTrue: true });
  });

  it('substitutes another entry\'s meaning and isTrue: false when the coin flip wants false and a candidate exists', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // wantsFalse = true
      .mockReturnValueOnce(0); // pickRandomOtherWord picks the first candidate

    const question = buildOxQuestion(target, [target, other]);

    expect(question).toEqual({ word: 'awesome', shownMeaning: '알아내다', isTrue: false });
  });
});
