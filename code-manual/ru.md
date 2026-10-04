# Руководство по коду расширения Vault для браузера

[Руководство пользователя](../manual/ru.md)

## Контракт правила

Source: одно функциональное выражение `(on, v) => { ... }`. Поддерживаются только синхронный JavaScript и приведённый ниже API; timers, network, extension APIs и прямой доступ к DOM не поддерживаются. Правила по времени используют `ev.now` и events.

- Изменения сохраняются как черновик; **Run** активирует правило и включает группу. Для замороженных групп запуск Run недоступен. Пустой source выгружает правило.
- Успешный Run заменяет handlers и panels, сохраняя `v.state`. При ошибке компиляции/регистрации остаётся предыдущее правило; timeout может остановить его. После перезагрузки engine последняя активированная source регистрируется снова; closure variables сбрасываются.
- Регистрация может инициализировать state, регистрировать handlers, показывать panels и записывать log. Действия со страницами/файлами и emits выполняются в handlers; очередь регистрации отбрасывается.
- Disable приостанавливает handlers и убирает управляемые panels, sheets, covers и вердикты элементов. Enable восстанавливает сохранённые panels/sheets и повторно запрашивает элементы. Run не очищает существующие sheets, covers и вердикты. Delete удаляет правило, state и эффекты. Навигация, изменения DOM и запись файлов не отменяются.
- Events не ограничиваются обычными целями группы; фильтруйте URLs/items в правиле. Actions ставятся в очередь и применяются после dispatch. Исключение останавливает обработчик без отката его state/actions; последующие handlers могут продолжить работу. Подтверждение есть только у file/query events.

## Общий API

- `on(type, handler)` → boolean. Регистрирует `handler(ev)`; несколько handlers выполняются в порядке регистрации. False означает неверные аргументы или достижение лимита обработчиков. `ev = { type: string, now: number, data }`; `now` — Unix в миллисекундах.
- `v.state`: изменяемый JSON-объект, сохраняемый после event dispatch. Инициализируйте отсутствующие fields, не перезаписывая текущий state. Присваивание non-object или массива сбрасывает его в `{}`; несерилизуемые/слишком большие обновления не сохраняются.
- `v.log(...values)`: единственный источник записей Log этой группы. Logs/Clear независимы для каждой группы. Ошибки загрузки отображаются в Run status; диагностика handlers не попадает в Log.
- `v.emit(type, data)`: ставит JSON-копию `data` в очередь для handlers группы после текущего event, с новым `now`; это не синхронный вызов.
- `v.panel(id, spec, tabId?)`: заменяет именованную панель группы; пропустите `tabId` для всех доступных веб-страниц или используйте целочисленный tab ID. Null `spec` удаляет её. См. Panels.
- `v.file(op, path, payload?)` → строка request ID. См. Files.

Остальные общие вызовы возвращают `undefined`. IDs/state принадлежат группе, а не её отображаемому имени.

## События браузера

Обозначения payload ниже описывают типы и не являются исполняемым кодом. `?` отмечает необязательные fields.

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

