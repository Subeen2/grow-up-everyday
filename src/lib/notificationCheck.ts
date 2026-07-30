export function shouldNotifyForNewWord(
  latestDate: string,
  todayDate: string,
  lastNotifiedDate: string | null
): boolean {
  return latestDate === todayDate && latestDate !== lastNotifiedDate;
}
