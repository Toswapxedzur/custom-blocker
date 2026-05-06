# Custom Web Blocker — 使用说明手册

这是本扩展的完整参考手册。内容从最简单、最常见的使用流程开始，逐步深入到自定义 JavaScript 屏蔽规则和辅助 API 等高级主题。

如果你是第一次使用，只需要先阅读 **快速开始** 和 **屏蔽分组概览**。其余章节都属于可选内容，可按需查看。

---

## 1. 这个扩展能做什么

Custom Web Blocker 让你按自己定义的规则屏蔽网站和在线干扰。你可以：

- 使用浏览器原生网络屏蔽立即拦截网站（会出现类似 `ERR_BLOCKED_BY_CLIENT` 的效果）。
- 给自己设定某个网站每天可用的分钟数，超时后自动屏蔽。
- 屏蔽 YouTube、TikTok、Facebook、Instagram、Twitch、Reddit 上的特定内容类型（而不是整站）。
- 在支持的平台上从信息流中隐藏被拦截内容，而不只是拦截单个页面。
- 通过每周日期和 `HHMM-HHMM` 时间窗口安排规则生效时段。
- 冻结规则，避免你轻易修改。严格冻结会锁定指定小时数，并要求完成 20 步确认流程才能解除。
- 临时暂停（Snooze）规则，但必须先填写足够长的说明理由。
- 编写自定义 JavaScript 屏蔽规则，并使用正/倒计时器、按分组隔离的持久化存储、按平台拆分的 DOM 意图（隐藏导航按钮、按谓词隐藏信息流卡片、为子区域设置计时器）、URL 工具与日志等辅助能力。自定义规则直接运行在页面上下文里，因此传给平台 helper 的谓词可以使用闭包变量。
- 以 20+ 种语言使用扩展。

此扩展是一个 Chrome Manifest V3 扩展，包含一个编辑页面（弹出页）、一个后台 service worker，以及一个在每个页面运行的 content script。自定义屏蔽规则就运行在该 content script 中——每次页面加载和每次心跳（约 250 毫秒）都会调用一次，由其返回 `true` 或 `false` 决定是否屏蔽当前页面。

---

## 2. 界面导览

点击扩展图标后，编辑器会以完整网页形式打开（不是很小的弹窗）。页面包含以下区域：

- **顶部栏**
  - **Instruction Manual** 按钮（本文档）
  - **Language** 语言选择器
- **左侧面板 — Block Groups**
  - 显示你的屏蔽分组列表。每张卡片会显示分组名称、简要说明行和启用/禁用复选框。
  - **Add** 按钮用于创建新分组，旁边下拉框用于选择分组类型。
  - **Delete All** 删除全部分组；若存在冻结分组，会有额外确认步骤。
  - 你可以拖动卡片上的 `::` 手柄上下调整分组顺序。
  - 你可以拖动垂直分隔条来调整此面板宽度。
- **右侧面板 — Editor**
  - 编辑当前选中分组：名称、屏蔽行为、屏蔽列表、类型专属筛选、日程、冻结、Snooze。
  - 所有更改会在你停止输入或交互后约几分之一秒自动保存。
- **Toast**（居中淡出提示）
  - 显示状态信息，例如 “Saved changes” 或输入错误。

当页面正在被屏蔽或有活动计时器时，页面左上角会显示一个覆盖层，展示当前生效的所有时间限制，格式为 `hh:mm:ss`（或 `mm:ss`）。多个限制会按多行叠加显示。

---

## 3. 快速开始

1. 点击扩展图标，编辑器会以完整页面打开。
2. 在 **Block Groups** 面板中，从下拉框选择分组类型：
   - `Default`、`YouTube`、`TikTok`、`Facebook`、`Instagram`、`Twitch`、`Reddit` 或 `Custom`。
3. 点击 **Add**。会出现新分组并自动在编辑器中打开。
4. 给分组命名。
5. 填写该类型所需字段（例如 `Default` 需要填写 **Blocked websites** 列表）。
6. 确认左侧分组卡片的复选框处于开启状态。
7. 访问列表中的任一网站，屏蔽应立即生效。

这就是完整的主流程。手册其余内容都是在此基础上的可选功能。

---

## 4. 屏蔽分组概览

本扩展中的一切都围绕 **屏蔽分组（block groups）**。一个分组就是一套规则：

- 它有名称、类型和启用/禁用状态。
- 它有一种屏蔽行为（立即或在若干分钟后）。
- 它可选地包含日程（日期 + 时间窗口）与冻结/Snooze 控制。
- 按类型不同，还会有额外字段，例如网站列表、YouTube 创作者筛选、subreddit 名称或 JavaScript 函数。

