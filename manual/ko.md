# Custom Web Blocker — 사용 설명서

이 문서는 확장 프로그램의 전체 참조 매뉴얼입니다. 가장 쉽고 일반적인 워크플로부터 시작해, 사용자 정의 JavaScript 차단 규칙과 helper API 같은 고급 주제로 점차 넘어갑니다.

처음 사용하는 경우에는 **빠른 시작**과 **차단 그룹 개요**만 먼저 읽으면 충분합니다. 그 아래 내용은 필요에 따라 선택적으로 보면 됩니다.

---

## 1. 이 확장 프로그램이 하는 일

Custom Web Blocker를 사용하면 직접 정의한 규칙에 따라 웹사이트와 온라인 방해 요소를 차단할 수 있습니다. 다음이 가능합니다.

- 브라우저의 네이티브 네트워크 차단으로 사이트를 즉시 차단 (`ERR_BLOCKED_BY_CLIENT` 유형과 동일한 방식).
- 사이트별로 하루 허용 시간을 분 단위로 설정하고, 초과하면 차단.
- YouTube, TikTok, Facebook, Instagram, Twitch, Reddit에서 사이트 전체가 아닌 특정 콘텐츠 유형만 차단.
- 지원 플랫폼에서 단일 페이지 차단뿐 아니라 피드 내 차단 대상 콘텐츠 숨김.
- 요일과 `HHMM-HHMM` 시간 창으로 규칙 활성 시간 예약.
- 규칙을 freeze하여 충동적으로 변경하기 어렵게 설정. strict freeze는 지정 시간(시간 단위) 동안 잠그고 해제 시 20단계 확인 절차를 요구.
- 충분히 긴 사유를 작성한 경우에만 규칙을 일시적으로 snooze.
- 타이머, 영구 저장소, 플랫폼 감지, 도메인 매칭, 로깅 helper를 활용한 사용자 정의 JavaScript 차단 규칙 작성.
- 20개 이상의 언어로 확장 프로그램 사용.

이 확장은 Chrome Manifest V3 확장으로, 하나의 편집 페이지(팝업), 하나의 백그라운드 service worker, 그리고 모든 페이지에서 실행되는 하나의 content script로 구성됩니다.

---

## 2. UI 둘러보기

확장 아이콘을 클릭하면 편집기가 작은 팝업이 아니라 전체 웹 페이지로 열립니다. 화면은 다음 영역으로 구성됩니다.

- **상단 바**
  - **Instruction Manual** 버튼(이 문서)
  - **Language** 선택기
- **왼쪽 패널 — Block Groups**
  - 차단 그룹 목록. 각 카드에 그룹 이름, 요약 한 줄, 활성/비활성 체크박스가 표시됩니다.
  - **Add** 버튼으로 새 그룹을 만듭니다. 옆 드롭다운에서 유형을 선택합니다.
  - **Delete All**은 모든 그룹을 삭제하며, freeze된 그룹이 있으면 추가 확인이 필요합니다.
  - 카드의 `::` 핸들을 위아래로 드래그해 순서를 변경할 수 있습니다.
  - 세로 분할선을 드래그해 패널 너비를 조절할 수 있습니다.
- **오른쪽 패널 — Editor**
  - 현재 선택한 그룹을 편집합니다: 이름, 차단 동작, 차단 목록, 유형별 필터, 일정, freeze, snooze.
  - 입력/조작을 멈춘 뒤 잠깐 후 모든 변경사항이 자동 저장됩니다.
- **Toast** (가운데에 뜨고 사라지는 팝업)
  - "Saved changes" 같은 상태 메시지나 입력 오류를 표시합니다.

페이지가 차단 중이거나 타이머가 활성 상태이면, 왼쪽 상단 오버레이에 해당 페이지에 적용 중인 시간 제약이 `hh:mm:ss`(또는 `mm:ss`) 형식으로 표시됩니다. 제약이 여러 개면 여러 줄로 쌓입니다.

---

## 3. 빠른 시작

