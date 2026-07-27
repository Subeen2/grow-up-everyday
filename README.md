# 매일 영단어

매일 초중급 일상 회화체 영단어 1개를 픽셀아트 스타일로 보여주는 PWA입니다.

## 로컬 개발

```bash
npm install
npm run dev
```

## 테스트

```bash
npm test
```

## GitHub 저장소 최초 설정 (수동, 1회)

1. GitHub에 새 저장소를 만들고 이 프로젝트를 push합니다.
   ```bash
   git remote add origin <저장소 URL>
   git push -u origin main
   ```
2. 저장소 Settings > Secrets and variables > Actions 에서 `OPENAI_API_KEY` 시크릿을 등록합니다. (본인의 OpenAI API 키, 절대 커밋하지 않습니다)
3. 저장소 Settings > Pages 에서 Source를 "GitHub Actions"로 설정합니다.
4. Actions 탭에서 `Generate Daily Word` 워크플로우를 `workflow_dispatch`로 한 번 수동 실행해 정상 동작을 확인합니다.
5. main에 push되면 `Deploy to GitHub Pages` 워크플로우가 자동으로 사이트를 배포합니다.

## 매일 단어 생성 방식

GitHub Actions가 매일 정해진 시각(UTC 15:00 = KST 00:00)에 OpenAI API를 호출해 `public/data/words/YYYY-MM-DD.json`을 생성하고 커밋합니다. 브라우저는 이 정적 JSON만 읽으므로 OpenAI 키가 클라이언트에 노출되지 않습니다.
