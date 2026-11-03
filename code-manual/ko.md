# Vault 브라우저 확장 프로그램 코드 설명서

[사용자 설명서](../manual/ko.md)

## 규칙 계약

소스는 함수 표현식 `(on, v) => { ... }` 하나입니다. 동기 JavaScript와 아래 API만 지원합니다. JavaScript 예약 실행 콜백, 네트워크, 확장 프로그램 API, 직접 DOM 접근은 허용되지 않습니다. 시간 기반 규칙은 아래의 관리형 타이머/추적기 또는 `ev.now`와 이벤트를 사용합니다.

- 편집하면 초안이 저장됩니다. **Run**은 규칙을 활성화하고 그룹을 켭니다. 동결된 그룹은 Run할 수 없습니다. 빈 소스는 규칙을 언로드합니다.
- Run에 성공하면 핸들러와 패널을 바꾸고 `v.state`는 유지합니다. 컴파일/등록 실패 시 이전 규칙이 남으며 시간 초과로 중지될 수 있습니다. 엔진을 다시 불러오면 마지막 활성 소스가 다시 등록되고 클로저 변수는 초기화됩니다.
- 등록 시 state를 초기화하고 핸들러를 등록하고 패널을 표시하며 로그를 남길 수 있습니다. 페이지/파일 작업과 emit은 핸들러 안에서 해야 합니다. 등록 중 대기열은 폐기됩니다.
- Disable은 핸들러를 억제하고 관리되는 패널, 스타일시트, 덮개, 항목 판정을 해제합니다. Enable은 보존된 패널/스타일시트를 복구하고 항목을 다시 요청합니다. Run은 기존 스타일시트, 덮개, 항목 판정을 지우지 않습니다. Delete는 규칙과 state/효과를 제거합니다. 탐색, DOM 변경, 파일 쓰기는 되돌리지 않습니다.
- 이벤트는 일반 그룹 대상에 제한되지 않습니다. 규칙에서 URL/항목을 필터링하세요. 작업은 대기열에 들어간 뒤 dispatch 후 적용됩니다. 예외가 나면 해당 핸들러가 멈추지만 state/작업은 롤백되지 않으며 다음 핸들러는 실행될 수 있습니다. file/query 이벤트 외에는 작업 확인이 없습니다.

## 공통 API

