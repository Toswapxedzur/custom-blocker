# Vault 브라우저 확장 프로그램 코드 설명서

[사용자 설명서](../manual/ko.md)

## 규칙 계약

소스는 함수 표현식 `(on, v) => { ... }` 하나입니다. 동기 JavaScript와 아래 API만 지원합니다. 타이머, 네트워크, 확장 프로그램 API, 직접 DOM 접근은 허용되지 않습니다. 시간 기반 규칙은 `ev.now`와 이벤트를 사용합니다.

- 편집하면 초안이 저장됩니다. **Run**은 규칙을 활성화하고 그룹을 켭니다. 동결된 그룹은 Run할 수 없습니다. 빈 소스는 규칙을 언로드합니다.
- Run에 성공하면 핸들러와 패널을 바꾸고 `v.state`는 유지합니다. 컴파일/등록 실패 시 이전 규칙이 남으며 시간 초과로 중지될 수 있습니다. 엔진을 다시 불러오면 마지막 활성 소스가 다시 등록되고 클로저 변수는 초기화됩니다.
- 등록 시 state를 초기화하고 핸들러를 등록하고 패널을 표시하며 로그를 남길 수 있습니다. 페이지/파일 작업과 emit은 핸들러 안에서 해야 합니다. 등록 중 대기열은 폐기됩니다.
- Disable은 핸들러를 억제하고 관리되는 패널, 스타일시트, 덮개, 항목 판정을 해제합니다. Enable은 보존된 패널/스타일시트를 복구하고 항목을 다시 요청합니다. Run은 기존 스타일시트, 덮개, 항목 판정을 지우지 않습니다. Delete는 규칙과 state/효과를 제거합니다. 탐색, DOM 변경, 파일 쓰기는 되돌리지 않습니다.
- 이벤트는 일반 그룹 대상에 제한되지 않습니다. 규칙에서 URL/항목을 필터링하세요. 작업은 대기열에 들어간 뒤 dispatch 후 적용됩니다. 예외가 나면 해당 핸들러가 멈추지만 state/작업은 롤백되지 않으며 다음 핸들러는 실행될 수 있습니다. file/query 이벤트 외에는 작업 확인이 없습니다.

## 공통 API

- `on(type, handler)` → boolean. `handler(ev)`를 등록합니다. 여러 핸들러는 등록 순서대로 실행됩니다. false는 인수 오류 또는 핸들러 한도 초과를 뜻합니다. `ev = { type: string, now: number, data }`; `now`는 Unix 밀리초입니다.
- `v.state`: 이벤트 dispatch 후 저장되는 변경 가능한 JSON 객체입니다. 기존 state를 덮어쓰지 말고 없는 필드를 초기화하세요. 객체가 아닌 값이나 배열을 지정하면 `{}`로 초기화됩니다. 직렬화할 수 없거나 너무 큰 업데이트는 저장되지 않습니다.
- `v.log(...values)`: 이 그룹 Log를 만드는 유일한 방법입니다. Logs/Clear는 그룹별로 독립적입니다. 로드 오류는 Run 상태에 표시되고 핸들러 진단은 Log에 들어가지 않습니다.
- `v.emit(type, data)`: 현재 이벤트 다음에 `data`의 JSON 사본을 새 `now`와 함께을 이 그룹 핸들러에 대기시킵니다. 동기 호출이 아닙니다.
- `v.panel(id, spec, tabId?)`: 이 그룹의 이름 있는 패널을 바꿉니다. 접근 가능한 모든 웹 페이지에 표시하려면 `tabId`를 생략하고, 정수 탭 ID를 사용할 수도 있습니다. null `spec`은 패널을 제거합니다. Panels를 참조하세요.
- `v.file(op, path, payload?)` → 요청 ID 문자열. Files를 참조하세요.

그 밖의 공통 호출은 `undefined`를 반환합니다. ID/state는 표시 이름이 아니라 하나의 그룹에 속합니다.

## 브라우저 이벤트

아래 payload 표기법은 유형을 설명하며 실행 가능한 코드가 아닙니다. `?`는 선택적 필드를 나타냅니다.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick`은 근사값입니다. tick 수가 아니라 타임스탬프를 사용하세요. `active`는 브라우저 창에서 선택되었다는 뜻이지 사용자가 보고 있다는 증거는 아닙니다. URL은 비어 있거나 제한될 수 있습니다.
- `visible`은 접근 가능하고 숨겨지지 않은 페이지에서 옵니다. `elapsedMs`는 마지막 heartbeat 이후 시간이며 덮여 있으면 0입니다. 누적 사용량이나 재생 시간이 아닙니다.
- `items`는 새로 생기거나 바뀐 지원 피드 항목을 보고하며 Run/re-enable 뒤 재전송합니다. `ref`는 해당 페이지의 카드를 식별하며 영구 콘텐츠 ID가 아닙니다. `ref === "page"`는 페이지 자체를 뜻합니다. 제목/URL/작성자는 비어 있을 수 있습니다. `authors`에는 플랫폼별 원본 ID가 있습니다.
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

이벤트/그룹마다 대기 작업 256개, 로그 호출 200회, emit 64회. 초과분은 버립니다. 규칙마다 핸들러 1000개, 패널 24개, 각 컨트롤 목록 32개, 각 선택지 64개까지입니다. 초과분은 무시/잘립니다. Emit 체인은 16세대에서 멈춥니다. 직렬화 state 한도는 JavaScript 문자열 65536자입니다. 등록과 이벤트별 전체 핸들러 실행을 1초 이내로 유지하세요. 반복 초과나 강제 시간 초과 시 Run 전까지 규칙을 멈춥니다. Log는 그룹별로 200개 보관합니다. 타이밍/응답은 최선형이며 실시간 보장은 아닙니다.

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
