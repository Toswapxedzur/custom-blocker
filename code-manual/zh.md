# Vault 浏览器扩展代码手册

[用户手册](../manual/zh.md)

## 规则契约

源代码是一个函数表达式 `(on, v) => { ... }`。只支持同步 JavaScript 和下述 API；不提供计时器、网络、扩展 API 或直接 DOM 访问。基于时间的规则使用 `ev.now` 和事件。

- 编辑会保存草稿；**运行**会启用该代码并启用组。冻结组不能运行。空源代码会卸载规则。
- 成功运行会替换处理器和面板，同时保留 `v.state`。编译或注册失败时保留原规则；超时可能使其停止。重新加载引擎会再次注册上次启用的源代码；闭包变量会重置。
- 注册阶段可以初始化状态、注册处理器、显示面板和输出日志。页面、文件操作及发送事件应放在处理器中；注册阶段排队的这些操作会被丢弃。
- 停用会停止处理器，并移除托管的面板、样式表、覆盖层和内容判定。启用会恢复保留的面板和样式表，并重新请求内容。运行不会清除已有的样式表、覆盖层或内容判定。删除会移除规则、状态及其效果。页面导航、DOM 修改和文件写入不会撤销。
- 事件不受普通组目标限制；请在规则中筛选 URL 和内容。操作先进入队列，再在事件分发后执行。异常会停止该处理器，但不会回滚其状态或操作；后续处理器仍可能运行。除文件和查询事件外，没有操作确认。

## 共享 API

- `on(type, handler)` → 布尔值。注册 `handler(ev)`；多个处理器按注册顺序运行。返回 false 表示参数无效或处理器数量达到上限。`ev = { type: string, now: number, data }`；`now` 是 Unix 时间戳，单位为毫秒。
- `v.state`：可修改的 JSON 对象，在事件分发后持久保存。应初始化缺失字段，而不是覆盖已有状态。赋值为非对象或数组会将其重置为 `{}`；无法序列化或超过大小限制的更新不会保存。
- `v.log(...values)`：该组日志的唯一来源。各组的日志和清除操作相互独立。加载错误显示在运行状态中；处理器诊断信息不会写入日志。
- `v.emit(type, data)`：将 `data` 的 JSON 副本排入队列，在当前事件之后交给该组的处理器，并生成新的 `now`；不是同步调用。
- `v.panel(id, spec, tabId?)`：替换该组指定名称的面板；省略 `tabId` 时应用于所有可访问的网页，也可使用整数标签页 ID。`spec` 为 null 时移除面板。详见“面板”。
- `v.file(op, path, payload?)` → 请求 ID 字符串。详见“文件”。

其他共享调用返回 `undefined`。ID 和状态属于一个组，与其显示名称无关。

## 浏览器事件

下述载荷写法用于描述类型，不是可执行代码。`?` 表示可选字段。

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

- `tick` 的间隔是近似值；请使用时间戳，而不是计数 tick。`active` 表示标签页在浏览器窗口中被选中，不代表用户正在查看它。URL 可能为空或受限制。
- `visible` 来自可访问且未隐藏的页面；`elapsedMs` 是自上次心跳以来的时间，被覆盖时为零。它不是累计使用时长或播放时长。
- `items` 报告新增或发生变化的受支持内容，并在运行或重新启用后再次发送。`ref` 标识该页面上的卡片，不是持久内容 ID；`ref === "page"` 表示页面本身。标题、URL 和作者可能为空。`authors` 包含特定平台的内容来源标识符。
- 平台 ID：`youtube`、`tiktok`、`facebook`、`instagram`、`twitch`、`reddit`、`discord`、`twitter`、`bluesky`、`threads`、`substack`、`bilibili`、`rumble`、`pinterest`、`kick`、`tumblr`、`peertube`、`pixelfed`、`kuaishou`。内容是否可用取决于页面的受支持结构。
- 标签需要连接桌面分类器，并使用启用了打标的版本和平台（Chromium 和 Safari：YouTube、Reddit、Bilibili、X/`twitter`）。置信度为 1–5。`tagsSettled === false` 表示等待中或不可用，不是未标记；已完成的 `tags: []` 表示未标记。
- `snooze` 表示用户按下了该组的暂缓按钮，本身不会实施暂停。
- 查询和文件回复发送给请求它们的组。使用 `requestId` 关联回复，检查 `error`/`ok`，并通过 tick 设置截止时间：页面关闭、引擎重新加载或组停用时，回复可能丢失。运行后请求 ID 可能重复；待处理请求不属于持久任务。

