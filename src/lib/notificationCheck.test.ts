import { shouldNotifyForNewWord } from './notificationCheck';

describe('shouldNotifyForNewWord', () => {
  it('returns true when the latest archive date is today and has not been notified yet', () => {
    expect(shouldNotifyForNewWord('2026-07-30', '2026-07-30', null)).toBe(true);
  });

  it("returns false when the latest archive date isn't today (not generated yet)", () => {
    expect(shouldNotifyForNewWord('2026-07-29', '2026-07-30', null)).toBe(false);
  });

  it('returns false when already notified for that date', () => {
    expect(shouldNotifyForNewWord('2026-07-30', '2026-07-30', '2026-07-30')).toBe(false);
  });

  it('returns true when the last notification was for a different (older) date', () => {
    expect(shouldNotifyForNewWord('2026-07-30', '2026-07-30', '2026-07-29')).toBe(true);
  });
});
