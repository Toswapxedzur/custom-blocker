# Chrome 웹 스토어 목록 소스

이것은 현재 Manifest V3 확장의 영어 소스입니다. 새 스토어 빌드를 게시하기 전에 `manifest.json`에 대해 확인하세요.

## 확장자 이름

```text
Adamancia Vault
```

## 간단한 설명

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## 자세한 설명

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## 권한 설명

| 허가 | 현재 목적 |
| --- | --- |
| `storage` | 그룹, 설정 및 로컬 편집기 상태를 저장합니다. |
| `alarms` | 백그라운드 확인 및 시간 기반 그룹 업데이트를 예약하세요. |
| `offscreen` | Chromium에 오프스크린 문서가 필요한 제어된 맞춤 규칙 런타임을 실행하세요. |
| `tabs` | 그룹을 적용하고 상태를 표시하는 데 필요한 활성 탭 컨텍스트를 읽습니다. |
| `webNavigation` | 탐색 후 해당 그룹을 다시 평가합니다. |
| `favicon` | 가능한 경우 편집기에 웹사이트 아이콘을 표시합니다. |
| `<all_urls>` | 사용자가 제어하기로 선택한 페이지에 사용자가 만든 웹사이트 및 플랫폼 규칙을 적용합니다. |

## 릴리스 확인

1. `./tests/run.sh`을 실행합니다.
2. 릴리스 커밋에 대해서만 매니페스트 버전을 업데이트합니다.
3. 영문 매뉴얼과 번역 감사 결과를 검토합니다.
4. 검토된 커밋에서 업로드 아티팩트를 빌드합니다.
5. 업로드 아티팩트에 소스 노트, 테스트 픽스처 또는 개인 개발 파일을 포함하지 마십시오.