你可以创建任意数量的分组。多个分组可能同时作用于同一页面；此时以**最严格**规则为准：

- “立即屏蔽” 比 “一段时间后屏蔽” 更严格。
- 剩余可用时间更少的分组比剩余时间更多的分组更严格。

因此，新增分组只会让页面更早被拦截，不会更晚。

**评估顺序为从下到上。** 扩展遍历分组时，会从列表底部开始，向上依次评估。位于列表顶部的分组最后被评估，因此享有“最终决定权”——例如，底部分组调用 `helpers.getPlatformHelper().youtube().hideShortButton()`，顶部分组调用 `showShortButton()`，则按钮保持可见。可拖动卡片上的 `::` 手柄改变此顺序。

---

## 5. 分组类型

### 5.1 `Default` — 屏蔽普通网站

用于屏蔽特定域名（最常见场景）。

- **Blocked websites**：每行一个网站。`facebook.com` 和 `https://www.facebook.com/somepage` 都可用；扩展会提取并规范化主机名。
- 某条网站规则会作用于该主机名及其所有子域名。
- 该分组类型使用 Chrome 原生网络屏蔽，效果类似 `ERR_BLOCKED_BY_CLIENT`。即访问被拦截 URL 时会在页面加载前就被终止。

### 5.2 `YouTube` — 屏蔽 YouTube 及类似视频站内容

编辑器会新增 **Filters** 区块：

- **Content type**：
  - `Apply to all YouTube pages` — 所有 YouTube 页面都计入。
  - `Apply to Shorts` — 仅 Shorts 页面计入。
  - `Apply to long videos` — 仅 `/watch`、`/live/`、`/embed/` 等计入。
  - `Apply to YouTube posts` — 社区帖子（`/post/...`、频道 community/posts 标签页）。
- **Author filter**：
  - `Do not filter by author` — 不按作者筛选。
  - `Apply to certain authors` — 仅列表中的作者触发该分组。
  - `Apply to all except certain authors` — 列表中的作者被豁免。
- **Authors**：每行一个作者。支持 `@handle`、完整 URL、`/channel/UC...`、`/c/...`、`/user/...`。
- **Hide blocked entries in the YouTube feed**：当该分组正在实际拦截时，YouTube 信息流中匹配的卡片会被隐藏；当拦截不再生效时，下次刷新会恢复显示。

对于 Shorts 和 Posts 内容类型，当未设置作者筛选且该分组正在拦截时，扩展还会隐藏相关导航入口（Shorts 侧边栏入口、Community/Posts 频道标签）以及诸如 “Latest YouTube posts” 这样的匹配内容区块。

短视频与长视频的识别还会扩展到 TikTok、Vimeo、Twitch clips/VODs、Dailymotion 等视频站点（前提是能识别其页面形态）。

### 5.3 `TikTok` — 屏蔽 TikTok 内容

编辑器卡片与平台视频类一致，但标签为 TikTok 专属：

- 内容类型：短视频、视频、个人主页。
- 作者：TikTok 用户名（`@handle`）或主页 URL。
- 信息流隐藏会在分组生效时隐藏 TikTok 页面中匹配卡片。

### 5.4 `Facebook` — 屏蔽 Facebook 内容

- 内容类型：Reels、视频、帖子。
- 作者：页面名（`page.name`）、个人主页 URL，或 `profile.php?id=...` 形式（数字 id 会保留为 `id:<number>`）。
- 信息流隐藏会隐藏 Facebook 中匹配的动态卡片。

### 5.5 `Instagram` — 屏蔽 Instagram 内容

- 内容类型：Reels、视频、帖子。
- 作者：Instagram 用户名或主页 URL。
- `/reel/`、`/p/`、`/tv/`、`/explore/` 等保留路径不会被当作作者。
- 信息流隐藏会隐藏 Instagram 中匹配卡片。

### 5.6 `Twitch` — 屏蔽 Twitch 内容

- 内容类型：clips、直播/VOD、频道主页。
- 作者：频道名或频道 URL。
- `/directory`、`/videos`、`/settings` 等保留路径不会被当作频道名。
- 信息流隐藏会隐藏 Twitch 中匹配卡片。

### 5.7 `Reddit` — 屏蔽 Reddit 或指定子版块

- **Subreddits**：每行一个 subreddit。留空表示作用于整个 Reddit。支持 `productivity` 与 `r/productivity` 两种写法。

### 5.8 `Custom` — 使用 JavaScript 函数屏蔽