1. 확장 아이콘을 클릭합니다. 편집기가 전체 페이지로 열립니다.
2. **Block Groups** 패널에서 드롭다운으로 그룹 유형을 고릅니다.
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit`, `Custom`.
3. **Add**를 클릭합니다. 새 그룹이 생성되고 편집기가 해당 그룹을 엽니다.
4. 그룹 이름을 입력합니다.
5. 유형별 필드를 채웁니다(`Default`는 **Blocked websites** 목록).
6. 왼쪽 패널에서 해당 그룹 체크박스가 켜져 있는지 확인합니다.
7. 목록에 넣은 사이트 중 하나에 접속합니다. 차단이 즉시 적용되어야 합니다.

여기까지가 기본 경로의 전부입니다. 이 매뉴얼의 나머지는 그 위에 얹는 선택 기능입니다.

---

## 4. 차단 그룹 개요

이 확장 프로그램의 모든 구성은 **차단 그룹(block groups)** 중심입니다. 차단 그룹은 하나의 규칙 세트입니다.

- 이름, 유형, 활성/비활성 상태를 가집니다.
- 차단 동작(즉시 또는 일정 분 후 차단)을 가집니다.
- 선택적으로 일정(요일 + 시간 창)과 freeze/snooze 제어를 가집니다.
- 유형에 따라 사이트 목록, YouTube 작성자 필터, subreddit 이름, JavaScript 함수 같은 추가 필드를 가집니다.

그룹은 개수 제한 없이 만들 수 있습니다. 여러 그룹이 같은 페이지에 동시에 적용될 수 있으며, 이때는 **더 엄격한** 규칙이 우선합니다.

- "Block immediately"가 "block after some time"보다 우선.
- 남은 시간이 더 적은 그룹이 더 많은 그룹보다 우선.

즉, 그룹을 추가하면 페이지가 더 늦게가 아니라 더 빨리 차단될 수만 있습니다.

`::` 핸들로 그룹 순서를 바꿀 수 있습니다. 순서는 어떤 규칙이 가장 엄격한지를 바꾸지 않지만, 목록의 위아래 읽기 순서를 바꿉니다.

---

## 5. 그룹 유형

### 5.1 `Default` — 일반 웹사이트 차단

특정 도메인을 차단하는 일반적인 사용 사례입니다.

- **Blocked websites**: 한 줄에 사이트 하나. `facebook.com`, `https://www.facebook.com/somepage` 모두 가능하며 확장이 hostname을 추출/정규화합니다.
- 사이트 규칙은 해당 hostname과 모든 하위 도메인에 적용됩니다.
- 이 그룹 유형은 Chrome 네이티브 네트워크 차단(`ERR_BLOCKED_BY_CLIENT` 유사)을 사용합니다. 즉 차단 URL로의 이동은 페이지가 로드되기 전에 중단됩니다.

### 5.2 `YouTube` — YouTube 및 유사 동영상 사이트 차단

편집기에 **Filters** 섹션이 추가됩니다.

- **Content type**:
  - `Apply to all YouTube pages` — 모든 YouTube 페이지 대상.
  - `Apply to Shorts` — Shorts 페이지만 대상.
  - `Apply to long videos` — `/watch`, `/live/`, `/embed/` 등만 대상.
  - `Apply to YouTube posts` — 커뮤니티 게시물(`/post/...`, 채널 community/posts 탭).
- **Author filter**:
  - `Do not filter by author` — 작성자 기준 필터 없음.
  - `Apply to certain authors` — 목록의 작성자만 이 그룹을 트리거.
  - `Apply to all except certain authors` — 목록의 작성자는 예외 처리.
- **Authors**: 한 줄에 작성자 하나. `@handle`, 전체 URL, `/channel/UC...`, `/c/...`, `/user/...` 지원.
- **Hide blocked entries in the YouTube feed**: 이 그룹이 실제 차단 중일 때 YouTube 피드의 일치 카드가 숨겨집니다. 차단 비활성 후 다음 새로고침에서 복원됩니다.

Shorts/Post 콘텐츠 유형에서 작성자 필터가 없고 그룹이 현재 차단 중이면, 관련 내비게이션 항목(사이드바 Shorts, 채널 Community/Posts 탭)과 "Latest YouTube posts" 같은 일치 선반도 숨깁니다.

short/long 판별은 페이지 형태를 감지할 수 있는 경우 TikTok, Vimeo, Twitch clips/VODs, Dailymotion 같은 다른 동영상 사이트에도 확장됩니다.

### 5.3 `TikTok` — TikTok 콘텐츠 차단

플랫폼 동영상 편집 카드와 동일하지만 TikTok 전용 라벨을 사용합니다.