- `on(type, handler)` → boolean. `handler(ev)`를 등록합니다. 여러 핸들러는 등록 순서대로 실행됩니다. false는 인수 오류 또는 핸들러 한도 초과를 뜻합니다. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now`는 Unix 밀리초입니다. 실제로 렌더링된 컨트롤 이벤트는 `origin: "user"`, `v.emit` 이벤트는 `origin: "rule"`입니다.
- `v.state`: 이벤트 dispatch 후 저장되는 변경 가능한 JSON 객체입니다. 기존 state를 덮어쓰지 말고 없는 필드를 초기화하세요. 객체가 아닌 값이나 배열을 지정하면 `{}`로 초기화됩니다. 직렬화할 수 없거나 너무 큰 업데이트는 저장되지 않습니다.
- `v.log(...values)`: 이 그룹의 Log에 기록합니다. 핸들러 오류와 보고된 페이지 동작 오류도 여기에 표시됩니다. 오류 보고가 동작을 다시 실행하지는 않습니다. Logs/Clear는 그룹별로 독립적입니다. 로드 오류는 Run 상태에 표시됩니다.
- `v.emit(type, data)`: 현재 이벤트 다음에 `data`의 JSON 사본을 새 `now`와 함께을 이 그룹 핸들러에 대기시킵니다. 동기 호출이 아닙니다.
- `v.panel(id, spec, tabId?)`: 이 그룹의 이름 있는 패널을 바꿉니다. 접근 가능한 모든 웹 페이지에 표시하려면 `tabId`를 생략하고, 정수 탭 ID를 사용할 수도 있습니다. null `spec`은 패널을 제거합니다. Panels를 참조하세요.
- `v.file(op, path, payload?)` → 요청 ID 문자열. Files를 참조하세요.
- `v.store(request)`는 요청 ID를 반환합니다. 그룹 기록을 참고하세요.

그 밖의 공통 호출은 아래의 이름 있는 관리 시간 객체 팩터리를 제외하고 `undefined`를 반환합니다. ID/state는 표시 이름이 아니라 하나의 그룹에 속합니다.

## 관리형 타이머와 이동 구간 사용량

`v.timer(id, {direction:"down", durationMs:300000})`는 이름 있는 카운트다운을 만들거나 기존 것을 반환하며, 처음에는 일시정지 상태입니다. 카운트업 타이머에는 `{direction:"up"}`을 사용합니다. 핸들은 `start()`, `pause()`, `resume()`, `reset()`, `snapshot()`을 제공합니다. 시작/재개는 여러 번 호출해도 효과가 같으며, 초기화하면 경과 시간이 0인 일시정지 상태로 돌아갑니다. 스냅샷 필드에는 `ready`, `error`, `elapsedMs`, `remainingMs`(카운트업은 null), `running`, `completed`가 있습니다.

실행 중인 타이머는 앱/브라우저가 닫히거나 규칙이 비활성화되어도 실제 시간에 따라 진행됩니다. 완료된 카운트다운은 각 구성원의 규칙이 다음에 실행될 때 타이머 인스턴스와 세대별로 한 번씩 `timerEnded`를 `{id, direction, durationMs, generation, incarnation}`과 함께 전달합니다. Run은 이를 다시 전달하지 않습니다. 전달은 호스트 이벤트에 달려 있으며 실시간 알람이 아닙니다. 패널에 `{type:"timer", timerId:"focus", label:"Focus"}`를 넣으면 기존 텍스트 컨트롤을 통해 표시할 수 있습니다.

`v.rolling(id, {windowMs:3600000, limitMs:600000})`는 이름 있는 실제 사용 추적기를 만들거나 기존 것을 반환합니다. `assign({websites:["youtube.com","reddit.com"], apps:[]})`는 이 구성원의 대상 할당을 교체합니다. 네이티브 규칙은 대신 플랫폼 앱 ID를 할당할 수 있습니다. 도메인은 하위 도메인을 포함합니다. 한 추적기는 대상들의 사용량을 합산하며, 다른 ID는 독립적인 허용량을 가집니다. `snapshot()`은 `ready`, `error`, `usedMs`, `remainingMs`, `available`, `nextReturnAtMs`(기록된 사용량 중 일부가 다음에 만료되는 밀리초 시각)를 반환합니다. `available(target?)`는 대상이 주어지면 할당 여부도 확인합니다. `reset()`은 이 객체의 기록을 지웁니다.

조건에 맞는 관측된 사용량은 허용량 초과분까지 모두 계산됩니다. 추적기 자체는 페이지/앱을 차단하지 않습니다. 겹치는 표시 페이지 시간 구간은 한 번만 계산하며, 네이티브 앱은 관측된 전경 사용량을 계산합니다. 비활성화된 규칙은 사용량을 추가하지 않지만 기록은 정확한 구간 경계에서 계속 만료됩니다. 남은 기록이 제한보다 적어져야 다시 사용할 수 있습니다. 하트비트 표본은 최대 5초로 제한됩니다. 종료/비활성화 동안의 공백은 활동을 만들어 내지 않습니다. 사용자가 발생시킨 이벤트는 사용량을 추가하지 않습니다.

연결된 사용자 지정 그룹의 같은 객체 ID는 하나의 로컬 네이티브 허브를 권한 주체로 공유합니다. 연결하면 추적기 기록과 할당을 합치고 연결을 시작한 쪽의 타이머 상태를 유지합니다. 호환되지 않는 구성은 연결을 거부합니다. 각 구성원은 자신의 완료 이벤트를 받습니다. 접속이 끊어지면 공유 추적기를 사용할 수 없고 최신 권한 주체가 돌아올 때까지 타이머 제어가 거부됩니다. 연결을 해제하면 각 구성원은 최종 공유 사용량과 타이머 상태를 유지하고, 자신의 대상을 복원하며, 이전 연결의 명령을 버립니다. 허브는 돌아온 구성원이 최종 스냅샷을 저장하고 확인 응답할 때까지 보관합니다. 새 연결을 사용할 수 있게 되기 전에 대기 중인 인계를 완료합니다.

이름 있는 객체는 예약된 `v.state.$vaultTime`에 보관되어 Run과 재시작 후에도 유지됩니다. 이 필드를 직접 수정하지 마세요. 명시적으로 제거하려면 `v.removeTime(id)`를 사용합니다. ID는 1~80자의 ASCII 영문자, 숫자, `_` 또는 `-`이며 예약된 속성 이름은 거부됩니다. 최대 32개 객체가 규칙의 64 KiB UTF-8 상태 제한을 공유합니다. 기간은 최대 365일의 정수 밀리초입니다. 이동 구간 기록은 1024개 분 단위 버킷과 2048개 병합 구간으로 제한됩니다. 기록 용량 오류가 나면 명시적으로 초기화할 때까지 추적기를 사용할 수 없습니다. 잘못된 구성과 초과 크기 저장은 오류를 보고하며 저장된 데이터를 지우지 않습니다.

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## 브라우저 이벤트

아래 payload 표기법은 유형을 설명하며 실행 가능한 코드가 아닙니다. `?`는 선택적 필드를 나타냅니다.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
attachment: { eventName: "click" | "input" | "change", tabId: number,
              attachmentId: string, controlId: string, value: unknown,
              values: { [controlId: string]: unknown }, item: Item, text: string }
record: { requestId: string, ok: boolean, op?: string, key?: string,
          record?: Record | null, entries?: Header[], next?: string | null,
          deleted?: number, error?: string }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, contentId: string, instanceId: string, attachments: { [id: string]: Attachment },
         url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick`은 근사값입니다. tick 수가 아니라 타임스탬프를 사용하세요. `active`는 브라우저 창에서 선택되었다는 뜻이지 사용자가 보고 있다는 증거는 아닙니다. URL은 비어 있거나 제한될 수 있습니다.