你可以编写一个 JavaScript 函数。扩展的 content script 在源码改变时编译一次，并在用户访问的每个页面、每次心跳（约 250 毫秒）都会执行该函数。函数返回整数状态（`-1` 屏蔽、`0` 继续、`1` 允许），并可通过 `helpers` 对象修改计时器、跨次运行保存状态、隐藏平台特定按钮/信息流卡片，或为子区域设置计时器。

`Custom` 分组不会显示：屏蔽行为、屏蔽网站、允许分钟数、重置间隔、日程日期或时间窗口。它保留 **Blocking Rules** 编辑器以及标准冻结/Snooze 控制。此外还有一个 **Templates** 按钮，可打开带参数的预设模板页；应用预设前会先确认，再替换当前规则。

完整自定义规则和 helpers API 请见 **第 11 节**。

---

## 6. 屏蔽行为

对于大多数分组类型，你可选择两种模式之一：

### 6.1 立即屏蔽

当分组开启、日程允许，且（平台分组）页面匹配时，规则立即生效。

`Default` 分组使用 Chrome 原生屏蔽；平台分组使用页面内覆盖层/退出逻辑。

### 6.2 在若干分钟后屏蔽

这是一个使用时长预算机制。

- **Allowed minutes before block**（小数）：每个周期可用分钟数。例如：`15`、`0.5`、`90`。
- **Timer reset interval (hours)**（小数）：预算重置频率。例如：`24` 表示每天，`1` 表示每小时，`0.25` 表示每 15 分钟。

只要还有剩余时间，页面可正常使用，并显示计时覆盖层。预算归零后，该页面在本周期剩余时间内会被屏蔽，覆盖层显示 `0:00`，随后标签页会尝试退出。

扩展按分组、按周期计时：

- 每个分组有独立预算。
- 任何匹配该分组的页面所消耗时间都计入该分组预算。
- 同一分组下的多个标签页共享预算。它们计时同步；切换到另一个标签页也会强制刷新，立即显示当前共享时间。

若同一页面被多个限时分组命中，则最严格者生效。

---

### 6.3 计时器（倒计时，结束后屏蔽）

该模式会显示一个倒计时计时器，归零后立即屏蔽。

- **Timer reset interval (hours)**（小数）：既是计时器长度，也是重置频率。例如：`24` 表示每天，`1` 表示每小时，`0.25` 表示每 15 分钟。

与 **在若干分钟后屏蔽** 不同，此模式**没有**单独的 “Allowed minutes before block” 字段。计时器直接从重置间隔开始倒数，在匹配页面打开期间持续减少，归零后会一直屏蔽到下次重置。

---

## 7. 日程（Schedule）

在 **Schedule** 卡片中，你可以限制分组何时生效：

- **Days to block**：选择分组生效的星期。未勾选日期表示该日分组不生效。
- **Time windows**：自由格式列表，每行一个 `HHMM-HHMM` 时间窗，例如：

  ```
  0900-1000
  1200-1300
  ```

  分组只在这些窗口内生效。留空表示全天生效。

这适用于除 `Custom` 外的所有分组类型。

---

## 8. 冻结（防篡改）

冻结用于防止你一时冲动禁用分组。

在 **Freeze** 卡片中可选择：

- **Frozen** — 你不能编辑或删除该分组，也不能取消其启用开关。若要修改，必须执行解冻流程（见下文）。
- **Strict frozen** — 与 Frozen 相同，但会按你设置的小时数（小数，最多 72）保持锁定。在计时结束前，连解冻流程都不可用。

当冻结分组可解锁时，会出现 **Unfreeze** 按钮。点击后开始 **20 步流程**：

- 弹窗会显示一段自律提示信息。
- 你必须点击 `Confirm` 20 次。
- 两次点击之间强制等待 5 秒。
- 任一步取消都要从第 1 步重来。
- 20 条提示会轮换显示，确保你确实阅读。

如果分组还被标记为 “no snooze”（见下一节），则冻结期间也无法对其 Snooze。

分组卡片的元信息行会显示冻结状态；严格冻结还会显示剩余锁定时间。

---

## 9. Snooze（临时停用）

Snooze 可在不解冻的情况下临时停用分组，现在支持延迟启动、Snooze 后冷静期、确认步骤，以及累计 Snooze 时长统计。

在 **Snooze** 卡片中：

- **Allow snooze for this group** — 关闭时该分组完全不可 Snooze（包括冻结期间）。
- **Snooze for (minutes)** — 小数，Snooze 持续时长。
- **Activation delay (minutes)** — 大于等于 `0` 的小数。确认 Snooze 后，分组仍继续屏蔽，等这段延迟结束后 Snooze 才真正开始。
- **Cooldown after snooze (minutes)** — `0` 到 `5` 之间的小数。Snooze 结束后，在冷静期结束前不能再次对该分组发起 Snooze。
- **Times of confirmation** — 大于等于 `0` 的整数。若为 `0`，Snooze 会立即安排；否则点击 Start 后会进入恰好这么多步的确认流程。