## 浏览器操作

整数 `tabId` 必须来自事件。页面操作需要 Vault 有访问权限的页面；浏览器内部页面不可用。无效输入或不可用的目标通常不会产生效果。

- `v.item(tabId, ref, verdict)`：`"hide"` 移除内容卡片，`"dim"` 覆盖其媒体，`"allow"` 将其排除于较低组的判定，`null` 清除该组的判定。未知 ref 不产生效果；请使用 `v.cover` 处理 `isPage`。判定遵循组列表顺序：较高组的 hide 优先；较高组的 dim 不受较低组 allow 影响；allow 阻止较低组判定。复用或移除后的卡片需要新的判定。
- `v.cover(tabId, on, message?)`：true 覆盖页面，false 移除其自定义覆盖层；消息默认为空，最长 500 个字符。每个页面只有一个自定义覆盖层位置；最后执行的 cover 调用生效，与组顺序无关。地址变化会移除它；普通屏蔽仍可能覆盖页面。
- `v.go(tabId, target)`：HTTP(S) URL，或 `"back"`、`"forward"`、`"reload"`；target 最长 4096 个字符。
- `v.close(tabId)`：关闭标签页。
- `v.css(tabIdOrStar, id, css)`：整数标签页 ID 或 `"*"`；替换该组相同 ID 的样式表，或使用 null 移除。标签页样式表在地址变化时结束；`"*"` 样式表也应用于之后打开的页面。ID 最长 80，CSS 最长 100000 个字符。
- `v.dom(tabId, selector, op, arg?)`：CSS 选择器最长 1000 个字符；应用于所有匹配项，但 `scrollTo` 只使用第一个。操作包括：`hide` 设置内联 `display:none!important`；`show` 移除内联 display；`click`；`setText` 用 `arg` 替换文本；`addClass`/`removeClass` 使用一个类名；`scrollTo` 滚动到可见区域。Arg 最长 2000 个字符。修改持续存在，直至明确反向修改或页面替换。
- `v.query(tabId, selector)` → 请求 ID 字符串，参数无效时返回 null。结果稍后通过 `query` 事件返回：最多 50 个匹配项，小写 `tag`，标准化文本最长 1000、属性最长 2000、值最长 1000 个字符。无匹配项时成功返回 `[]`；无效 CSS 返回 `error: "invalid-selector"`。没有 Vault 接收器的页面可能永远不回复。

## 面板

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

默认位置为右下角，布局为 vertical，对齐为 left，角色为 region，宽度随内容。宽度预设为 220/280/360px；数值面板宽度限制为 180–520px。控件宽度限制为 32–520px，高度限制为 20–360px。数值尺寸也接受像素字符串。纵向布局变体改变间距；inline/row 不换行；wrap/toolbar 换行；twoColumn/grid/split/form 使用网格；stack 减少间距。角色提供无障碍语义，不代表模态阻止。

ID 会标准化为 ASCII 字母、数字、`_`、`-`，最长 80；请选择唯一且稳定的 ID。省略控件 ID 时使用 `control-N`，省略或未知的类型使用 text。省略的文本和列表为空；disabled 默认为 false。调用 `v.panel` 会替换整个规范。省略 `value` 时复用上次控件事件的值，再进行类型标准化；显式 `value` 会覆盖它。Autofocus 默认为 false。未知字段会被丢弃；不支持规则提供的面板颜色、字体和 CSS。

控件字段和值：