- 콘텐츠 유형: short videos, videos, profile pages.
- 작성자: TikTok 핸들(`@handle`) 또는 프로필 URL.
- 그룹 활성 중에는 TikTok 페이지의 일치 카드가 피드에서 숨겨집니다.

### 5.4 `Facebook` — Facebook 콘텐츠 차단

- 콘텐츠 유형: Reels, videos, posts.
- 작성자: 페이지 이름(`page.name`), 프로필 URL, 또는 `profile.php?id=...` 형식(숫자 id는 `id:<number>`로 보존).
- 피드 숨김은 Facebook의 일치 피드 카드를 숨깁니다.

### 5.5 `Instagram` — Instagram 콘텐츠 차단

- 콘텐츠 유형: Reels, videos, posts.
- 작성자: Instagram 핸들 또는 프로필 URL.
- `/reel/`, `/p/`, `/tv/`, `/explore/` 같은 예약 경로는 작성자로 취급되지 않습니다.
- 피드 숨김은 Instagram의 일치 카드를 숨깁니다.

### 5.6 `Twitch` — Twitch 콘텐츠 차단

- 콘텐츠 유형: clips, streams/VODs, channel pages.
- 작성자: 채널 이름 또는 채널 URL.
- `/directory`, `/videos`, `/settings` 등의 예약 경로는 채널 이름으로 취급되지 않습니다.
- 피드 숨김은 Twitch의 일치 카드를 숨깁니다.

### 5.7 `Reddit` — Reddit 전체 또는 특정 subreddit 차단

- **Subreddits**: 한 줄에 subreddit 하나. 비워 두면 Reddit 전체에 적용됩니다. `productivity`, `r/productivity` 모두 허용됩니다.

### 5.8 `Custom` — JavaScript 함수 기반 차단

JavaScript 함수를 작성하면 확장이 약 1초마다 호출하고, 반환값을 현재 차단 목록으로 사용합니다.

`Custom` 그룹에는 다음 항목이 표시되지 않습니다: blocking behavior, blocked sites, allowed minutes, reset interval, schedule days, time windows. 대신 큰 입력란 하나(**Blocking Rules** 함수)와 표준 freeze/snooze 제어만 제공합니다.

전체 custom 규칙 참조와 helpers API는 **11장**을 참고하세요.

---

## 6. 차단 동작

대부분의 그룹 유형에서는 두 가지 모드 중 하나를 선택합니다.

### 6.1 즉시 차단

그룹이 켜져 있고, 일정이 허용하며, (플랫폼 그룹의 경우) 페이지가 조건에 맞으면 규칙이 활성입니다.

`Default` 그룹은 Chrome 네이티브 차단을 사용하고, 플랫폼 그룹은 페이지 내 오버레이/이탈 로직을 사용합니다.

### 6.2 일정 분수 이후 차단

이 모드는 사용 시간 예산입니다.

- **Allowed minutes before block**(소수): 기간당 허용 분수. 예: `15`, `0.5`, `90`.
- **Timer reset interval (hours)**(소수): 예산 리셋 주기. 예: `24`(일 단위), `1`(시간 단위), `0.25`(15분 단위).

남은 시간이 있는 동안 페이지는 정상 동작하며 타이머 오버레이를 표시합니다. 예산이 0이 되면 기간이 끝날 때까지 페이지가 차단되고, 오버레이에 `0:00`이 표시된 뒤 탭이 이탈을 시도합니다.

확장은 그룹별/기간별로 동작합니다.

- 각 그룹은 독립적인 예산을 가집니다.
- 그룹에 매칭되는 어떤 페이지에서 쓴 시간도 해당 그룹 예산에 누적됩니다.
- 같은 그룹의 여러 탭은 예산을 공유합니다. 타이머는 동기화되며, 다른 탭으로 전환하면 현재 공유 시간을 즉시 반영하도록 강제 새로고침됩니다.

여러 시간제한 그룹이 동일 페이지에 적용되면 가장 엄격한 그룹이 우선합니다.

---

## 7. 일정(Schedule)

**Schedule** 카드에서 그룹 활성 시간을 제한할 수 있습니다.