每一步 Snooze 确认之间都必须强制等待 **5 秒**。弹窗会明确提示这一点，并在按钮上显示实时倒计时。

如果分组已冻结，Snooze 设置会锁定为冻结前设定值。只要允许 Snooze，仍可执行 Snooze，但必须使用已保存的延迟 / 冷静期 / 确认设置。

Snooze 卡片还会显示该分组的 **累计 Snooze 时间**。这个累计值按 Snooze 的激活时长计算；即使该时间段内网站因为其他原因变得可访问，这段激活中的 Snooze 时间仍会完整计入。

当 Snooze 结束时，规则会立即恢复。如果该分组原本不是冻结状态，扩展会在 Snooze 结束时自动把它重新冻结。

状态消息会确认 Snooze 已开始。Snooze 结束后，分组会自动恢复正常。

你也可以通过 **End Snooze** 按钮提前结束 Snooze。

---

## 10. 批量操作

- **Delete All** 会删除全部分组。
  - 始终会要求确认。
  - 若至少有一个分组被冻结，会要求执行与解冻相同的 20 步流程。
  - 若存在仍在锁定期内的 strict-frozen 分组，**Delete All** 会被禁用。

---

## 11. Custom 分组 — 事件驱动参考（v1.1+）

从 v1.1 起，自定义规则改为**事件驱动**。规则不再是“每次心跳调用、由返回值决定是否屏蔽”的函数，而是一段在被调用时**注册事件处理器**的脚本（页面打开、URL 变化、tick、自定义事件等）。处理器在导航和切换标签页之间持续保留，统一存活在一个长生命周期的 offscreen 沙箱中。

规则函数体只在**点击 Run 时执行一次**（或者在分组被启用且已存在 active source 时由系统自动执行一次）。要重新加载处理器，请在编辑器中点击 **Run**。

### 11.1 规则签名

```js
(event, helpers) => {
  // 在这里注册处理器。本函数每次 Run 点击仅被调用一次
  // （或在分组启用时被自动调用一次）。
}
```

两个参数：

- `event` — 当前分组的**事件注册中心**。用它来注册、覆盖、查询、计数、注销处理器，以及通过 `post(...)` 派发自定义事件。
- `helpers` — 辅助工具集合（详见 11.3）。

函数**不需要**返回值。是否屏蔽或放行的决定，发生在事件触发后某个被注册的处理器调用 `ev.preventDefault()` 和/或 `ev.setResult(...)` 时。

### 11.2 生命周期

- **Run**（每个分组编辑器内的按钮）：引擎先清掉所有此前打着该分组标签的处理器，然后在每个已打开标签页对应的 offscreen 沙箱视图中重新执行规则函数体。这是编辑源代码后唯一能让新版本生效的方式。
- **禁用分组**：所有打着该分组标签的处理器都会被清除。源代码仍保留在 storage 中，但不再响应任何事件。
- **重新启用分组**：引擎会自动重新执行该分组的 active source。
- **删除分组**：等同于禁用——所有该分组标签的处理器都会被清掉。
- **以相同 `(eventType, id)` 重复注册**：静默覆盖旧的注册。

offscreen 沙箱由**所有**自定义分组共享。来自不同分组的处理器共存其中，每个内部都打了所属 group id 的标签，因此 “Run”、禁用、删除只会作用到正确的分组上。

### 11.2.1 事件注册中心（`event`）

通用方法：

- `event.register(type, id, handler, options?)` — 为任意事件类型注册处理器。`id` 由你自定。`options.priority`（默认 `0`）—— 数值越大越先执行。`options.intervalMs` —— 仅对 `tickEvent` 有效，用于对单个处理器节流（全局 tick 仍然每秒一次）。以相同 `(type, id)` 再次注册会覆盖。
- `event.unregister(type, id)`、`event.unregisterAll(type)`。
- `event.post(type, data?, { scope })` — 派发一个自定义事件。`scope: "global"` 会送到所有分组；默认 `scope: "group"` 仅送到**同一分组**内的处理器。

每个内置事件类型都附赠一组语法糖（同一套形状的方法）：