- `text`：`text` 字符串，默认为标签。`html`：`html` 字符串；脚本、事件属性、危险 URL 和样式会被移除。
- `button`：`label`，可选 `action: "submit" | "cancel" | "close"`；值为字符串，默认为空。操作发送事件，不会自动提交或关闭任何内容。
- `checkbox`、`toggle`：布尔 `value`，默认为 false。
- `select`、`radio`：`options: (string | { value: string, label?: string })[]`；字符串值，默认为空。空选项值会被移除；标签默认使用值。
- `textInput`、`textarea`：字符串值，默认为空；`placeholder`；textarea 的 `rows` 为 1–12，默认为 3。
- `numberInput`、`range`：数值，默认为 0；`min`、`max`、正数 `step`。值会限制在边界内；未设置的标准化边界为 −1000000…1000000。Range 默认范围为 0…100；请显式设置边界。
- `date`：字符串 `YYYY-MM-DD`；`time`：字符串 `HH:MM` 或 `HH:MM:SS`；无效初始格式变为空。`color`：`#RRGGBB`，默认为 `#000000`。
- `pin`：数字字符串；`length` 为 3–12，默认 6；`masked` 默认为 true；`autoSubmit` 默认为 false。`section`：`text`、`controls`，可选 layout/align/role，role 默认为 group；深度为 3 的子分区没有子项，根控件深度为 0。

面板事件：输入控件发送 `input`/`change`，文本输入在失焦或 Enter 时更改；textarea 在失焦或 Ctrl-or-Cmd+Enter 时更改。普通控件还发送 `focus`、`blur`、`key`；按键元数据不会转发给规则。按钮分别发送 `click` **和**所配置的操作事件，请只处理其中一个。PIN 发送 `change`，并在 autoSubmit 填满时发送 `submit`。挂载和卸载使用 `controlId: ""`、`value: true`。`values` 包含按 ID 索引的当前输入值，不包含按钮、文本和 HTML。事件没有来源标签页 ID；需要针对标签页交互时，请使用不同的面板 ID。

文本限制：title/label/ariaLabel 为 240；description/text 为 1000；HTML 为 20000；placeholder 为 500；输入文本为 2000；其他值字符串为 512；选项 value/label 为 256。超出部分会被截断。

## 文件

`op`：`"read"`、`"write"`、`"append"`、`"list"`、`"exists"`。需要在设置中选择**自定义规则文件夹**并授予权限。Safari 使用原生文件夹选择器和保留的安全作用域授权；只允许访问所选文件夹。

- `path` 是相对路径，以 `/` 分隔目录。各段允许 ASCII 字母、数字、空格及 `_.,@()-`；不允许以点开头、`.`/`..`、绝对路径或 URL。文件后缀为 `.txt`、`.csv`、`.json`，不区分大小写。List 路径为目录；`""` 表示列出所选根目录。
- Read 返回 UTF-8 文本。Write 替换或创建文件；append 创建或追加，不会自动添加换行。写入时会创建父目录。字符串载荷原样写入；其他 JSON 载荷会序列化；null 或省略表示空文本。JSON/CSV 解析由规则负责。文件最大为 1048576 个 UTF-8 字节。
- List 返回直接下级的可见子目录和受支持文件。条目格式：`{ name: string, path: string, kind: "directory" | "file", extension?: string }`；文件的 extension 包含点。Exists 对受支持的文件路径返回布尔值。

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

未使用的结果字段为 null；成功时 error 为空。失败包括 invalid-path、unsupported-file-type、权限或文件夹不可用、文件不存在及 file-too-large。将 error 视为字符串，不要当作固定且完整的枚举。请求不保证事务性或顺序；请对每个路径的读取、修改、写入操作进行串行处理。

## 限制

每组每事件最多排队 256 个操作、200 次日志调用、64 次发送事件；超出部分会被丢弃。每条规则最多 1000 个处理器、24 个面板；每个控件列表最多 32 项，每个选择控件最多 64 个选项；超出部分会被忽略或截断。事件发送链在 16 代后停止。序列化状态最多 65536 个 JavaScript 字符串字符。注册和每个事件的全部处理器合计应在 1 秒内完成；反复超时或硬超时会停止该组，直至再次运行。日志保留 200 条，每组每秒接受 50 条，并将长消息截断至约 4096 个字符。计时器和回复尽力执行，不保证实时性。

## 完整规则

由暂缓按钮或面板按钮触发的五分钟暂停：

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
