# Vault ਬ੍ਰਾਊਜ਼ਰ ਐਕਸਟੈਂਸ਼ਨ ਕੋਡ ਮੈਨੂਅਲ

[ਵਰਤੋਂਕਾਰ ਮੈਨੂਅਲ](../manual/pa.md)

## ਨਿਯਮ ਕਰਾਰ

ਸਰੋਤ: ਇੱਕ function expression `(on, v) => { ... }`। ਸਿਰਫ਼ synchronous JavaScript ਅਤੇ ਹੇਠਾਂ ਦਿੱਤੀ API ਸਮਰਥਿਤ ਹੈ; timer, network, extension API ਜਾਂ ਸਿੱਧੀ DOM ਪਹੁੰਚ ਨਹੀਂ। ਸਮੇਂ-ਆਧਾਰਿਤ ਨਿਯਮ `ev.now` ਅਤੇ events ਵਰਤਦੇ ਹਨ।

- ਸੰਪਾਦਨ draft ਸੰਭਾਲਦਾ ਹੈ; **Run** ਨਿਯਮ ਚਾਲੂ ਕਰਦਾ ਅਤੇ ਸਮੂਹ ਨੂੰ ਯੋਗ ਬਣਾਉਂਦਾ ਹੈ। ਜੰਮੇ ਸਮੂਹ Run ਨਹੀਂ ਹੋ ਸਕਦੇ। ਖਾਲੀ ਸਰੋਤ ਨਿਯਮ unload ਕਰਦਾ ਹੈ।
- ਸਫ਼ਲ Run handlers ਅਤੇ panels ਬਦਲਦਾ ਹੈ, `v.state` ਬਚਾ ਕੇ। Compile/registration ਅਸਫ਼ਲ ਹੋਵੇ ਤਾਂ ਪੁਰਾਣਾ ਨਿਯਮ ਰਹਿੰਦਾ ਹੈ; timeout ਇਸਨੂੰ ਰੋਕ ਸਕਦਾ ਹੈ। Engine ਮੁੜ ਲੋਡ ਹੋਣ 'ਤੇ ਆਖ਼ਰੀ ਸਰਗਰਮ ਸਰੋਤ ਫਿਰ register ਹੁੰਦਾ ਹੈ; closure variables ਮੁੜ ਸ਼ੁਰੂ ਹੁੰਦੇ ਹਨ।
- Registration state ਸ਼ੁਰੂ ਕਰ ਸਕਦੀ ਹੈ, handlers register, panels ਦਿਖਾ ਅਤੇ log ਕਰ ਸਕਦੀ ਹੈ। Page/file actions ਅਤੇ emits handlers ਵਿੱਚ ਹੋਣੇ ਚਾਹੀਦੇ ਹਨ; registration ਸਮੇਂ ਦੀ queue ਰੱਦ ਹੁੰਦੀ ਹੈ।
- Disable handlers ਰੋਕਦਾ ਅਤੇ managed panels, sheets, covers ਅਤੇ item verdicts ਹਟਾਉਂਦਾ ਹੈ। Enable ਸੰਭਾਲੇ panels/sheets ਮੁੜ ਰੱਖਦਾ ਅਤੇ items ਫਿਰ ਮੰਗਦਾ ਹੈ। Run ਮੌਜੂਦਾ sheets, covers ਜਾਂ item verdicts ਨਹੀਂ ਮਿਟਾਉਂਦਾ। Delete ਨਿਯਮ ਅਤੇ ਇਸਦੀ state/effects ਹਟਾਉਂਦਾ ਹੈ। Navigation, DOM ਬਦਲਾਅ ਅਤੇ file writes ਵਾਪਸ ਨਹੀਂ ਹੁੰਦੀਆਂ।
- Events ਆਮ ਸਮੂਹ ਟੀਚਿਆਂ ਤੱਕ ਸੀਮਤ ਨਹੀਂ; ਨਿਯਮ ਵਿੱਚ URL/items ਫ਼ਿਲਟਰ ਕਰੋ। Actions queue ਹੋ ਕੇ dispatch ਮਗਰੋਂ ਲਾਗੂ ਹੁੰਦੇ ਹਨ। Exception handler ਰੋਕਦਾ ਹੈ ਪਰ state/actions rollback ਨਹੀਂ; ਅਗਲੇ handlers ਚੱਲ ਸਕਦੇ ਹਨ। File/query events ਤੋਂ ਬਿਨਾਂ action acknowledgement ਨਹੀਂ।