- `event.registerTickEvent(id, handler, opts)`、`event.getTickEvent(id)`、`event.getTickEvents()`、`event.countTickRegistered()`。
- `event.registerOpenWebEvent(id, handler, opts)`、`event.getOpenWebEvent(id)`、`event.getOpenWebEvents()`、`event.countOpenWebRegistered()`。
- `closeWebEvent`、`switchWebEvent`、`switchDomainEvent`、`timerEnded` 同形。

### 11.2.2 内置事件类型

| 类型 | 触发时机 | `ev.data` |
|---|---|---|
| `tickEvent` | 全局共享的每秒 tick，所有打开的标签页都会按优先级触发各自的处理器。 | `{ intervalMs: 1000 }` |
| `openWebEvent` | 新建标签页，或一次新的导航命中了引擎在该标签下尚未见过的 URL。点击 Run 之后**不会**对已打开的标签页再次触发。 | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | 标签页被关闭。 | `{ reason, nextUrl }` |
| `switchWebEvent` | 同一标签页内 URL 发生变化——整页刷新、前进/后退、SPA 路由切换都会触发。任何 URL 改变都会触发。 | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | URL 变化跨越了主机名边界（例如 `youtube.com` → `wikipedia.org`）。会和 `switchWebEvent` 同时触发。 | `{ previousUrl, previousHostname }` |
| `timerEnded` | 当前分组下任意计时器达到 `currentMs === 0`。仅会派发给拥有这个计时器的分组。 | `{ timerId, displayName, direction, currentMs }` |

`ev.url` 以及事件 data 中的 URL 都已经过**事件级规范化**：Chrome 的 New Tab Page（即显示 Google 搜索框的“新标签页”）、`about:blank` 以及对应的 newtab scheme，都会被暴露成空字符串 `""`。因此一个 `ev.url === ""` 的计时器只会在新标签页时推进。普通的 `google.com` URL 不受影响。

### 11.2.3 事件对象（`ev`）

每个处理器都以 `(ev, helpers) => void` 形式被调用。`ev` 携带：

- `ev.type` — 事件类型。
- `ev.groupId` — 收到事件的分组 id。
- `ev.tabId`、`ev.pageId`、`ev.url`、`ev.hostname` — 事件上下文。
- `ev.time` — 派发时刻的 `{ now, month, dayOfMonth, dayName, hour, minute }` 快照。
- `ev.data` — 事件特定的数据（见上表）。

方法：

- `ev.preventDefault()` — 把本次派发标记为“屏蔽”。host content script 会退出页面（或跟随 `setRedirectLink`），除非更高优先级的处理器之后调用了 `setResult(1)` 把它覆盖。
- `ev.stopPropagation()` — 立即终止本次派发。**不会再有任何分组**的处理器收到该事件。
- `ev.setResult(value)` — 设置派发结果。`value` 可以是 `[-255, 255]` 内的**数值**（`-1` 屏蔽、`0` 中立、`1` 放行；其他整数保留给你自己的调试逻辑），或者一个**字符串**(被解释为重定向 URL)。所有处理器中最后一次 `setResult` 调用获胜。数值 `1` 会覆盖此前任意 `preventDefault`。
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` — 当本次派发以屏蔽收尾时，host 应导航到的 URL。这是在自定义规则中设置跳转的**唯一**方式；编辑器对 Custom 分组已不再展示 “Redirect URL when blocked” 字段。
- `ev.post(type, data, { scope })` — 在处理器内部派发后续事件。

此外 `ev` 是一个 Proxy：你设到它上面的任意字段（例如 `ev.foo = 42`）会存入一个 `custom` 映射，可以从同一处理器或同一次派发中后续的处理器里读回来。

### 11.3 `helpers` 对象

每次处理器调用都会拿到一份新的 `helpers`，它已被绑定到接收事件的分组以及事件的 URL。常量字段：

- `helpers.now` — 派发时的 epoch 毫秒。
- `helpers.currentUrl` — 事件 URL（已做 newtab/blank 规范化）。
- `helpers.groupId` — 接收事件的分组 id。

访问器方法：

- `helpers.getLogHelper()` — `log/warn/error`，自动加上 `[CustomBlocker:groupId]` 前缀，并以浮窗形式显示在页面上。
- `helpers.getDomainHelper()`（别名 `helpers.getDomainUtility()`）— URL 检查（详见 11.3.5）。
- `helpers.getTimerHelper()` — 分组级计时器（倒计时 / 正计时）；状态跨浏览器重启保留。
- `helpers.getPersistenceHelper()` — 分组级 JSON 键值存储。
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()`（同时提供 `set/get` 别名）。对自定义规则而言，这是设置“被屏蔽时跳转 URL”的**唯一**方式。
- `helpers.getPlatformHelper()` — 按平台拆分的 DOM 意图（详见 11.3.6）。
- `helpers.getDOMHelper()` — 通用 DOM 意图：`hide(sel)`、`show(sel)`、`addClass(sel, c)`、`removeClass(sel, c)`、`setText(sel, text)`、`click(sel)`、`injectCss(css, id?)`、`removeInjectedCss(id)`、`scrollTo(sel)`。意图会被批量收集，处理器返回后再统一应用到 DOM。
- `helpers.getNavigationHelper()` — `back()`、`forward()`、`reload()`、`goTo(url)`、`closeTab()`。作用对象是事件来源的标签页。
- `helpers.getStorageHelper()` — `getPersistenceHelper` 的超集，额外提供 `requestAsyncGet(key)` / `requestAsyncSet(key, value)` 之类的异步钩子用于跨扩展存储（结果以一个后续自定义事件的形式回调）。
- `helpers.getTabHelper()` — 在事件携带的 tab 快照上提供 `list()`、`getActiveTab()`、`getById(id)`、`countOpen()`。

