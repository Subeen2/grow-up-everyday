const LAST_VIEWED_KEY = 'lastViewedDate';

export function getLastViewedDate(): string | null {
  return localStorage.getItem(LAST_VIEWED_KEY);
}

export function setLastViewedDate(date: string): void {
  localStorage.setItem(LAST_VIEWED_KEY, date);
}

export function isNewDaySinceLastView(today: string): boolean {
  return getLastViewedDate() !== today;
}

export async function requestNotificationPermissionAndSync(): Promise<void> {
  if (typeof Notification === 'undefined') return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;

  if (!('periodicSync' in registration)) return; // Android Chrome 등 일부 환경만 지원
  try {
    await (registration as any).periodicSync.register('daily-word-check', {
      minInterval: 24 * 60 * 60 * 1000,
    });
  } catch {
    // 미지원/거부 — best-effort이므로 조용히 무시
  }
}
