# 나의 수집 자랑하기

내가 가진 수집품을 캐릭터 키링으로 만들어 나무에 매달며 자랑하는 웹 서비스.
여러 기록자가 이름+비밀번호로 로그인해 같은 나무에 함께 키링을 등록할 수 있다.

- `app/` — 정적 웹앱 소스 (GitHub Pages로 배포됨)
- `apps-script/` — Google Sheets 기반 실시간 공유 백엔드 (Google Apps Script)
- `요구정의서.md` — 요구사항 정의서 및 개발 진행 기록

## 로컬 실행
```
cd app
python3 -m http.server 8080
```

## 백엔드(실시간 공유) 연동
`app/BACKEND_SETUP.md` 참고.