所有 helper 方法都设计为安全调用：参数错误时返回 `null`、`false` 或空值，不会抛异常。

#### 11.3.1 `getTimerHelper()`

按分组持久化的计时器。每个计时器由你自定的字符串 `id` 标识；标识作用域限定在分组内，所以两个分组都可以使用同一个 `id`（例如 `"yt-shorts"`）而不冲突。状态跨浏览器重启保留。

计时器的持久化字段仅有：`id`、`displayName`、`direction`（`"forward"` 或 `"backward"`）、`isPaused`、`currentMs`。**不会**保存“初始时长”——`isExpired` 即 `currentMs === 0`。Forward 计时器永远向上累加，自身不会过期。

构造方法有两个，请按意图选择：

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **总是（重新）创建**：用传入的初始字段覆盖既有状态，包括 `currentMs`。适用于“立即重置”这种一次性场景。
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **幂等**。若同 `id` 已存在，仅会更新 `displayName` 与 `direction`，`currentMs` 保留不变；若不存在则按初始字段创建。常规的“确保计时器存在并继续推进”请用此方法。

两个方法都接受两个**仅在本次心跳生效、不会被持久化**的谓词：

- `scope: (url) => boolean` — 当前 URL 让该谓词返回 `true` 时，本次心跳会按心跳间隔自动推进计时器。每次心跳每个分组最多自动推进一次。
- `domain: (url) => boolean` — 当前 URL 让该谓词返回 `true` 时，计时器会渲染到页面左上角的覆盖层中。未传 `domain` 时系统会回退使用 `scope` 作为显示门控。

其他方法：

- `delete(id)`、`pause(id)`、`resume(id)` — 标准生命周期。`pause` 会冻结 `currentMs`。
- `setDirection(id, "forward" | "backward")`、`setCurrentMs(id, ms)`、`addMs(id, deltaMs)` — 直接修改器。
- `setDisplayName(id, name)` — 重命名标签。
- `getCurrentMs(id)`、`getDirection(id)`、`getDisplayName(id)`、`isPaused(id)`、`exists(id)`。
- `isExpired(id)` — 仅当 `currentMs === 0` 时为 `true`。
- `getState(id)` — 返回 `{ id, displayName, direction, isPaused, currentMs, isExpired }` 或 `null`。
- `list()` — 返回该分组下所有计时器的状态数组。

#### 11.3.2 `getPersistenceHelper()`

作用域为当前分组的类 Map 存储。值必须可 JSON 序列化。

- `set(key, value)`、`get(key, defaultValue?)`、`has(key)`、`delete(key)`、`keys()`、`entries()`、`clear()`、`size()`。

软限制：每组约 200 个键，每个值约 16 KB。

#### 11.3.3 `getLogHelper()`

- `log(...args)`、`warn(...args)`、`error(...args)` — 写入页面控制台并以浮窗形式渲染在页面上。每行都带 `[CustomBlocker:groupId]` 前缀。

#### 11.3.4 `getRedirectionHelper()`

读取或覆盖 content script 在当前页面被屏蔽时跳转的目标 URL。

- `get()` — 返回当次派发当前生效的跳转 URL。初始值为内置分组配置的 fallback URL（如有），否则为 `""`。
- `set(url)` — 覆盖当次派发的跳转 URL。成功返回 `true`；非字符串输入返回 `false`。传入 `""` 可清空跳转覆盖，回退到默认退出行为（按上下文转到主页 / `about:blank`）。

像其他 custom-rule 副作用一样，这一状态在本次派发的所有处理器之间共享。优先级最高的处理器中最后一次调用 `set(...)` 的最终生效。