## ਸਾਂਝੀ API

- `on(type, handler)` → boolean। `handler(ev)` register ਕਰਦਾ ਹੈ; ਕਈ handlers registration ਦੇ ਕ੍ਰਮ ਵਿੱਚ ਚੱਲਦੇ ਹਨ। False ਦਾ ਮਤਲਬ ਗਲਤ arguments ਜਾਂ handler ਹੱਦ ਪੂਰੀ। `ev = { type: string, now: number, data }`; `now` Unix milliseconds ਹੈ।
- `v.state`: ਬਦਲਣਯੋਗ JSON object, event dispatch ਮਗਰੋਂ ਸੰਭਾਲਿਆ ਜਾਂਦਾ ਹੈ। ਮੌਜੂਦਾ state ਮਿਟਾਉਣ ਦੀ ਥਾਂ ਗੁੰਮ fields ਸ਼ੁਰੂ ਕਰੋ। Non-object ਜਾਂ array ਦੇਣ ਨਾਲ `{}` ਬਣਦਾ ਹੈ; nonserializable/ਵੱਡੀਆਂ updates ਸੰਭਾਲੀਆਂ ਨਹੀਂ ਜਾਂਦੀਆਂ।
- `v.log(...values)`: ਇਸ ਸਮੂਹ ਦੇ Log ਦਾ ਇਕੱਲਾ ਸਰੋਤ। Logs/Clear ਹਰ ਸਮੂਹ ਲਈ ਵੱਖਰੇ ਹਨ। Load errors Run status ਵਿੱਚ ਦਿਸਦੇ ਹਨ; handler diagnostics Log ਨਹੀਂ ਭਰਦੇ।
- `v.emit(type, data)`: ਮੌਜੂਦਾ event ਤੋਂ ਬਾਅਦ, ਇਸ ਸਮੂਹ ਦੇ handlers ਲਈ `data` ਦੀ JSON copy ਨਵੇਂ `now` ਨਾਲ queue ਕਰਦਾ ਹੈ; synchronous call ਨਹੀਂ।
- `v.panel(id, spec, tabId?)`: ਸਮੂਹ ਦਾ ਨਾਮੀ panel ਬਦਲਦਾ ਹੈ; ਸਾਰੇ ਉਪਲਬਧ web pages ਲਈ `tabId` ਛੱਡੋ ਜਾਂ integer tab ID ਵਰਤੋ। Null `spec` panel ਹਟਾਉਂਦਾ ਹੈ। Panels ਵੇਖੋ।
- `v.file(op, path, payload?)` → request ID string। Files ਵੇਖੋ।

ਹੋਰ ਸਾਂਝੇ calls `undefined` ਦਿੰਦੇ ਹਨ। IDs/state ਇੱਕ ਸਮੂਹ ਦੇ ਹਨ, ਇਸਦੇ ਦਿਖਣ ਵਾਲੇ ਨਾਮ ਦੇ ਨਹੀਂ।

## ਬ੍ਰਾਊਜ਼ਰ events

ਹੇਠਲੀ payload notation types ਦੱਸਦੀ ਹੈ, ਚੱਲਣਯੋਗ code ਨਹੀਂ। `?` optional fields ਦਰਸਾਉਂਦਾ ਹੈ।

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

