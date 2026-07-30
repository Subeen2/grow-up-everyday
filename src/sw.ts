// @ts-nocheck
/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { clientsClaim } from 'workbox-core';
import { getLocalDateString } from './lib/wordData';
import { shouldNotifyForNewWord } from './lib/notificationCheck';

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(/\/data\/.*\.json$/, new StaleWhileRevalidate({ cacheName: 'word-data-cache' }));

const NOTIFY_STATE_CACHE = 'daily-word-notify-state';
const LAST_NOTIFIED_KEY = 'last-notified-date';

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-word-check') {
    event.waitUntil(checkForNewWordAndNotify());
  }
});

async function checkForNewWordAndNotify() {
  try {
    const base = self.registration.scope;
    const res = await fetch(`${base}data/archive-index.json`, { cache: 'no-store' });
    if (!res.ok) return;

    const archive = await res.json();
    if (!Array.isArray(archive) || archive.length === 0) return;

    const latest = archive[0];
    const today = getLocalDateString();

    const stateCache = await caches.open(NOTIFY_STATE_CACHE);
    const lastNotifiedRes = await stateCache.match(LAST_NOTIFIED_KEY);
    const lastNotifiedDate = lastNotifiedRes ? await lastNotifiedRes.text() : null;

    if (!shouldNotifyForNewWord(latest.date, today, lastNotifiedDate)) return;

    await self.registration.showNotification('오늘의 단어', {
      body: `${latest.word} - ${latest.meaningKo}`,
      icon: `${base}pwa-192x192.png`,
      tag: 'daily-word',
    });

    await stateCache.put(LAST_NOTIFIED_KEY, new Response(latest.date));
  } catch {
    // best-effort — never let a failed check surface to the user
  }
}