#### 11.3.5 `getDomainHelper()`（别名 `getDomainUtility()`）

URL 检查工具。不再提供 `normalize()`，因为传入的 URL 已经做过规范化。

核心方法：

- `hostnameOf(url)`、`pathnameOf(url)`、`matches(hostname, site)`、`getPlatform(url)`。
- `isYouTubeHost`、`isTikTokHost`、`isInstagramHost`、`isFacebookHost`、`isTwitchHost`、`isRedditHost`、`isDiscordHost`。
- `youtube()`、`tiktok()`、`instagram()`、`facebook()`、`twitch()` — 每个都返回 `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`。

URL 过滤与区域识别（v1.1 新增）：

- `isEmptyStartPage(url)` — 对新标签页及等价 URL（被处理器看到为 `""` 的那些）返回 `true`。
- `matchesAny(url, patterns)` — `patterns` 可以是一个正则、一个正则字符串，或两者的数组。
- `pathStartsWith(url, path)` — 边界感知（`pathStartsWith("/r/", "/r")` 为 `true`，但 `"/results/"` 不算）。
- `queryHas(url, key, value?)`、`queryGet(url, key)` — 查询字符串检查。
- `isSearchPage(url)` — 识别 Google / Bing / DuckDuckGo / YouTube 结果页 / Reddit / Twitter / X 搜索页。
- `isInfiniteFeedUrl(url)` — 识别 YouTube、TikTok、Instagram、Facebook、Reddit、X 的算法信息流页面。
- `sameSection(a, b)` — 同一主机名且首段路径相同。

#### 11.3.6 `getPlatformHelper()`

按平台拆分的 DOM 意图、子区域计时器以及状态检查方法。`helpers.getPlatformHelper().<platform>()` 都返回一个对象，包含：

可见性意图：

- `hideShortButton()` / `showShortButton()`、`hideHomePage()` / `showHomePage()`。
- `hideShorts(predicate, { blockPageOnVisit })` / `showShorts()`、`hideVideos(...)` / `showVideos()`、`hidePosts(...)` / `showPosts()`。
- `hideComments()` / `showComments()` / `filterComments(predicate)` — 完全隐藏平台评论区，或按谓词过滤单条评论。
- `hideLive()` / `showLive()` / `filterLive(predicate)` — 同上，作用于支持直播的平台（YouTube、TikTok、Twitch、Facebook）。

状态检查（在派发时根据事件携带的快照返回值）：

- `isCurrentChannelSubscribed()`、`isChannelSubscribed(idOrHandle)`。
- `isCurrentChannelVerified()`。
- `isLiveNow()`、`isItemLive(item)`。
- `isAlgorithmicRecommendation(item)`、`isSponsored(item)`。

URL 分类器再次暴露：`isPlatformUrl`、`isShortUrl`、`isVideoUrl`、`isPostUrl`、`isHomePage`、`extractAuthor`、`extractVideoId`。

子区域计时器 —— `setShortsTimer({ id, direction, currentMs, displayName })`、`setVideosTimer({ ... })`、`setPostsTimer({ ... })` —— 把计时器登记到分组的持久化桶中,并在配置了 scope 时只在对应子区域 URL 上推进。

谓词类方法都会按匹配的卡片调用，参数 `item` 形如 `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`。任何字段都可能为 `null`；遵循“疑罪从无”——你需要的字段缺失时请返回 `false`。

### 11.4 示例

简单 —— 工作日早晨屏蔽 YouTube Shorts 页面：

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

中等 —— YouTube Shorts 每天 30 分钟额度，超额后跳转到一个 focus 页：

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts"
  });

  // 当前激活页是 Short 时每秒倒计时一次。
  event.registerTickEvent("budget-tick", (ev, h) => {
    if (!yt.isShortUrl(ev.url)) return;
    h.getTimerHelper().addMs(TIMER_ID, -1000);
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("额度归零。");
  });
}
```

更难 —— 隐藏作者句柄过长的 YouTube Shorts，并注入一段“此 Short 已被隐藏”的 CSS：

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
}
```

最难 —— 让一个处理器派发自定义事件给其他处理器：

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. 多页面行为

- 同一分组下所有已打开标签页共享同一个计时器。
- 切换到同一分组中的另一个标签页时，其覆盖层会立即刷新并显示当前共享时间。
- 新规则添加后，所有已打开页面会在零点几秒内检测到变化并刷新；无需手动重载标签页。
- 当规则失效后，被隐藏的信息流卡片和导航按钮会在下一次刷新时恢复。

---

## 13. 国际化

整个 UI 已完整翻译。请使用右上角 **Language** 选择器。