- **Days to block**: 그룹을 적용할 요일을 선택합니다. 체크하지 않은 요일은 그룹이 비활성입니다.
- **Time windows**: 자유 형식 목록, `HHMM-HHMM` 형식으로 한 줄당 하나의 시간 창. 예:

  ```
  0900-1000
  1200-1300
  ```

  그룹은 해당 시간 창 내부에서만 활성입니다. 비워 두면 하루 종일 활성입니다.

이 기능은 `Custom`을 제외한 모든 그룹 유형에 적용됩니다.

---

## 8. Freeze(변경 방지)

Freeze는 충동적으로 그룹을 끄기 어렵게 만듭니다.

**Freeze** 카드에서 다음을 선택합니다.

- **Frozen** — 그룹을 편집/삭제할 수 없고, 활성 토글도 끌 수 없습니다. 변경하려면 unfreeze 절차(아래)를 수행해야 합니다.
- **Strict frozen** — Frozen과 동일하지만, 선택한 시간(소수, 최대 72시간) 동안 잠금 유지. 타이머가 끝나기 전에는 unfreeze 절차도 사용할 수 없습니다.

freeze된 그룹이 해제 가능해지면 **Unfreeze** 버튼이 나타납니다. 클릭하면 **20단계 절차**가 시작됩니다.

- 모달에 자기 통제 메시지가 표시됩니다.
- `Confirm`을 20번 클릭해야 합니다.
- 클릭 사이에는 5초 강제 대기가 있습니다.
- 중간에 취소하면 1단계부터 다시 시작해야 합니다.
- 20개 메시지가 순환되어 실제로 읽게 됩니다.

그룹이 "no snooze"(다음 절 참고)로도 표시된 경우, freeze 상태에서는 snooze도 할 수 없습니다.

freeze 상태는 그룹 카드의 메타 라인에 표시되며, strict freeze는 남은 시간도 함께 표시됩니다.

---

## 9. Snooze(임시 비활성화)

snooze는 unfreeze 없이 그룹을 임시 비활성화하지만, 반드시 작성된 사유가 필요합니다.

**Snooze** 카드:

- **Allow snooze for this group** — 끄면 이 그룹은 어떤 경우에도 snooze 불가(freeze 중 포함).
- **Snooze for (minutes)** — 소수, snooze 지속 시간.
- **Reason** — **최소 100자이고 20단어를 초과**해야 합니다. 두 조건을 모두 만족해야 Start 버튼이 활성화됩니다. 실패 시 버튼 옆에 인라인 경고가 나타납니다.

그룹이 freeze 상태이면 snooze 분수는 freeze 전에 설정한 값으로 고정됩니다. snooze 허용 + 사유 조건 충족 시에는 여전히 snooze할 수 있습니다.

상태 메시지로 snooze가 확인됩니다. snooze가 끝나면 그룹은 자동으로 정상 상태로 돌아갑니다.

**End Snooze** 버튼으로 조기 종료도 가능합니다.

---

## 10. 일괄 작업

- **Delete All**은 모든 그룹을 제거합니다.
  - 항상 확인을 요구합니다.
  - freeze된 그룹이 하나라도 있으면 unfreeze와 동일한 20단계 절차가 필요합니다.
  - strict-frozen 그룹 중 아직 잠겨 있는 항목이 있으면 **Delete All**이 비활성화됩니다.

---

## 11. Custom 그룹(전체 참조)

`Custom` 그룹은 백그라운드 service worker에서 JavaScript 함수를 실행합니다. 함수는 약 1초마다 호출되며, 확장은 함수 반환값으로 "지금 어떤 도메인을 차단할지"를 결정합니다.

### 11.1 함수 시그니처

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

매개변수:

- `month` — `1`~`12`.
- `dayOfMonth` — `1`~`31`.
- `dayName` — 예: `"Monday"`.
- `hour` — `0`~`23`.
- `minute` — `0`~`59`.
- `blockedDomains` — 다른 규칙이 이미 만든 도메인 목록. 추가/교체/무시 가능.
- `helpers` — helper 객체 묶음(아래 참고).

반환값:

- 지금 차단해야 할 도메인 문자열 배열, 또는
- 반환 없음(이 경우 확장은 네가 변경한 `blockedDomains`를 사용).

함수는 저장 시 검증됩니다. 문법 오류가 있으면 상태 경고가 표시되고, 수정 전까지 규칙이 사용되지 않습니다. 런타임에서 예외가 발생하면 확장이 이를 잡아 백그라운드 콘솔에 기록하고 이전 결과로 폴백합니다.

