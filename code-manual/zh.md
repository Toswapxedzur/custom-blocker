# Vault 浏览器扩展代码手册

[用户手册](../manual/zh.md)

## 规则契约

源代码是一个函数表达式 `(on, v) => { ... }`。只支持同步 JavaScript 和下述 API；不提供 JavaScript 调度回调、网络、扩展 API 或直接 DOM 访问。基于时间的规则使用下述托管计时器或追踪器，也可使用 `ev.now` 和事件。

- 编辑会保存草稿；**运行**会启用该代码并启用组。冻结组不能运行。空源代码会卸载规则。
- 成功运行会替换处理器和面板，同时保留 `v.state`。编译或注册失败时保留原规则；超时可能使其停止。重新加载引擎会再次注册上次启用的源代码；闭包变量会重置。
- 注册阶段可以初始化状态、注册处理器、显示面板和输出日志。页面、文件操作及发送事件应放在处理器中；注册阶段排队的这些操作会被丢弃。
- 停用会停止处理器，并移除托管的面板、样式表、覆盖层和内容判定。启用会恢复保留的面板和样式表，并重新请求内容。运行不会清除已有的样式表、覆盖层或内容判定。删除会移除规则、状态及其效果。页面导航、DOM 修改和文件写入不会撤销。
- 事件不受普通组目标限制；请在规则中筛选 URL 和内容。操作先进入队列，再在事件分发后执行。异常会停止该处理器，但不会回滚其状态或操作；后续处理器仍可能运行。除文件和查询事件外，没有操作确认。

## 共享 API

- `on(type, handler)` → 布尔值。注册 `handler(ev)`；多个处理器按注册顺序运行。返回 false 表示参数无效或处理器数量达到上限。`ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`；`now` 是 Unix 时间戳，单位为毫秒。 实际呈现的控件事件具有 `origin: "user"`；`v.emit` 事件具有 `origin: "rule"`。- `v.state`：可修改的 JSON 对象，在事件分发后持久保存。应初始化缺失字段，而不是覆盖已有状态。赋值为非对象或数组会将其重置为 `{}`；无法序列化或超过大小限制的更新不会保存。
- `v.log(...values)`：写入该组的日志。处理器错误和已报告的页面操作错误也会显示在这里；报告错误不会重放操作。各组的日志和清除操作相互独立。加载错误显示在运行状态中。
- `v.emit(type, data)`：将 `data` 的 JSON 副本排入队列，在当前事件之后交给该组的处理器，并生成新的 `now`；不是同步调用。
- `v.panel(id, spec, tabId?)`：替换该组指定名称的面板；省略 `tabId` 时应用于所有可访问的网页，也可使用整数标签页 ID。`spec` 为 null 时移除面板。详见“面板”。
- `v.file(op, path, payload?)` → 请求 ID 字符串。详见“文件”。
- `v.store(request)` 返回请求 ID；请参阅组记录。

除下述命名托管时间对象的工厂函数外，其他共享调用返回 `undefined`。ID 和状态属于一个组，与其显示名称无关。

## 托管计时器与滚动使用量

`v.timer(id, {direction:"down", durationMs:300000})` 创建或返回一个命名倒计时，初始状态为暂停。正计时使用 `{direction:"up"}`。返回的句柄提供 `start()`、`pause()`、`resume()`、`reset()` 和 `snapshot()`。启动和恢复操作是幂等的；重置会回到已用时间为零的暂停状态。快照字段包括 `ready`、`error`、`elapsedMs`、`remainingMs`（正计时为 null）、`running` 和 `completed`。

运行中的计时器按实际时钟时间推进，即使应用或浏览器已关闭，或规则已停用。倒计时完成后，会在各成员的规则下次运行时，为每个计时器实例与代次向该成员发送一次 `timerEnded`，载荷为 `{id, direction, durationMs, generation, incarnation}`；运行规则不会重放该事件。事件送达依赖宿主事件，并非实时闹钟。在面板中放入 `{type:"timer", timerId:"focus", label:"Focus"}`，即可通过现有文本控件显示计时器。

`v.rolling(id, {windowMs:3600000, limitMs:600000})` 创建或返回一个命名的实际使用量追踪器。`assign({websites:["youtube.com","reddit.com"], apps:[]})` 替换该成员的目标分配。原生规则也可改为分配平台应用 ID。域名包含其子域名。一个追踪器合计其所有目标的使用量；其他 ID 拥有独立额度。`snapshot()` 返回 `ready`、`error`、`usedMs`、`remainingMs`、`available` 和 `nextReturnAtMs`（任一已记录使用量下次过期的毫秒时间戳）。提供目标时，`available(target?)` 还会检查该目标是否已分配。`reset()` 清除该对象的历史记录。

所有观测到的符合条件的使用量都会计入，包括超出额度的部分；追踪器本身不会屏蔽页面或应用。可见页面的重叠时间区间只计一次，原生应用则计入观测到的前台使用量。停用的规则不增加使用量；历史记录仍会在精确的区间边界过期。只有剩余历史记录低于限制时才恢复可用。心跳采样最多计入五秒；关闭或停用期间的空档不会凭空产生使用量。用户自行发送的事件不增加使用量。