- `visible`은 접근 가능하고 숨겨지지 않은 페이지에서 옵니다. `elapsedMs`는 마지막 heartbeat 이후 시간이며 덮여 있으면 0입니다. 누적 사용량이나 재생 시간이 아닙니다.
- `items` (`platform: "web"` 인식된 사이트 외부)는 새로 생기거나 바뀐 지원 피드 항목을 보고하며 Run/re-enable 뒤 재전송합니다. `ref`는 해당 페이지의 카드를 식별하며 영구 콘텐츠 ID가 아닙니다. `ref === "page"`는 페이지 자체를 뜻합니다. 제목/URL/작성자는 비어 있을 수 있습니다. `authors`에는 플랫폼별 원본 ID가 있습니다.
- 플랫폼 ID: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. 항목 사용 가능 여부는 페이지의 지원 마크업에 달려 있습니다.
- 태그에는 연결된 데스크톱 분류기와 태그 지정 지원 빌드/플랫폼이 필요합니다(Chromium 및 Safari: YouTube, Reddit, Bilibili, X/`twitter`). 신뢰도는 1–5입니다. `tagsSettled === false`는 대기/사용 불가이지 태그 없음이 아닙니다. 확정된 `tags: []`는 태그가 없다는 뜻입니다.
- `snooze`는 그룹의 Snooze 버튼을 눌렀다는 뜻입니다. 이것만으로 일시 중지되지는 않습니다.
- query/file 응답은 요청 그룹으로 돌아갑니다. `requestId`를 맞추고 `error`/`ok`를 확인하며 tick으로 기한을 정하세요. 페이지 종료, 엔진 재로드, 그룹 비활성화 때 응답이 사라질 수 있습니다. Run 후 요청 ID가 반복될 수 있습니다. 대기 중인 요청은 영구 작업이 아닙니다.

## 브라우저 작업

정수 `tabId`는 이벤트에서 가져와야 합니다. 페이지 작업에는 Vault가 접근할 수 있는 페이지가 필요합니다. 브라우저 내부 페이지는 사용할 수 없습니다. 잘못된 입력/사용할 수 없는 대상은 대개 아무 효과도 없습니다.