### 11.2 적응형 스케줄링

Custom 규칙은 보통 약 1초마다 실행됩니다. 규칙이 너무 오래 걸리기 시작하면 확장이 루프 주기를 자동으로 늦춥니다(최대 약 5초 간격). 사용자가 직접 관리할 필요는 없습니다.

### 11.3 `helpers` 객체

함수 안에서 `helpers`는 여러 하위 helper를 제공합니다. 각 helper에는 긴 이름과 짧은 별칭이 있으며, 명시적 getter도 있습니다.

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — 현재 epoch 밀리초 시간.

모든 helper 메서드는 안전하게 설계되어 있어 잘못된 매개변수에서는 예외 대신 `null`, `false`, 빈 값을 반환합니다.

#### 11.3.1 `timerHelper`

도메인에 연결된 카운트다운 타이머를 관리합니다. 타이머는 브라우저 재시작 후에도 유지됩니다. 각 타이머는 생성한 custom 그룹에 귀속됩니다.

- `createTimer(domain, durationMs, displayName?)` — 고유 타이머 id 생성/반환, 유효하지 않으면 `null`. 예: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. 사용자가 해당 도메인 매칭 페이지에 있을 때 오버레이에 `Timer1: 30:00`이 표시되고 카운트다운됩니다.
- `deleteTimer(id)` — 타이머 삭제. 성공 시 `true`.
- `pauseTimer(id)` — 카운트다운 일시정지.
- `continueTimer(id)` / `resumeTimer(id)` — 일시정지 타이머 재개.
- `resetTimer(id, durationMs?)` — 타이머 재시작. `durationMs`를 생략하면 원래 길이 사용.
- `addMs(id, ms)` — 밀리초 추가(음수로 차감 가능).
- `remainingMs(id)` — 남은 밀리초.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — 불리언 반환.
- `getDomain(id)` / `getDisplayName(id)` — 타이머 정보 조회.
- `findByDomain(domain)` — 해당 도메인의 타이머 id 배열.
- `list()` — 이 그룹 소유 타이머의 `{ id, domain, displayName, durationMs, remainingMs, isPaused }` 배열.

타이머 최대 길이는 약 30일입니다.

#### 11.3.2 `persistenceHelper`

그룹 범위의 Map 유사 저장소입니다. 값은 JSON 직렬화 가능해야 하며, 호출 간 상태를 기억하는 데 유용합니다.

- `set(key, value)` — 임의 JSON 값 저장. 성공 시 `true`.
- `get(key, defaultValue?)` — 저장값 반환, 없으면 `defaultValue`.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

권장 한도: 그룹당 약 200개 키, 값당 16 KB.

#### 11.3.3 `domainHelper`

- `normalize(value)` — `youtube.com` 같은 정규 도메인을 반환, 아니면 `null`.
- `matches(hostname, site)` — `hostname`이 `site`에 속하면(하위 도메인 포함) `true`.

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — 백그라운드 콘솔에 기록.

이 메시지를 보려면: `chrome://extensions` → Developer Mode 활성화 → 확장의 "service worker" 링크 클릭.

#### 11.3.5 `platformHelper`

지원되는 소셜/동영상 플랫폼을 판별합니다.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — 정규 플랫폼 이름 반환, 아니면 `null`.
- `normalizeAuthor(author, platform)` — 특정 플랫폼용 작성자 식별자(handle, URL 등) 정규화, 실패 시 `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — `{ platform, hostname, pathname, type, authors, url }` 반환, 실패 시 `null`.
  - `type`은 `"short" | "long" | "post" | "unknown"`.
  - `authors`는 해당 URL에서 감지 가능한 정규화 작성자 목록.
- `getType(urlOrHost)` — `detect(...).type` 단축.
- `getPlatform(urlOrHost)` — `detect(...).platform` 단축.
- `getAuthors(urlOrHost)` — `detect(...).authors` 단축.
- `matchesAuthor(urlOrHost, platform, authors)` — URL이 해당 플랫폼이고 주어진 작성자 중 하나와 일치하면 `true`.

### 11.4 예시

쉬운 예: 평일 오전에 소셜 미디어 차단.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

중간 난이도: 브라우저 세션당 YouTube 30분 허용 + 보이는 카운트다운.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper } = helpers;
  let id = persistenceHelper.get("youtubeTimer");

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer("youtube.com", 30 * 60 * 1000, "YouTube");
    persistenceHelper.set("youtubeTimer", id);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, "youtube.com"];
  }

  return blockedDomains;
}
```