- `tick` ਅਨੁਮਾਨੀ ਹੈ; tick ਗਿਣਤੀ ਨਹੀਂ, timestamps ਵਰਤੋ। `active` ਦਾ ਮਤਲਬ browser window ਵਿੱਚ ਚੁਣਿਆ ਹੋਣਾ ਹੈ, ਵਰਤੋਂਕਾਰ ਵੱਲੋਂ ਵੇਖੇ ਜਾਣ ਦਾ ਸਬੂਤ ਨਹੀਂ। URLs ਖਾਲੀ/ਸੀਮਤ ਹੋ ਸਕਦੇ ਹਨ।
- `visible` ਪਹੁੰਚਯੋਗ, ਨਾ-ਲੁਕੇ pages ਤੋਂ ਆਉਂਦਾ ਹੈ; `elapsedMs` ਆਖ਼ਰੀ heartbeat ਤੋਂ ਸਮਾਂ ਹੈ, ਢੱਕੇ ਹੋਣ 'ਤੇ zero। ਇਹ ਇਕੱਠੀ ਵਰਤੋਂ ਜਾਂ playback ਸਮਾਂ ਨਹੀਂ।
- `items` ਨਵੀਆਂ/ਬਦਲੀਆਂ ਸਮਰਥਿਤ feed items ਦੱਸਦਾ ਅਤੇ Run/re-enable ਮਗਰੋਂ ਮੁੜ ਭੇਜਦਾ ਹੈ। `ref` ਉਸ page ਦਾ card ਦੱਸਦਾ ਹੈ, ਸਥਾਈ content ID ਨਹੀਂ; `ref === "page"` page ਨੂੰ ਆਪ ਦਰਸਾਉਂਦਾ ਹੈ। Titles/URLs/authors ਖਾਲੀ ਹੋ ਸਕਦੇ ਹਨ। `authors` ਵਿੱਚ platform-specific source IDs ਹੁੰਦੇ ਹਨ।
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`। Item availability page ਦੇ supported markup 'ਤੇ ਨਿਰਭਰ ਹੈ।
- Tags ਲਈ connected desktop ਵਰਗੀਕਰਤਾ ਅਤੇ tagging-enabled build/platform ਚਾਹੀਦੀ ਹੈ (Chromium ਅਤੇ Safari: YouTube, Reddit, Bilibili, X/`twitter`)। ਭਰੋਸਾ 1–5 ਹੈ। `tagsSettled === false` pending/unavailable ਹੈ, ਬਿਨਾਂ ਟੈਗ ਨਹੀਂ; settled `tags: []` ਬਿਨਾਂ ਟੈਗ ਹੈ। Firefox builds ਇਹ tagging integration ਨਹੀਂ ਦਿੰਦੇ।
- `snooze` ਦਾ ਮਤਲਬ ਸਮੂਹ ਦਾ Snooze ਬਟਨ ਦਬਾਇਆ ਗਿਆ। ਇਹ ਆਪਣੇ ਆਪ pause ਲਾਗੂ ਨਹੀਂ ਕਰਦਾ।
- Query/file replies ਬੇਨਤੀ ਕਰਨ ਵਾਲੇ ਸਮੂਹ ਨੂੰ ਜਾਂਦੇ ਹਨ। `requestId` ਮਿਲਾਓ, `error`/`ok` ਵੇਖੋ ਅਤੇ ticks ਨਾਲ deadline ਸੈੱਟ ਕਰੋ: page ਬੰਦ ਹੋਣ, engine reload ਜਾਂ group disable ਨਾਲ reply ਗੁੰਮ ਹੋ ਸਕਦਾ ਹੈ। Run ਮਗਰੋਂ IDs ਦੁਹਰ ਸਕਦੇ ਹਨ; pending requests ਸਥਾਈ ਕੰਮ ਨਹੀਂ।

## ਬ੍ਰਾਊਜ਼ਰ actions

Integer `tabId` ਕਿਸੇ event ਤੋਂ ਆਉਣਾ ਚਾਹੀਦਾ ਹੈ। Page actions ਲਈ Vault-ਪਹੁੰਚਯੋਗ page ਚਾਹੀਦਾ ਹੈ; ਅੰਦਰੂਨੀ browser pages ਉਪਲਬਧ ਨਹੀਂ। ਗਲਤ inputs ਜਾਂ unavailable targets ਆਮ ਤੌਰ 'ਤੇ ਕੋਈ ਅਸਰ ਨਹੀਂ ਕਰਦੇ।

- `v.item(tabId, ref, verdict)`: `"hide"` feed card ਹਟਾਉਂਦਾ ਹੈ, `"dim"` ਇਸ ਦੇ media ਨੂੰ ਢੱਕਦਾ ਹੈ, `"allow"` ਹੇਠਲੇ groups ਤੋਂ ਛੋਟ ਦਿੰਦਾ ਹੈ, `null` ਇਸ group ਦਾ ਫ਼ੈਸਲਾ ਮਿਟਾਉਂਦਾ ਹੈ। ਅਣਜਾਣ refs ਕੁਝ ਨਹੀਂ ਕਰਦੇ; `v.cover` ਨੂੰ `isPage` ਲਈ ਵਰਤੋ। ਫ਼ੈਸਲੇ group-list ਕ੍ਰਮ ਅਨੁਸਾਰ ਹਨ: ਉੱਪਰਲਾ hide ਜਿੱਤਦਾ ਹੈ; ਉੱਪਰਲਾ dim ਹੇਠਲੇ allow ਮਗਰੋਂ ਵੀ ਰਹਿੰਦਾ ਹੈ; allow ਹੇਠਲੇ ਫ਼ੈਸਲੇ ਰੋਕਦਾ ਹੈ। ਮੁੜ ਵਰਤੇ/ਹਟਾਏ card ਲਈ ਨਵਾਂ ਫ਼ੈਸਲਾ ਚਾਹੀਦਾ ਹੈ।
- `v.cover(tabId, on, message?)`: true page ਢੱਕਦਾ ਹੈ, false ਇਸ ਦਾ custom cover ਹਟਾਉਂਦਾ ਹੈ; message ਡਿਫਾਲਟ ਖਾਲੀ (ਵੱਧ ਤੋਂ ਵੱਧ 500 ਅੱਖਰ)। ਹਰ page ਲਈ ਇੱਕ custom-cover slot ਹੈ; group order ਤੋਂ ਬਿਨਾਂ ਆਖ਼ਰੀ ਲਾਗੂ cover call ਜਿੱਤਦੀ ਹੈ। Address ਬਦਲਣ 'ਤੇ ਇਹ ਹਟਦਾ ਹੈ; ਆਮ blocking ਫਿਰ ਵੀ page ਢੱਕ ਸਕਦੀ ਹੈ।
- `v.go(tabId, target)`: HTTP(S) URL ਜਾਂ `"back"`, `"forward"`, `"reload"` (target ਵੱਧ ਤੋਂ ਵੱਧ 4096 ਅੱਖਰ)।
- `v.close(tabId)`: tab ਬੰਦ ਕਰਦਾ ਹੈ।
- `v.css(tabIdOrStar, id, css)`: integer tab ID ਜਾਂ `"*"`; ਉਸ ID ਵਾਲੀ group stylesheet ਬਦਲਦਾ ਹੈ ਜਾਂ null ਨਾਲ ਹਟਾਉਂਦਾ ਹੈ। Address ਬਦਲਣ 'ਤੇ tab sheets ਮੁੱਕਦੀਆਂ ਹਨ; `"*"` sheets ਅਗਲੇ pages 'ਤੇ ਲਾਗੂ ਹੁੰਦੀਆਂ ਹਨ। ID ਵੱਧ ਤੋਂ ਵੱਧ 80, CSS ਵੱਧ ਤੋਂ ਵੱਧ 100000 ਅੱਖਰ।
- `v.dom(tabId, selector, op, arg?)`: CSS selector (ਵੱਧ ਤੋਂ ਵੱਧ 1000); ਸਾਰੇ matches, ਪਰ `scrollTo` ਸਿਰਫ਼ ਪਹਿਲੇ ਉੱਤੇ ਵਰਤਦਾ ਹੈ। Ops: `hide` inline `display:none!important` ਲਗਾਉਂਦਾ ਹੈ; `show` inline display ਹਟਾਉਂਦਾ ਹੈ; `click`; `setText` text ਨੂੰ `arg` ਨਾਲ ਬਦਲਦਾ ਹੈ; `addClass`/`removeClass` ਇੱਕ class name ਵਰਤਦੇ ਹਨ; `scrollTo` ਨਜ਼ਰ ਵਿੱਚ ਲਿਆਉਂਦਾ ਹੈ। Arg ਵੱਧ ਤੋਂ ਵੱਧ 2000। Mutations ਸਪਸ਼ਟ ਤੌਰ 'ਤੇ ਵਾਪਸ ਕਰਨ ਜਾਂ page ਬਦਲਣ ਤੱਕ ਰਹਿੰਦੀਆਂ ਹਨ।
- `v.query(tabId, selector)` → request ID string, ਜਾਂ ਗਲਤ arguments ਲਈ null। ਨਤੀਜਾ ਬਾਅਦਲੇ `query` event ਵਿੱਚ ਆਉਂਦਾ ਹੈ: 50 ਤੱਕ matches, lowercase `tag`, normalized text ≤1000 ਅੱਖਰ, attributes ≤2000, value ≤1000। ਕੋਈ match ਨਾ ਹੋਣਾ ਸਫ਼ਲ `[]` ਹੈ; ਗਲਤ CSS `error: "invalid-selector"` ਦਿੰਦੀ ਹੈ। Vault receiver ਤੋਂ ਬਿਨਾਂ page ਸ਼ਾਇਦ ਜਵਾਬ ਨਾ ਦੇਵੇ.

## Panels

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

ਮੂਲ: ਹੇਠਾਂ-ਸੱਜੇ, vertical layout, ਖੱਬੇ align, region role, ਸਮੱਗਰੀ ਅਨੁਸਾਰ width। ਚੌੜਾਈ presets 220/280/360px; numeric panel width 180–520px। Control width 32–520px, height 20–360px। Numeric sizes pixel strings ਵੀ ਲੈਂਦੇ ਹਨ। Vertical ਰੂਪ spacing ਬਦਲਦੇ ਹਨ; inline/row wrap ਨਹੀਂ ਕਰਦੇ; wrap/toolbar wrap ਕਰਦੇ ਹਨ; twoColumn/grid/split/form grids ਵਰਤਦੇ ਹਨ; stack spacing ਘਟਾਉਂਦਾ ਹੈ। Role accessibility ਅਰਥ ਦਿੰਦਾ ਹੈ, modal blocking ਨਹੀਂ।

IDs ASCII ਅੱਖਰ/ਅੰਕ/`_`/`-` ਵਿੱਚ normalize ਹੁੰਦੇ ਹਨ (max 80); ਵਿਲੱਖਣ ਸਥਿਰ IDs ਚੁਣੋ। ਛੱਡਿਆ control ID `control-N`, ਛੱਡੀ/ਅਣਜਾਣ type text ਬਣਦੀ ਹੈ। ਛੱਡੇ text/lists ਖਾਲੀ; disabled false। `v.panel` call ਪੂਰਾ spec ਬਦਲਦਾ ਹੈ। ਛੱਡੀ `value` ਆਖ਼ਰੀ control event value ਲੈ ਕੇ type normalization ਕਰਦੀ ਹੈ; ਸਪਸ਼ਟ `value` ਇਸਨੂੰ ਬਦਲਦੀ ਹੈ। Autofocus ਮੂਲ ਤੌਰ 'ਤੇ false ਹੈ। ਅਣਜਾਣ fields ਰੱਦ; rule ਤੋਂ panel colors/fonts/CSS ਸਮਰਥਿਤ ਨਹੀਂ।

Control fields ਅਤੇ values:

- `text`: `text` string; ਮੂਲ label। `html`: `html` string; scripts, event attributes, ਖ਼ਤਰਨਾਕ URLs ਅਤੇ styling ਹਟਾਏ ਜਾਂਦੇ ਹਨ।
- `button`: `label`, ਚੋਣਵਾਂ `action: "submit" | "cancel" | "close"`; value string (ਮੂਲ ਖਾਲੀ)। Actions events ਭੇਜਦੇ ਹਨ, ਆਪ submit/close ਨਹੀਂ ਕਰਦੇ।
- `checkbox`, `toggle`: boolean `value` (ਮੂਲ false)।
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (ਮੂਲ ਖਾਲੀ)। ਖਾਲੀ option values ਹਟਾਏ ਜਾਂਦੇ ਹਨ; labels ਮੂਲ ਤੌਰ 'ਤੇ value ਹਨ।
- `textInput`, `textarea`: string value (ਮੂਲ ਖਾਲੀ), `placeholder`; textarea `rows` 1–12 (ਮੂਲ 3)।
- `numberInput`, `range`: numeric value (ਮੂਲ 0), `min`, `max`, positive `step`। Panel updates ਵਿੱਚ values ਹੱਦਾਂ ਵਿੱਚ ਰਹਿੰਦੇ ਹਨ; ਅਣਦੱਸੀਆਂ normalization ਹੱਦਾਂ −1000000…1000000। Range widgets ਮੂਲ 0…100 ਹਨ; explicit bounds ਦਿਓ।
- `date`: string `YYYY-MM-DD`; `time`: `HH:MM` ਜਾਂ `HH:MM:SS`; ਗਲਤ ਸ਼ੁਰੂਆਤੀ format ਖਾਲੀ ਬਣ ਜਾਂਦੇ ਹਨ। ਸੋਧ ਆਪ validate ਕਰੋ। `color`: `#RRGGBB` (ਮੂਲ `#000000`)।
- `pin`: digit string; `length` 3–12 (ਮੂਲ 6), `masked` ਮੂਲ true, `autoSubmit` false। `section`: `text`, `controls`, ਚੋਣਵੇਂ layout/align/role (role ਮੂਲ group); depth 3 child sections ਦੇ ਬੱਚੇ ਨਹੀਂ (root controls depth 0)।