- `v.item(tabId, ref, verdict)`: `"hide"`는 피드 카드를 제거하고, `"dim"`은 미디어를 덮고, `"allow"`는 하위 그룹에서 제외하며, `null`은 이 그룹 판정을 지웁니다. 알 수 없는 ref는 무시됩니다. `v.cover`를 `isPage`에 사용하세요. 판정은 그룹 순서를 따릅니다. 상위 hide가 우선하고, 상위 dim은 하위 allow 후에도 유지되며, allow는 하위 판정을 막습니다. 재사용/삭제된 카드에는 새 판정이 필요합니다.
- `v.cover(tabId, on, message?)`: true는 페이지를 덮고 false는 사용자 지정 덮개를 해제합니다. message는 기본적으로 비어 있습니다(최대 500자). 페이지당 사용자 지정 덮개 칸은 하나이며 그룹 순서와 무관하게 마지막 호출이 적용됩니다. 주소가 바뀌면 해제됩니다. 일반 차단은 여전히 페이지를 덮을 수 있습니다.
- `v.go(tabId, target)`: HTTP(S) URL 또는 `"back"`, `"forward"`, `"reload"`(target 최대 4096자).
- `v.close(tabId)`: 탭을 닫습니다.
- `v.css(tabIdOrStar, id, css)`: 정수 탭 ID 또는 `"*"`; 같은 ID의 그룹 스타일시트를 교체하거나 null로 제거합니다. 주소 변경 시 탭 스타일시트가 끝나며 `"*"` 스타일시트는 이후 페이지에도 적용됩니다. ID 최대 80자, CSS 최대 100000자.
- `v.dom(tabId, selector, op, arg?)`: CSS 선택자(최대 1000자); `scrollTo`는 첫 항목만, 나머지는 모든 일치 항목에 적용됩니다. 작업: `hide`는 inline `display:none!important` 설정, `show`는 inline display 제거, `click`, `setText`는 `arg`로 텍스트 교체, `addClass`/`removeClass`는 클래스 이름 하나, `scrollTo`는 화면에 표시합니다. arg 최대 2000자. 변경은 명시적으로 되돌리거나 페이지가 바뀔 때까지 유지됩니다.
- `v.query(tabId, selector)` → 요청 ID 문자열, 인수 오류 시 null. 이후 `query` 이벤트로 결과를 받습니다. 최대 50개 일치, 소문자 `tag`, 정규화된 텍스트 최대 1000자, 속성 최대 2000자, 값 최대 1000자입니다. 일치 없음은 성공한 `[]`; 잘못된 CSS는 `error: "invalid-selector"`입니다. Vault 수신기가 없는 페이지는 응답하지 않을 수 있습니다.

## 패널

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

기본값: 오른쪽 아래 위치, 세로 배치, 왼쪽 정렬, region 역할, 내용에 맞는 너비. 너비 프리셋은 220/280/360px, 숫자형 패널 너비는 180–520px로 제한됩니다. 컨트롤 너비는 32–520px, 높이는 20–360px입니다. 숫자 크기는 픽셀 문자열도 받습니다. 세로 변형은 간격을 바꾸고 inline/row는 줄바꿈하지 않으며 wrap/toolbar는 줄바꿈하고 twoColumn/grid/split/form은 격자를 사용하며 stack은 간격을 최소화합니다. 역할은 접근성 의미를 제공할 뿐 모달처럼 입력을 막지 않습니다.

ID는 ASCII 영문/숫자/`_`/`-`로 정규화됩니다(최대 80). 고유하고 안정적인 ID를 선택하세요. 생략된 컨트롤 ID는 `control-N`, 생략/알 수 없는 유형은 text가 됩니다. 생략된 텍스트/목록은 비어 있고 disabled는 false입니다. `v.panel`은 전체 spec을 바꿉니다. `value`를 생략하면 마지막 컨트롤 이벤트 값을 가져와 유형에 맞게 정규화하고, 명시한 `value`는 이를 덮어씁니다. Autofocus 기본값은 false입니다. 알 수 없는 필드는 폐기되며 규칙에서 지정하는 패널 색/글꼴/CSS는 지원되지 않습니다.

컨트롤 필드와 값:

- `text`: 문자열 `text`; 기본값은 label입니다. `html`: 문자열 `html`; 스크립트, 이벤트 속성, 위험한 URL, 스타일이 제거됩니다.
- `button`: `label`, 선택적 `action: "submit" | "cancel" | "close"`; 값은 문자열(기본 빈 값)입니다. 작업은 이벤트를 보내지만 자동 제출/닫기를 하지 않습니다.
- `checkbox`, `toggle`: 불리언 `value`(기본 false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; 문자열 value(기본 빈 값). 빈 option 값은 제거되며 label 기본값은 value입니다.
- `textInput`, `textarea`: 문자열 value(기본 빈 값), `placeholder`; textarea `rows` 1–12(기본 3).
- `numberInput`, `range`: 숫자 value(기본 0), `min`, `max`, 양수 `step`. 패널 업데이트 시 범위 내로 제한됩니다. 미지정 정규화 범위는 −1000000…1000000입니다. range 기본값은 0…100이며 경계를 명시하세요.
- `date`: 문자열 `YYYY-MM-DD`; `time`: `HH:MM` 또는 `HH:MM:SS`; 잘못된 초기 형식은 빈 값이 됩니다. 수정 값은 직접 검증하세요. `color`: `#RRGGBB`(기본 `#000000`).
- `pin`: 숫자 문자열; `length` 3–12(기본 6), `masked` 기본 true, `autoSubmit` false. `section`: `text`, `controls`, 선택적 layout/align/role(role 기본 group); depth 3의 하위 section에는 자식이 없습니다(root control depth 0).

패널 이벤트: 입력 컨트롤은 `input`/`change`를 보냅니다(text input은 blur/Enter 때, textarea는 blur/Ctrl 또는 Cmd+Enter 때 변경). 일반 컨트롤도 `focus`, `blur`, `key`를 보냅니다. key 메타데이터는 규칙에 전달되지 않습니다. 버튼은 `click` **및** 설정된 작업을 별도 이벤트로 보냅니다. 하나만 처리하세요. PIN은 `change`, autoSubmit이 채워지면 `submit`을 보냅니다. mount/unmount는 `controlId: ""`, `value: true`를 사용합니다. `values`에는 ID별 현재 입력값이 있고 버튼/텍스트/HTML은 포함되지 않습니다. 이벤트에 원래 탭 ID는 없습니다. 탭별 상호작용은 패널 ID를 분리하세요.

텍스트 제한: title/label/ariaLabel 240, description/text 1000, HTML 20000, placeholder 500, 입력 텍스트 2000, 기타 값 문자열 512, option value/label 256자. 초과분은 잘립니다.

## 파일

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. 설정의 **사용자 지정 규칙 폴더**와 권한이 필요합니다. Safari는 기본 폴더 선택기와 유지되는 security-scoped grant를 사용하며 선택한 폴더만 사용할 수 있습니다.

- `path`는 상대 경로이며 `/`가 디렉터리를 구분합니다. ASCII 영문/숫자, 공백, `_.,@()-`를 사용할 수 있습니다. 선행 점, `.`/`..`, 절대 경로, URL은 허용되지 않습니다. 파일 확장자는 `.txt`, `.csv`, `.json`(대소문자 구분 없음)입니다. List 경로는 디렉터리이며 `""`는 선택된 루트입니다. 심볼릭 링크를 통한 경우도 포함하여 선택 폴더 밖으로 나가는 경로는 거부됩니다.
- Read는 UTF-8 텍스트를 반환합니다. Write는 교체/생성하고 append는 자동 줄바꿈 없이 추가/생성합니다. 쓰기 시 상위 디렉터리를 만듭니다. 문자열 payload는 그대로 쓰며 다른 JSON payload는 직렬화됩니다. null/생략은 빈 텍스트입니다. JSON/CSV 분석은 규칙에서 해야 합니다. 최대 파일 크기는 1048576 UTF-8바이트입니다.
- List는 바로 아래의 표시 가능한 하위 디렉터리와 지원 파일을 반환합니다. 항목: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; 파일 extension에는 점이 포함됩니다. Exists는 지원 파일 경로의 불리언을 반환합니다.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

사용되지 않은 결과 필드는 null, 성공 시 error는 빈 값입니다. 실패에는 invalid-path, unsupported-file-type, 폴더/권한 사용 불가, 파일 없음, file-too-large가 있습니다. error는 고정된 완전한 enum이 아니라 문자열로 취급하세요. 트랜잭션 API는 없습니다. 경로별 read-modify-write 작업을 직렬화하세요.

## 한도

이벤트/그룹별로 대기 작업 256개, log 호출 200회, emit 64회이며 초과분은 버립니다. 규칙별로 핸들러 1000개, 패널 24개이며 각 컨트롤 목록은 항목 32개, 각 선택 컨트롤은 선택지 64개까지 지원합니다. 초과분은 무시하거나 잘라냅니다. emit 체인은 16세대 후 중단됩니다. 직렬화된 상태 제한은 UTF-8 65536바이트입니다. 등록과 각 이벤트의 전체 핸들러 실행 시간을 1초 미만으로 유지하세요. 반복 초과나 강제 시간 초과가 발생하면 Run을 누를 때까지 그룹을 중지합니다. Log는 항목 200개를 보관하고 그룹별 초당 50개를 허용하며 긴 메시지는 약 4096자에서 자릅니다. 타이머/응답은 최선의 노력으로 처리되며 실시간을 보장하지 않습니다.

## 완성된 규칙

Snooze 또는 패널 버튼으로 시작되는 5분 일시 중지:

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```


## 실행 중인 규칙의 AI 호출

각 custom group은 **AI calls**에서 connection/model과 reasoning effort를 선택합니다. Mac과 브라우저 규칙은 같은 API를 사용합니다. 브라우저 요청은 Mac Vault 연결이 필요하며 provider 자격 증명은 그곳에 유지됩니다. 연결된 그룹은 선택 및 선택적 일일 요청 한도를 공유합니다. 빈 값은 그룹 한도 없음이며 계정 제한은 계속 적용됩니다. 한도는 UTC 날짜 기준이고 재시작 후 유지되며 실패를 포함한 제출 시도를 셉니다. Link는 기존 사용량을 합치고 Unlink 후에도 이전 사용량을 유지합니다.

저장된 prompt와 context는 연결된 그룹이 공유하며 handler에서 `v.context.ai.prompt` 및 `v.context.ai.context`로 사용할 수 있습니다. Vault가 자동 전송하지 않으며 각 `v.ai` 호출에 포함할 내용은 규칙이 선택합니다.

`v.ai({ prompt, input? })`는 즉시 request ID를 반환합니다. 규칙 등록이 아니라 handler 안에서 호출하세요. `input`은 모든 JSON 값이며 prompt/input 각각 최대20KB입니다. 응답은 `ai` events: `. Success text is at most48KB; citations are ` `ask` `note` 이벤트 {requestId, ok, text, citations, error}로 옵니다. 성공 텍스트 최대48KB, citation은 {url,title}입니다. 웹 검색 답변을 표시할 때 출처 링크를 보이고 클릭 가능하게 유지하세요. 검색은 모델에 항상 제공됩니다. 앱의 고정 deadline은 없고 동시성은 제한됩니다. provider 대체나 자동 재시도는 없습니다. 응답은 데이터이며 JavaScript로 실행되지 않습니다. 기존 동작을 할지는 규칙이 결정합니다.

```javascript
(on, v) => {
  let pending = null;
  on("panel", ({ data }) => {
    if (data.controlId !== "ask" || pending) return;
    pending = v.ai({ prompt: v.context.ai.prompt || "Summarize this text.", input: {context:v.context.ai.context, note:data.values?.note ?? ""} });
  });
  on("ai", ({ data }) => {
    if (data.requestId !== pending) return;
    pending = null;
    if (!data.ok) { v.log("AI request failed:", data.error); return; }
    v.log(data.text, data.citations);
  });
}
```

대기 중 호출은 재시작 후 재생되지 않습니다. Run, 비활성화/재활성화, 삭제는 오래된 응답을 버립니다. 연결이 끊긴 브라우저는 `ai-unavailable`을 보고합니다. 다른 오류: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`. 실패 호출은 규칙이 유지하기로 한 이전 결과를 덮어쓰지 않습니다. 규칙 state 한도는64KB입니다.

자격 증명 없는 선택지는 Mac의 `rule_ai_models` 또는 브라우저의 `settings-rule-ai-models`로 확인하고 기존 set-group 경로에서 `ruleAI`를 설정합니다. 필드: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`), `dailyRequestLimit` (null 또는1–100000). 반환된 선택지를 사용하고 규칙 소스에 키나 provider URL을 넣지 마세요.
선택적 저장 필드는 `prompt`와 `context`이며 각각 최대16KB 문자열입니다.

## 그룹 레코드

`v.store(request)`는 handler 안에서 비동기 JSON 레코드 작업을 시작합니다. 레코드는 그룹 전용이며 Run 및 재시작 후에도 유지되고 그룹을 삭제하면 제거됩니다. 연결된 그룹은 별도 store를 사용합니다. 키, 값, 버전, 캐시 무효화, 피드백 우선순위는 규칙이 결정합니다. Mac과 브라우저 규칙은 같은 API를 쓰지만 앱/브라우저별 저장소는 분리됩니다.

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` 또는 `null` |
| `{op:"put", key, value, version?, ifRevision?}` | 저장된 `record` |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | 정렬된 `entries`와 `next` |
| `{op:"clear", prefix?}` | `deleted` 개수 |

레코드는 `{value, revision, version, updatedAt}`입니다. 불투명한 revision은 실제 쓰기 시 바뀌며 `version`은 호출자가 관리하는 메타데이터입니다. `list`는 값 없는 헤더를 돌려줍니다. 하나를 읽으려면 `get`, 다음 페이지는 `after: next` `put` `delete`를 사용하세요. `ifRevision` 생략 시 put/delete는 무조건 실행됩니다. `null`은 키가 없어야 하고 revision 문자열은 정확히 일치해야 합니다. 불일치 시 `ok:false`, `error:"store-conflict"`, 현재 `record`가 반환됩니다. 지연된 자동 응답이 사용자 피드백을 덮어쓰지 않게 합니다. `v.context.revision`은 규칙 버전에 포함할 수 있는 불투명한 설정 마커입니다. 프레임워크는 캐시 정책을 강제하지 않습니다.

제한: 키 1–2048자, version ≤128, JSON 값 ≤64KiB, depth ≤32, 그룹당 10000개 키, 전체 문서16MiB. `list`는 페이지당 최대100개 헤더와96KiB를 반환합니다. 그룹당 최대32개 요청, 전체 초당128개 시작입니다. 과부하 시 그룹별 초당 하나의 `store-busy` 오류를 알리고 나머지는 버립니다. 저장 오류는 `ok:false`를 반환합니다. 미래 형식/손상 문서는 보존하고 `store-unavailable`을 알립니다. 자동 재시도나 제거는 없습니다. deadline에는 ticks를 사용하세요.

## 저장된 콘텐츠 첨부

관찰한 콘텐츠 항목에 pill 또는 수동적 HTML/CSS 보기를 저장하려면 `v.attach(tabId, item, id, spec)`를 사용합니다. 완전한 `item`을 `items` 또는 `attachment` 이벤트에서 전달하세요. `ref`만으로는 첨부 핸들이 아닙니다. `contentId`는 저장된 콘텐츠, `instanceId`는 현재 표시를 식별합니다. AI 응답을 기다리는 동안 원래 핸들을 유지하세요. 삭제, 재사용 또는 이동된 대상에 대한 늦은 첨부는 거부됩니다. `v.item(tabId, ref, verdict)` 동작은 별개입니다.

pill의 `spec`은 `{type:"pill", text, tone?, tooltip?}`이며 tone은 `blue`, `cyan`, `gold`, `pink`, `red`입니다. 일반 텍스트는 240자, tooltip은 1000자까지입니다. 보기의 spec은 `{type:"html", html, css?, label?}`입니다. 한도는 HTML 32000자, CSS 16000자, label 200자입니다. 허용된 수동 HTML/SVG를 닫힌 shadow root와 범위 지정 CSS 안에서 다시 구성합니다. 스크립트, 이벤트 속성, 원격 리소스, 임베드, 안전하지 않은 CSS는 제거됩니다. 보기는 콘텐츠 카드 안에 제한되며 높이 480px에서 스크롤됩니다. ID는 ASCII 문자/숫자, _, -로 된 1–80자입니다. null spec은 그룹 pill을 제거합니다. Handler에서 호출하세요. 저장/전달 실패는 Log에 기록되고 자동 재시도되지 않습니다.

각 항목은 이 그룹의 첨부를 읽기 전용 스냅샷 `item.attachments`로 노출합니다. 다른 그룹 첨부는 포함되지 않습니다. 저장 데이터를 사용할 수 없으면 `attachments`는 null이고 `attachmentError`가 설정됩니다. 이는 빈 캐시가 아닙니다. 다른 handler는 계속 실행됩니다. 이미 결과가 저장된 콘텐츠에 AI를 다시 요청하지 않도록 예제를 활용하세요.

```javascript
(on, v) => {
  on("items", ({data}) => {
    for (const item of data.items) {
      if (item.attachments && !item.attachments.note) {
        v.attach(data.tabId, item, "note", {
          type: "pill", text: "Review this", tone: "blue"
        });
      }
    }
  });
  on("attachment", ({data}) => {
    if (data.attachmentId === "note") {
      v.log("Review clicked", data.item.contentId);
    }
  });
}
```

포인터, Enter, Space 활성화는 그룹의 `attachment` 이벤트를 발생시킵니다. pill은 `click`을 보냅니다. 보기 컨트롤은 `data-control` 또는 `id`를 `controlId`로 사용하고 `click`, `input`, `change`와 현재 `value`, 이름 있는 입력의 제한된 `values`를 보냅니다. 실제 UI 이벤트의 `ev.origin === "user"`, 규칙 생성 이벤트의 `origin === "rule"`입니다. 이벤트에는 `tabId`, `attachmentId`, 현재 `item`이 포함됩니다. 보기는 규칙 코드를 실행하지 않습니다. pill과 보기는 상호작용으로 밑의 카드가 이동하지 않게 합니다. 저장 데이터에는 callback이나 실행 가능한 코드가 없습니다. 오래된 pill revision은 현재 첨부를 호출할 수 없습니다. 규칙 emit은 일반 로직이며 실제 UI 클릭 메시지는 브라우저가 별도로 검증합니다.

첨부는 이 브라우저 프로필에서 그룹/콘텐츠/ID별로 저장되고 이후 출현, 이동, 브라우저 재시작, Run 뒤에도 돌아옵니다. Disable은 데이터를 유지하며 숨기고 Enable은 복원합니다. 그룹 삭제 시 첨부도 제거됩니다. 연결된 그룹도 각각 별도이며 브라우저/기기 간 자동 동기화는 없습니다. 알려진 YouTube, Reddit, X, Bilibili 콘텐츠는 플랫폼 ID를 사용합니다. 기타 콘텐츠는 보수적으로 정규화한 URL을 사용하므로 지원되는 페이지 마크업에 따라 달라집니다.

한도: 그룹/콘텐츠별 8개, 모든 그룹에서 항목별 32개, 그룹당 콘텐츠 항목 10000개, 직렬화 첨부 문서 8MB. 한도에 이르면 새 변경은 Log에 `attachment-item-limit` 또는 `attachment-storage-limit`로 거부되며 기존 데이터는 보존됩니다. Dispatch는 쓰기를 묶고 동일한 spec이면 저장소를 다시 쓰지 않습니다. 첨부는 Safari 네이티브 규칙 엔진을 포함한 브라우저 콘텐츠 UI입니다. Mac 앱 규칙에는 브라우저 콘텐츠 핸들이나 앱 내 첨부 화면이 없습니다.

`code-manual/generic-example.js`는 실행 가능한 정책 예제입니다. record, AI 호출, 사용자 피드백, compare-and-swap, HTML 컨트롤, 항목 verdict, 규칙 소유 사용량 보고를 사용합니다. 이런 동작은 예제 코드에 있으며 record/첨부 저장소만의 기능은 아닙니다.