- `tick` приблизителен; используйте timestamps, а не подсчёт ticks. `active` означает, что страница выбрана в окне браузера, но не доказывает, что пользователь смотрит на неё. URLs могут быть пустыми/ограниченными.
- `visible` поступает с доступных, не скрытых страниц; `elapsedMs` — время с последнего heartbeat, ноль при закрытой странице. Это не накопленное использование и не время воспроизведения.
- `items` сообщает о новых/изменённых поддерживаемых элементах ленты и повторно отправляет их после Run/повторного включения. `ref` идентифицирует карточку на странице, но не постоянный content ID; `ref === "page"` обозначает саму страницу. Заголовки/URLs/авторы могут быть пустыми. `authors` содержит идентификаторы источников платформы.
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Наличие элементов зависит от поддерживаемой разметки страницы.
- Для тегов нужны подключённый Classifier desktop и build/platform с включённой разметкой (Chromium и Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence от 1 до 5. `tagsSettled === false` означает ожидание/недоступность, а не отсутствие тегов; settled `tags: []` означает, что тегов нет.
- `snooze` означает, что нажата кнопка Snooze группы. Само по себе это не вызывает паузу.
- Ответы query/file направляются запросившей группе. Сопоставляйте `requestId`, проверяйте `error`/`ok` и задавайте срок с помощью ticks: ответы могут потеряться при закрытии страницы, перезагрузке engine или выключении группы. Request IDs могут повторяться после Run; ожидающие requests не являются постоянной работой.

## Действия браузера

Целочисленный `tabId` должен поступить из event. Действия со страницей требуют доступа Vault; внутренние страницы браузера недоступны. Неверные входные данные или недоступные цели обычно не дают эффекта.

- `v.item(tabId, ref, verdict)`: `"hide"` удаляет карточку ленты, `"dim"` закрывает её медиа, `"allow"` освобождает её от нижних групп, `null` очищает вердикт этой группы. Неизвестные refs ничего не делают; используйте `v.cover` для `isPage`. Вердикты следуют порядку групп: верхний hide выигрывает; верхний dim сохраняется, несмотря на нижний allow; allow предотвращает нижние вердикты. Для повторно использованной/удалённой карточки нужно новое решение.
- `v.cover(tabId, on, message?)`: true закрывает страницу, false убирает собственную обложку; message по умолчанию пустой (макс. 500 символов). На страницу приходится один custom-cover slot; побеждает последний применённый вызов cover вне зависимости от порядка групп. При смене адреса он удаляется; обычная блокировка всё ещё может закрывать страницу.
- `v.go(tabId, target)`: URL HTTP(S) или `"back"`, `"forward"`, `"reload"` (target макс. 4096 символов).
- `v.close(tabId)`: закрывает tab.
- `v.css(tabIdOrStar, id, css)`: целочисленный tab ID или `"*"`; заменяет таблицу стилей группы с таким ID или удаляет её значением null. Tab sheets прекращают действовать при смене адреса; sheets `"*"` распространяются на будущие страницы. ID макс. 80, CSS макс. 100000 символов.
- `v.dom(tabId, selector, op, arg?)`: CSS selector (макс. 1000); все совпадения, кроме `scrollTo`, который использует первое. Ops: `hide` задаёт inline `display:none!important`; `show` убирает inline display; `click`; `setText` заменяет текст на `arg`; `addClass`/`removeClass` используют одно имя класса; `scrollTo` прокручивает к элементу. Arg макс. 2000. Изменения сохраняются, пока не будут отменены явно/заменены страницей.
- `v.query(tabId, selector)` → строка request ID или null при неверных аргументах. Результат — последующий `query` event: до 50 matches, `tag` в нижнем регистре, normalized text ≤1000 символов, attributes ≤2000, value ≤1000. Отсутствие совпадений — успешный `[]`; неверный CSS возвращает `error: "invalid-selector"`. Страница без receiver Vault может не ответить.

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

По умолчанию: внизу справа; вертикальная компоновка; выравнивание слева; role region; ширина по содержимому. Пресеты ширины: 220/280/360px; числовая ширина панели ограничена диапазоном 180–520px. Ширина control — 32–520px, высота — 20–360px. Числовые размеры также принимают pixel strings. Вертикальные варианты меняют отступы; inline/row не переносят; wrap/toolbar переносят; twoColumn/grid/split/form используют сетки; stack сокращает отступы. Role задаёт семантику доступности, а не модальную блокировку.

IDs нормализуются до ASCII letters/digits/`_`/`-` (макс. 80); выбирайте уникальные стабильные IDs. Пропущенный control ID становится `control-N`, пропущенный/неизвестный type — text. Пропущенные text/lists пусты; disabled равно false. Вызов `v.panel` заменяет всю spec. Пропущенный `value` использует последнее event value control, а затем нормализуется по type; явный `value` заменяет его. Autofocus по умолчанию false. Неизвестные fields отбрасываются; CSS/цвета/fonts panel, заданные правилами, не поддерживаются.

Поля и значения элементов управления:

- `text`: string `text`; по умолчанию label. `html`: string `html`; удаляет scripts, event attributes, опасные URLs и стили.
- `button`: `label`, необязательный `action: "submit" | "cancel" | "close"`; value — string (по умолчанию пустой). Actions создают events; сами ничего не отправляют/не закрывают.
- `checkbox`, `toggle`: boolean `value` (по умолчанию false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (по умолчанию пустой). Пустые option values удаляются; labels по умолчанию равны value.
- `textInput`, `textarea`: string value (по умолчанию пустой), `placeholder`; textarea `rows` 1–12 (по умолчанию 3).
- `numberInput`, `range`: numeric value (по умолчанию 0), `min`, `max`, положительный `step`. Values ограничиваются; неуказанные границы нормализации — −1000000…1000000. Range по умолчанию 0…100; задавайте границы явно.
- `date`: string `YYYY-MM-DD`; `time`: string `HH:MM` или `HH:MM:SS`; неверные начальные форматы становятся пустыми. `color`: `#RRGGBB` (по умолчанию `#000000`).
- `pin`: строка цифр; `length` 3–12 (по умолчанию 6), `masked` по умолчанию true, `autoSubmit` false. `section`: `text`, `controls`, необязательные layout/align/role (role по умолчанию group); child sections на depth 3 не имеют children (root controls depth 0).

Panel events: поля ввода отправляют `input`/`change` (text input меняется при blur/Enter; textarea — при blur/Ctrl-or-Cmd+Enter). Обычные controls также отправляют `focus`, `blur`, `key`; метаданные key не передаются правилу. Buttons отправляют `click` **и** заданный action отдельными events — обрабатывайте только один. PIN отправляет `change` и `submit`, когда autoSubmit заполнен. Mount/unmount использует `controlId: ""`, `value: true`. `values` содержит текущие входные данные по ID; без buttons/text/HTML. Events не содержат исходный tab ID; для взаимодействий по вкладкам используйте отдельные panel IDs.

Ограничения текста: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; другие value strings 512; option value/label 256. Излишек обрезается.

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Требуется **Папка пользовательских правил** в Settings и её разрешение. Safari использует native-выбор папки и сохранённый security-scoped grant; доступна только выбранная папка.

- `path` относительный; `/` разделяет каталоги. Сегменты допускают ASCII letters/digits, пробелы и `_.,@()-`; без начальной точки, `.`/`..`, absolute path или URL. Расширения: `.txt`, `.csv`, `.json` (без учёта регистра). List path — каталог; `""` перечисляет выбранный root. Пути за пределами выбранной папки, в том числе через symlinks, отклоняются.
- Read возвращает текст UTF-8. Write заменяет/создаёт; append создаёт/добавляет без автоматического newline. При записи создаются родительские каталоги. String payload записывается буквально; другие JSON payloads сериализуются; null/пропуск означает пустой текст. JSON/CSV разбирает правило. Максимальный размер файла: 1048576 UTF-8 bytes.
- List возвращает непосредственно видимые подкаталоги и поддерживаемые файлы. Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; для файлов extension включает точку. Exists возвращает boolean для поддерживаемого file path.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Неиспользуемые result fields равны null; при успехе error пустой. Ошибки включают invalid-path, unsupported-file-type, permission/folder unavailable, missing file и file-too-large. Рассматривайте error как string, а не фиксированный исчерпывающий enum. Requests не гарантируют транзакции/порядок; сериализуйте read-modify-write для каждого path.

## Ограничения

На event на group: 256 queued actions, 200 log calls, 64 emits; избыток отбрасывается. На rule: 1000 handlers, 24 panels; каждый control list имеет 32 entries, каждый choice — 64 options; избыток игнорируется/обрезается. Emit chains завершаются после 16 поколений. Serialized state limit: 65536 JavaScript string characters. Держите регистрацию и handlers каждого event вместе менее 1 секунды; повторные превышения или hard timeout останавливают группу до Run. Log хранит 200 entries, принимает 50/sec на группу и обрезает длинные сообщения примерно до 4096 символов. Timers/replies работают best-effort, без гарантий реального времени.

## Полное правило

Пятиминутная пауза, запущенная кнопкой Snooze или кнопкой её panel:

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