Panel events: input controls `input`/`change` ਭੇਜਦੇ ਹਨ (text input blur/Enter 'ਤੇ ਬਦਲਦਾ; textarea blur/Ctrl-or-Cmd+Enter 'ਤੇ)। ਆਮ controls `focus`, `blur`, `key` ਵੀ ਭੇਜਦੇ ਹਨ; key metadata rule ਤੱਕ ਨਹੀਂ ਜਾਂਦਾ। Buttons `click` **ਅਤੇ** ਸੰਰਚਿਤ action ਵੱਖਰੇ events ਵਜੋਂ ਭੇਜਦੇ ਹਨ—ਇੱਕ ਸੰਭਾਲੋ। PIN `change`, autoSubmit ਭਰਨ 'ਤੇ `submit` ਭੇਜਦਾ ਹੈ। Mount/unmount `controlId: ""`, `value: true` ਵਰਤਦੇ ਹਨ। `values` ਵਿੱਚ ID ਮੁਤਾਬਕ ਮੌਜੂਦਾ input values ਹਨ; buttons/text/HTML ਨਹੀਂ। Event ਵਿੱਚ ਮੂਲ tab ID ਨਹੀਂ; tab-specific ਵਰਤੋਂ ਲਈ ਵੱਖਰੇ panel IDs ਲਵੋ।

