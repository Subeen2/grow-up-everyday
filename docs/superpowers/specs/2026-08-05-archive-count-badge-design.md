# 아카이브 개수 표시 설계 문서

**작성일:** 2026-08-05
**상태:** 승인됨 (브레인스토밍 완료)

## 배경 및 범위

`App.tsx`의 "아카이브" 탭 버튼에 현재 선택된 언어(영어/일본어)의 아카이브 항목 개수를 `아카이브 (12)` 형태로 표시한다. 언어 전환 시 해당 언어의 개수로 바뀐다.

## 구현

- `App.tsx`에 `archiveCount: number | null` state 추가.
- `language`가 바뀔 때마다(`useEffect`, deps `[language]`) 해당 언어의 `fetchArchiveIndex()`(EN: `../lib/wordData`, JA: `../lib/jaWordData`)를 호출해 `items.length`를 저장. 전환 시 먼저 `null`로 리셋해 이전 언어의 개수가 잠깐 보이지 않게 한다.
- 로딩 중이거나 fetch 실패 시(`catch`)에는 `archiveCount`를 `null`로 두고, 버튼 텍스트는 그냥 `아카이브`만 표시한다 (개수 없이).
- 버튼 텍스트: `` `아카이브${archiveCount !== null ? ` (${archiveCount})` : ''}` ``.

## 범위 밖

- 실시간 갱신(다른 탭에서 새 단어가 생성돼도 즉시 반영 안 됨, 언어 전환 시에만 재조회)
- 오늘의 단어 탭에는 표시 안 함

## 테스트

- `App.test.tsx`: 아카이브 fetch 완료 후 "아카이브 (1)" 텍스트 노출 확인, 일본어로 전환 시 일본어 개수로 바뀌는지 확인.