어려운 예: TikTok 세션이 short 영상이고 작성자가 distractor 목록에 있을 때만 차단. `platformHelper` 사용.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { platformHelper, logHelper } = helpers;
  const distractors = ["someuser", "anotheruser"];
  const url = "https://www.tiktok.com" + (globalThis.location?.pathname ?? "");
  const ctx = platformHelper.detect(url);

  if (ctx?.platform === "tiktok" && ctx.type === "short") {
    if (platformHelper.matchesAuthor(url, "tiktok", distractors)) {
      logHelper.log("Blocking TikTok short by", ctx.authors);
      return [...blockedDomains, "tiktok.com"];
    }
  }

  return blockedDomains;
}
```

(`globalThis.location`은 예시용 자리표시자일 뿐입니다. 백그라운드 worker에는 실제 페이지 URL이 없으므로, 보통 worker의 location이 아니라 자체 로직으로 `platformHelper`를 사용해야 합니다.)

가장 어려운 예: 일별 "site of the day"를 순환하고 일일 한도를 적용하며 재시작 후에도 유지.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper, domainHelper, logHelper } = helpers;
  const sites = ["reddit.com", "twitter.com", "news.ycombinator.com"];
  const today = `${month}-${dayOfMonth}`;
  const lastDay = persistenceHelper.get("lastDay");

  if (today !== lastDay) {
    for (const id of timerHelper.list().map((t) => t.id)) {
      timerHelper.deleteTimer(id);
    }
    persistenceHelper.set("lastDay", today);
  }

  const site = sites[(month + dayOfMonth) % sites.length];
  let id = persistenceHelper.get(`timer:${site}`);

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer(site, 20 * 60 * 1000, `${site} budget`);
    persistenceHelper.set(`timer:${site}`, id);
    logHelper.log("Started budget for", site);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, domainHelper.normalize(site)];
  }

  return blockedDomains;
}
```

---

## 12. 다중 페이지 동작

- 같은 그룹의 모든 열린 탭은 동일한 타이머를 공유합니다.
- 같은 그룹 탭으로 전환하면 오버레이가 즉시 갱신되어 현재 공유 시간을 보여줍니다.
- 새 규칙이 추가되면 열린 모든 페이지가 변화를 감지하고 순식간에 갱신됩니다. 탭을 수동으로 새로고침할 필요가 없습니다.
- 규칙이 만료되면 숨겨졌던 피드 카드와 내비게이션 버튼이 다음 새로고침 때 복원됩니다.

---

## 13. 국제화

전체 UI가 완전히 번역되어 있습니다. 오른쪽 위 **Language** 선택기를 사용하세요.

지원 언어에는 영어, 중국어(간체), 스페인어, 일본어, 한국어가 포함되며, 힌디어, 아랍어, 벵골어, 포르투갈어, 러시아어, 펀자브어, 독일어, 프랑스어, 터키어, 베트남어, 이탈리아어, 태국어, 네덜란드어, 폴란드어, 인도네시아어, 우르두어, 페르시아어 등에 대한 부분 지원도 포함됩니다. 부분 지원 언어는 누락 문자열에서 영어로 폴백합니다.

설명서 자체는 선택한 언어에 맞는 markdown 파일을 로드하며, 없으면 영어로 폴백합니다.

---

## 14. 상태 메시지

상태 메시지는 가운데 토스트로 표시되며 약 2초 후 사라집니다.

- "Saved changes."
- "Created \"Group name\"."
- "Allowed minutes must be a number greater than 0." 같은 검증 오류.
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

형식 요구가 있는 입력 필드의 경우, 해당 버튼 옆에도 메시지가 표시됩니다(snooze).

---

## 15. 개인정보 및 저장소

- 모든 데이터는 `chrome.storage.local`에 로컬 저장됩니다. 외부 전송은 없습니다.
- 저장 항목: 그룹, 사용 타이머, 마지막 리셋 시각, snooze 기록, custom 타이머, custom 영구 값.
- 확장은 페이지 유형 감지에 필요한 범위(경로/hostname/동영상 사이트의 알려진 DOM 마커) 외의 페이지 내용을 읽지 않습니다. 메시지, 게시물, 댓글, 개인 콘텐츠를 읽지 않습니다.