关联自定义组中的相同对象 ID 共享一个本地原生中枢权威源。关联会合并追踪器历史记录与目标分配，并保留发起方的计时器状态；不兼容的配置会拒绝关联。每个成员收到各自的完成事件。断开连接后，共享追踪器不可用，计时器控制也会被拒绝，直到获得最新权威状态。解除关联时，各成员保留最终的共享使用量和计时器状态，恢复自己的目标，并丢弃旧关联的命令。中枢会保留最终快照，直到返回的成员保存并确认收到；待处理的交接完成后才能建立新的可用关联。

命名对象保存在预留的 `v.state.$vaultTime` 中，运行规则和重启后仍会保留；请勿直接编辑该字段。使用 `v.removeTime(id)` 明确移除对象。ID 长度为 1–80 个 ASCII 字母、数字、`_` 或 `-`；不允许使用预留属性名。最多 32 个对象共享规则的 64 KiB UTF-8 状态大小限制。时长为整数毫秒，最长 365 天。滚动历史记录最多包含 1024 个分钟桶和 2048 个合并区间。历史容量错误会使追踪器保持不可用，直到明确重置；无效配置和超大保存会报告错误，而不会清除已保存数据。

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

## 浏览器事件

下述载荷写法用于描述类型，不是可执行代码。`?` 表示可选字段。

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

- `tick` 的间隔是近似值；请使用时间戳，而不是计数 tick。`active` 表示标签页在浏览器窗口中被选中，不代表用户正在查看它。URL 可能为空或受限制。
- `visible` 来自可访问且未隐藏的页面；`elapsedMs` 是自上次心跳以来的时间，被覆盖时为零。它不是累计使用时长或播放时长。
- `items` (`platform: "web"` 在已识别站点之外) 报告新增或发生变化的受支持内容，并在运行或重新启用后再次发送。`ref` 标识该页面上的卡片，不是持久内容 ID；`ref === "page"` 表示页面本身。标题、URL 和作者可能为空。`authors` 包含特定平台的内容来源标识符。
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

每个组的每次事件最多排队 256 个操作、调用 200 次 log、发送 64 次事件；超出部分会被丢弃。每条规则最多有 1000 个处理器、24 个面板；每个控件列表最多 32 项，每个选择控件最多 64 个选项；超出部分会被忽略或截断。事件发送链在 16 代后停止。序列化状态上限为 65536 个 UTF-8 字节。注册阶段及每次事件的处理器合计执行时间应低于 1 秒；反复超时或触发硬超时会停止组，直到再次运行。日志保留 200 条记录，每组每秒最多接受 50 条，长消息会在约 4096 个字符处截断。计时器和回复尽力送达，不保证实时性。

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


## 运行中规则的 AI 调用

每个 custom group 在 **AI calls** 中选择一个 connection/model 和 reasoning effort。Mac 与浏览器规则使用同一 API；浏览器请求需要连接 Mac Vault，提供商凭据保存在那里。链接组共享选择和可选的每日请求上限。留空表示组级不限额，账户限制仍适用。上限按 UTC 日计算，重启后保留，并统计已提交的尝试（包括失败）。Link 合并现有用量；unlink 保留之前的用量。

已保存的提示词和上下文由关联组共享，并可在handler中通过 `v.context.ai.prompt` 和 `v.context.ai.context` 访问。Vault不会自动发送它们；规则决定每次 `v.ai` 调用包含哪些内容。

`v.ai({ prompt, input? })` 立即返回 request ID。请在 handler 中调用，不要在注册规则时调用。`input` 可以是任意 JSON 值；prompt/input 各限20KB。回复通过 `ai` events: `. Success text is at most48KB; citations are ` `ask` `note` 事件到达：{requestId, ok, text, citations, error}。成功文本最多48KB；citations 是 {url,title}。展示网页搜索答案时保留可见、可点击的来源链接。模型始终可以使用搜索。没有固定的 app 截止时间，并发数受限；不会回退到其他提供商或自动重试。回复是数据，不会作为 JavaScript 执行；规则决定采取哪些现有操作。

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

未完成的调用不会在重启后重放。Run、禁用/重新启用和删除会丢弃过时回复；断开的浏览器会报告 `ai-unavailable`。其他错误包括 `ai-not-configured`、`ai-invalid-input`、`ai-busy`、`ai-daily-limit`、`ai-request-failed` 和 `ai-usage-storage-unavailable`。失败调用不会覆盖规则选择保留的旧结果。规则 state 仍受64KB限制。

可在 Mac 使用 `rule_ai_models`，或在浏览器使用 `settings-rule-ai-models` 查找无需凭据的选项；通过现有 set-group 路径配置 `ruleAI`。字段为 `providerModel`、`accountID`、`reasoningEffort`（`default`、`low`、`medium`、`high`）和 `dailyRequestLimit`（null 或1–100000）。使用返回的选项；不要把 key 或 provider URL 写进规则源码。
可选保存字段为 `prompt` 和 `context`，均为最长16KB的字符串。