支持语言包括英语、简体中文、西班牙语、日语、韩语；还包含印地语、阿拉伯语、孟加拉语、葡萄牙语、俄语、旁遮普语、德语、法语、土耳其语、越南语、意大利语、泰语、荷兰语、波兰语、印尼语、乌尔都语、波斯语等部分覆盖语言。部分覆盖语言对缺失字符串会回退到英语。

说明手册本身会加载与你所选语言对应的 markdown 文件，缺失时回退到英语。

---

## 14. 状态消息

状态消息会以居中 toast 显示，并在约两秒后淡出：

- "Saved changes."
- "Created \"Group name\"."
- 类似 "Allowed minutes must be a number greater than 0." 的校验错误。
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

对于有格式要求的输入框，消息也会显示在相关按钮旁（如 snooze）。

---

## 15. 隐私与存储

- 所有数据都仅存储在本地 `chrome.storage.local`，不会发送到任何地方。
- 存储内容包括：你的分组、使用计时器、上次重置时间、snooze 记录、自定义计时器、自定义持久化值。
- 扩展不会读取页面正文内容，除非为检测页面类型所必需（路径/主机名/视频站点已知 DOM 标记）。不会读取你的消息、帖子、评论或私密内容。

---

## 16. 权限

- `storage` — 用于上述数据存储。
- `declarativeNetRequest` — 用于 `Default` 分组的原生屏蔽。
- `alarms` — 用于高效调度规则状态切换。
- `host_permissions: <all_urls>` — 使 content script 能在任意页面显示计时覆盖层并检测平台上下文。

---

## 17. 故障排查

- **我新增的分组没有效果。** 请确认分组已启用、当前时间符合日程、没有活动 snooze，并且（平台分组）页面确实匹配所选内容类型和作者筛选。
- **某个标签页上的计时器卡住或不对。** 切走再切回，或重新聚焦该标签页——这会触发从共享计时器强制刷新。
- **信息流卡片又出现了，但我觉得应该还在隐藏。** 信息流隐藏只在规则“正在拦截”时运行。若你使用 `after-minutes` 规则，只有时间归零后才会开始隐藏。
- **我预期应隐藏的 YouTube 导航按钮还在。** 导航隐藏要求规则设为 “do not filter by author”，且内容类型为 Shorts 或 YouTube posts。启用作者筛选时，只会按卡片级别隐藏。
- **Custom 规则没效果或静默报错。** 自定义规则现在运行在页面上下文中。在该页面打开 DevTools（右键 → 检查 → Console），查找 `[CustomBlocker:groupId]` 前缀的消息。可用 `helpers.getLogHelper().log(...)` 跟踪规则执行。
- **我无法删除某个分组。** 该分组很可能被冻结。strict-frozen 分组在锁定结束前完全不可删除；非 strict 冻结分组可通过解冻流程后删除。

---

## 18. 术语表

- **Block group** — 一套独立规则，拥有自己的类型、行为、日程与冻结/Snooze 设置。
- **Instant block** — 规则一旦处于生效状态即立即拦截。
- **After-minutes block** — 规则仅在本周期时间预算耗尽后才开始拦截。
- **Reset interval** — after-minutes 预算的重置频率。
- **Schedule** — 分组生效的日期 + 时间窗口。
- **Freeze / Strict freeze** — 防篡改状态。
- **Snooze** — 带可配置确认流程的临时停用。
- **Author filter** — 平台分组中用于限定特定内容创作者的筛选器。
- **Content type** — 平台分组中用于限定内容形态（short、long、post）的筛选器。
- **Helpers** — 传递给 custom 规则函数的工具集合。
- **Platform** — `youtube`、`tiktok`、`facebook`、`instagram`、`twitch` 之一。每个平台都有自己的分组类型和信息流隐藏逻辑。

---

## 19. 限制

- 信息流隐藏依赖各平台当前 DOM 结构。若平台改版，隐藏选择器可能需要更新。
- 对非 YouTube 网站的平台上下文检测主要基于 URL，因此在标准内容 URL 上最可靠。
- Custom 规则在每个页面的 content script 中运行，因此两个标签页同时修改同一个分组级计时器时采用“最后写入者获胜”策略。一般用途下完全够用；若需要精确计时，请预期偶有少量漂移。
- 传给 `hideShorts/hideVideos/hidePosts` 的谓词会针对每张信息流卡片同步执行。谓词中过重的逻辑会拖慢信息流滚动；保持轻量即可。
- 浏览器在空闲时可能挂起后台 service worker。扩展会在页面或 alarm 需要时立即恢复；site/timed 的使用预算通过心跳回放保持准确。