---

## 16. 권한

- `storage` — 위 데이터 저장용.
- `declarativeNetRequest` — `Default` 그룹의 네이티브 차단용.
- `alarms` — 규칙 전환을 효율적으로 예약하기 위해 사용.
- `host_permissions: <all_urls>` — content script가 모든 페이지에서 타이머 오버레이를 표시하고 플랫폼 컨텍스트를 감지할 수 있도록 함.

---

## 17. 문제 해결

- **추가한 그룹이 아무 동작도 하지 않아요.** 그룹이 활성화되어 있는지, 현재 일정에 허용되는지, snooze가 없는지, (플랫폼 그룹이면) 페이지가 선택한 콘텐츠 유형/작성자 필터와 실제로 일치하는지 확인하세요.
- **한 탭에서 타이머가 멈췄거나 이상해요.** 다른 탭으로 갔다가 돌아오거나 해당 탭에 포커스를 주면 공유 타이머 기준으로 강제 새로고침됩니다.
- **숨겨져야 할 피드 카드가 다시 보여요.** 피드 숨김은 규칙이 실제로 차단 중일 때만 동작합니다. `after-minutes` 규칙이면 시간이 0이 된 뒤에 숨김이 시작됩니다.
- **숨겨질 줄 알았던 YouTube 내비 버튼이 그대로 있어요.** 내비 숨김은 규칙이 "do not filter by author"이고 콘텐츠 유형이 Shorts 또는 YouTube posts일 때만 됩니다. 작성자 필터를 쓰면 카드 단위 숨김만 적용됩니다.
- **Custom 규칙이 동작하지 않거나 조용히 실패해요.** `chrome://extensions`를 열고 Developer Mode를 켠 뒤, 확장의 "service worker" 링크를 눌러 콘솔을 확인하세요. `helpers.logHelper.log(...)`로 추적할 수 있습니다.
- **그룹을 삭제할 수 없어요.** freeze 상태일 가능성이 큽니다. strict-frozen 그룹은 잠금 만료 전 삭제할 수 없고, non-strict frozen 그룹은 unfreeze 절차로 삭제할 수 있습니다.

---

## 18. 용어집

- **Block group** — 자체 유형, 동작, 일정, freeze/snooze를 가진 하나의 규칙 세트.
- **Instant block** — 규칙이 활성일 때 즉시 차단.
- **After-minutes block** — 기간 예산이 소진된 후에만 차단 시작.
- **Reset interval** — after-minutes 예산이 리셋되는 주기.
- **Schedule** — 그룹이 활성인 요일 + 시간 창.
- **Freeze / Strict freeze** — 변경 방지 상태.
- **Snooze** — 작성 사유가 필요한 임시 비활성화.
- **Author filter** — 플랫폼 그룹에서 특정 크리에이터로 규칙 적용 범위를 제한.
- **Content type** — 플랫폼 그룹에서 특정 콘텐츠 형태(short, long, post)로 규칙 적용 범위를 제한.
- **Helpers** — custom 규칙 함수에 전달되는 유틸리티.
- **Platform** — `youtube`, `tiktok`, `facebook`, `instagram`, `twitch` 중 하나. 각 플랫폼은 자체 그룹 유형과 피드 숨김 로직을 가집니다.

---

## 19. 제한 사항

- 피드 숨김은 각 플랫폼의 현재 DOM에 의존합니다. 플랫폼 레이아웃이 바뀌면 숨김 선택자 업데이트가 필요할 수 있습니다.
- YouTube 이외 사이트의 플랫폼 컨텍스트 감지는 대부분 URL 기반이므로, 정규 콘텐츠 URL에서 가장 안정적입니다.
- Custom 규칙 루프는 페이지가 아니라 백그라운드 worker에서 실행되므로, 함수 내부에서는 DOM 수준 정보에 접근할 수 없습니다. 대신 URL 문자열로 `platformHelper.detect(url)`를 사용하세요.
- 브라우저는 idle 상태에서 service worker를 일시 중지할 수 있습니다. 확장은 페이지나 alarm이 필요해지는 즉시 다시 깨우며, 이로 인해 사용 타이머 정확도가 떨어지지는 않습니다.