## 组记录

`v.store(request)` 会在 handler 中启动异步 JSON 记录操作。记录属于该组，在 Run 和重启后保留，并随组删除。链接组的 store 相互独立。规则决定 key、value、version、缓存失效和反馈优先级。Mac 与浏览器规则使用同一 API，但每个 app/browser 的 store 独立。

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` 或 `null` |
| `{op:"put", key, value, version?, ifRevision?}` | 已保存的 `record` |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | 排序后的 `entries` 和 `next` |
| `{op:"clear", prefix?}` | `deleted` 数量 |

每条记录为 `{value, revision, version, updatedAt}`。不透明的 revision 在实际写入时更改；`version` 是调用方管理的元数据。`list` 返回不含 value 的 header；用 `get` 读取一条记录，用 `after: next` `put` `delete` 获取下一页。省略 `ifRevision` 时 put/delete 无条件执行；`null` 要求 key 不存在，revision 字符串要求完全匹配。不匹配时返回 `ok:false`、`error:"store-conflict"` 和当前 `record`，防止延迟的自动回复覆盖用户反馈。`v.context.revision` 是不透明的规则配置标记，规则可将其纳入自己的 version；框架不规定缓存策略。

限制：key 为1–2048字符，version ≤128，JSON value ≤64KiB，深度≤32，每组10000个 key，整份记录文档16MiB。`list` 每页最多100个 header、96KiB。每组最多32个请求，总计每秒128个启动；过载时每组每秒报告一个 `store-busy`，其余请求丢弃。存储错误返回 `ok:false`；未来版本或格式错误文档会保留并报告 `store-unavailable`。没有自动重试或清理。用 ticks 设置期限。

## 保存的内容附件

使用 `v.attach(tabId, item, id, spec)` 为观察到的内容项保存 pill 或被动 HTML/CSS 视图。传入完整 `item`，它来自 `items` 或 `attachment` 事件；单独的 `ref` 不是附件句柄。`contentId` 标识已保存内容，`instanceId` 标识当前出现的实例。等待 AI 时保留原句柄。若目标已删除、复用或导航，延迟附件会被拒绝。`v.item(tabId, ref, verdict)` 的行为仍彼此独立。

pill 的 `spec` 为 `{type:"pill", text, tone?, tooltip?}`；tone 可为 `blue`、`cyan`、`gold`、`pink` 或 `red`。纯文本最多240字符，tooltip最多1000。视图的 spec 为 `{type:"html", html, css?, label?}`。限制：HTML最多32000字符，CSS最多16000，label最多200。视图会从允许的被动HTML/SVG重建到封闭的 shadow root 中，并使用作用域CSS；脚本、事件属性、远程资源、嵌入内容和不安全CSS会被移除。视图限于内容卡片内，高度为480px时可滚动。ID由1–80个ASCII字母/数字、_或-组成。null spec 会移除组的pill。请在handler中调用；保存/传递错误会记入Log，不会自动重试。

每个内容项在只读快照 `item.attachments` 中提供本组附件；其中不含其他组的附件。保存数据不可用时，`attachments` 为null且设置 `attachmentError`，这不代表缓存为空。其他handler仍会继续运行。示例用于避免对已有保存结果的内容再次请求AI。

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

通过指针、Enter或Space激活会为本组产生 `attachment` 事件。pill发送 `click`。视图控件使用 `data-control` 或 `id` 作为 `controlId`，并发送 `click`、`input` 或 `change`，附带当前 `value` 和受限的命名控件 `values`。真实UI事件具有 `ev.origin === "user"`；规则创建的事件具有 `origin === "rule"`。事件包含 `tabId`、`attachmentId` 和当前 `item`。视图不执行规则代码；pill和视图会阻止交互导致底层卡片导航。保存数据不含callback或可执行代码。旧pill revision不能触发当前附件。规则emit事件属于普通规则逻辑；浏览器会单独验证真实UI点击消息。

附件按组/内容/ID保存在此浏览器配置中，并在后续出现、导航、浏览器重启和Run后恢复。Disable会隐藏但保留数据；enable会恢复显示。删除组会删除其附件。关联组仍各自独立；浏览器/设备间不会自动同步。已知的YouTube、Reddit、X和Bilibili内容使用平台ID；其他内容使用谨慎规范化的URL，因此可用性取决于支持的页面标记。

限制：每组/内容8个、跨所有组每个内容项32个、每组10000条内容记录、序列化附件文档8MB。达到上限后，新的变更会在Log中以 `attachment-item-limit` 或 `attachment-storage-limit` 拒绝，现有数据保留。dispatch会批量写入；相同 spec 不会重复写入存储。附件是浏览器内容UI，也适用于Safari原生规则引擎。Mac应用规则没有浏览器内容句柄或应用内附件界面。

`code-manual/generic-example.js` 是可执行策略示例。它使用记录、AI调用、用户反馈、compare-and-swap、HTML控件、内容项判定和规则管理的使用报告；这些行为属于示例代码，不是记录或附件存储的专属功能。