Text limits: title/label 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; ਹੋਰ value strings 512; option value/label 256। ਵੱਧ ਹਿੱਸਾ ਕੱਟਿਆ ਜਾਂਦਾ ਹੈ।

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`। Settings ਵਿੱਚ **Custom-rule folder** ਅਤੇ ਇਸਦੀ ਇਜਾਜ਼ਤ ਲੋੜੀਂਦੀ ਹੈ। Safari ਆਪਣਾ native folder picker ਅਤੇ ਰੱਖਿਆ security-scoped grant ਵਰਤਦਾ ਹੈ; ਸਿਰਫ਼ ਚੁਣਿਆ folder ਉਪਲਬਧ ਹੈ।

- `path` relative ਹੈ; `/` directories ਵੱਖ ਕਰਦਾ ਹੈ। Segments ਵਿੱਚ ASCII ਅੱਖਰ/ਅੰਕ, spaces ਅਤੇ `_.,@()-` ਮਨਜ਼ੂਰ ਹਨ; ਸ਼ੁਰੂਆਤੀ dot, `.`/`..`, absolute path ਜਾਂ URL ਨਹੀਂ। File suffix `.txt`, `.csv`, `.json` (case-insensitive)। List path directory ਹੈ; `""` ਚੁਣਿਆ root ਦਿਖਾਉਂਦਾ ਹੈ। ਚੁਣੇ folder ਤੋਂ ਬਾਹਰ ਜਾਂਦੇ paths, symlink ਰਾਹੀਂ ਵੀ, ਰੱਦ ਹੁੰਦੇ ਹਨ।
- Read UTF-8 text ਦਿੰਦਾ ਹੈ। Write ਬਦਲਦਾ/ਬਣਾਉਂਦਾ ਹੈ; append ਆਪਣੇ ਆਪ newline ਤੋਂ ਬਿਨਾਂ ਜੋੜਦਾ/ਬਣਾਉਂਦਾ ਹੈ। ਲਿਖਣ 'ਤੇ parent directories ਬਣਦੀਆਂ ਹਨ। String payload ਜਿਉਂ ਦੀ ਤਿਉਂ ਲਿਖੀ ਜਾਂਦੀ ਹੈ; ਹੋਰ JSON payload serialize ਹੁੰਦੇ ਹਨ; null/ਛੱਡਿਆ ਦਾ ਮਤਲਬ ਖਾਲੀ text। JSON/CSV parsing rule ਦਾ ਕੰਮ ਹੈ। ਵੱਧ ਤੋਂ ਵੱਧ file size 1048576 UTF-8 bytes।
- List ਤੁਰੰਤ ਦਿਸਦੀਆਂ subdirectories ਅਤੇ ਸਮਰਥਿਤ files ਦਿੰਦਾ ਹੈ। Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; files ਵਿੱਚ extension ਅੱਗੇ dot ਹੁੰਦਾ ਹੈ। Exists ਸਮਰਥਿਤ file path ਲਈ boolean ਦਿੰਦਾ ਹੈ।

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

ਨਾ ਵਰਤੇ result fields null ਹਨ; ਸਫ਼ਲਤਾ 'ਤੇ error ਖਾਲੀ। ਅਸਫ਼ਲਤਾਵਾਂ ਵਿੱਚ invalid-path, unsupported-file-type, folder unavailable, missing file ਅਤੇ file-too-large ਹਨ। error ਨੂੰ string ਮੰਨੋ, ਪੂਰਾ ਨਿਸ਼ਚਿਤ enum ਨਹੀਂ। Transaction API ਨਹੀਂ; ਹਰ path ਲਈ read-modify-write ਲੜੀਵਾਰ ਕਰੋ।

## ਹੱਦਾਂ

ਹਰ event/group ਲਈ: 256 queued actions, 200 log calls, 64 emits; ਵੱਧ ਵਾਲੇ ਛੱਡੇ ਜਾਂਦੇ ਹਨ। ਹਰ rule ਲਈ: 1000 handlers, 24 panels; ਹਰ control list ਵਿੱਚ 32 entries ਅਤੇ ਹਰ choice ਵਿੱਚ 64 options; ਵਾਧੂ ਅਣਡਿੱਠੇ/ਕੱਟੇ ਜਾਂਦੇ ਹਨ। Emit ਲੜੀ 16 ਪੀੜ੍ਹੀਆਂ 'ਤੇ ਰੁਕਦੀ ਹੈ। Serialized state ਹੱਦ 65536 JavaScript string characters ਹੈ। Registration ਅਤੇ ਹਰ event ਦੇ ਸਾਰੇ handlers ਇੱਕ ਸਕਿੰਟ ਤੋਂ ਘੱਟ ਰੱਖੋ; ਬਾਰੰਬਾਰ ਵੱਧ ਸਮਾਂ ਜਾਂ hard timeout rule ਨੂੰ Run ਤੱਕ ਰੋਕਦਾ ਹੈ। Log ਹਰ ਸਮੂਹ ਲਈ 200 entries ਰੱਖਦਾ ਹੈ, 50/second ਲੈਂਦਾ ਹੈ ਅਤੇ ਲੰਬੇ ਸੁਨੇਹੇ ਲਗਭਗ 4096 ਅੱਖਰਾਂ 'ਤੇ ਕੱਟਦਾ ਹੈ। Timers/replies best-effort ਹਨ, real-time ਗਾਰੰਟੀ ਨਹੀਂ।

## ਪੂਰਾ ਨਿਯਮ

Snooze ਜਾਂ ਇਸਦੇ panel button ਨਾਲ ਸ਼ੁਰੂ ਹੋਣ ਵਾਲੀ ਪੰਜ ਮਿੰਟ ਦੀ ਰੋਕ:

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
