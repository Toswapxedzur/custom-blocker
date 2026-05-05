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

你可以编写一个 JavaScript 函数。扩展的 content script 在源码改变时编译一次，并在用户访问的每个页面、每次心跳（约 250 毫秒）都会执行该函数。返回 `true` 即退出当前页面；返回 `false`（或任何非 `true` 值）则放行。函数可通过 `helpers` 对象修改计时器、跨次运行保存状态、隐藏平台特定按钮/信息流卡片，或为子区域设置计时器。

`Custom` 分组不会显示：屏蔽行为、屏蔽网站、允许分钟数、重置间隔、日程日期或时间窗口。它只保留一个大输入框——**Blocking Rules** 函数，以及标准冻结/Snooze 控制。

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

Snooze 可在不解冻的情况下临时停用分组，但必须填写书面理由。

在 **Snooze** 卡片中：

- **Allow snooze for this group** — 关闭时该分组完全不可 Snooze（包括冻结期间）。
- **Snooze for (minutes)** — 小数，Snooze 持续时长。
- **Reason** — 必须**至少 100 个字符且超过 20 个单词**。只有两项都满足时 Start 按钮才会启用。若不满足，会在按钮旁显示行内警告。

如果分组已冻结，Snooze 分钟数会锁定为冻结前设定值。只要允许 Snooze 且理由满足规则，仍可执行 Snooze。

状态消息会确认 Snooze 已开始。Snooze 结束后，分组会自动恢复正常。

你也可以通过 **End Snooze** 按钮提前结束 Snooze。

---

## 10. 批量操作

- **Delete All** 会删除全部分组。
  - 始终会要求确认。
  - 若至少有一个分组被冻结，会要求执行与解冻相同的 20 步流程。
  - 若存在仍在锁定期内的 strict-frozen 分组，**Delete All** 会被禁用。

---

## 11. Custom 分组（完整参考）

`Custom` 分组会在用户访问的每个页面的 **content script** 中执行一段 JavaScript 函数。页面加载时执行一次，每次心跳（约 250 毫秒）也再执行一次。其返回值决定当前页面是否被屏蔽，对 `helpers` 对象的副作用决定 DOM 操作和分组级计时器/持久化状态如何变化。

由于函数运行在页面自身上下文中（而非后台 worker），你在函数内声明的所有闭包变量都可以被传给 `hideShorts`、`hideVideos`、`hidePosts` 的谓词读取。

### 11.1 函数签名

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  // your logic
  return false;
}
```

参数说明：

- `month` — `1` 到 `12`。
- `dayOfMonth` — `1` 到 `31`。
- `dayName` — 例如 `"Monday"`。
- `hour` — `0` 到 `23`。
- `minute` — `0` 到 `59`。
- `url` — 当前页面的 URL 字符串（已规范化）。可直接传入 `helpers.getDomainUtility()` 的方法。
- `helpers` — 一组辅助访问器（见下文）。

返回值：

- `true` — 退出当前页面（与 site/timed 分组命中拦截走的是同一条退出路径）。
- 其他任何值 — 放行。注意：在 YouTube 主页时调用 `helpers.getPlatformHelper().youtube().hideHomePage()` 也会退出页面，即使你返回的是 `false`。

弹窗**不会**在你输入过程中自动校验语法——否则每个未写完的中间状态都会被标红。可以点击 Blocking Rules 文本框旁的 **Check syntax** 按钮按需校验。该按钮会做三件事：

1. 先冲刷待写入的自动保存，保证结果出现时规则已经落到 storage（无需等 400 毫秒防抖，也不必担心切换标签页时还没保存——文本框失焦时也会立刻冲刷一次）。
2. 在 sandbox iframe 中编译源码（Chrome 在普通扩展页中禁用 `new Function`）。
3. 用一组虚拟参数和一个**类型严格**的 `helpers` 桩对象（精确镜像真实 API）把编译出来的函数实际调用一次。这样可以在永远会执行到的代码路径上抓到拼写错误和 `ReferenceError`，例如 `return truel;`、`helpers.nah()`、`helpers.getPlatformHelper().myspace()` 都会被报错。这里特意**不**用宽放型 Proxy，否则任何拼错的方法名都会静默通过。虚拟参数不会触达的分支仍然**不会**被校验，只有跟桩对象交互的那段代码才会被检查。

即使语法不通过，源码也会照常保存；content script 会静默跳过无法编译的规则。若函数在运行时抛出异常，扩展会捕获错误并写入页面控制台（前缀为 `[CustomBlocker:groupId]`），同一心跳中其余规则继续执行。

任何页面只要有匹配上的自定义规则，都会在右下角显示一个**调试浮窗**。每条规则会列出分组名、content script 实际在运行的源码，以及最近一次心跳里它返回的值（`true`、`false` 或运行时错误信息）。点击浮窗右上角的 `×` 可以关闭它，关闭状态在该页面会话中持续生效，刷新页面即可重新出现。

### 11.2 执行模型

- Custom 规则按 **从下到上** 的存储顺序运行。底部分组先执行，顶部分组最后执行，并对意图（intent）拥有“最终决定权”（show/hide 语义见下文）。
- Content script 自身**不会**编译或执行规则。Chrome 的默认扩展 CSP 在沙箱页面之外都禁用 `new Function` / `eval`，所以 content script 会在每个页面里挂一个隐藏的 `sandbox.html` 子页 iframe，并通过 `postMessage` 把每次心跳的规则批次送进去。沙箱页加载 `helpers.js` 并运行规则；执行结果、被改动的计时器/持久化桶、累计的 DOM 意图都通过 `postMessage` 回传。Content script 再把意图作用于页面 DOM，并决定是否退出页面。
- 由于规则执行变成了 `postMessage` 的来回往返，新页面加载后第一次拦截判断会延迟一小段时间（通常 < 50 毫秒）。后续心跳命中沙箱里以源码为键的编译缓存，几乎是即时的。
- 你对 `helpers.getTimerHelper()` 和 `helpers.getPersistenceHelper()` 的修改，会在下一次心跳时回写到后台 service worker。如果两个标签页同时执行规则，则采用“最后写入者获胜”策略——典型场景下完全够用，但需要知晓。
- Custom 分组**不再参与网络层（`declarativeNetRequest`）拦截**。只有 `Default`（site）分组会产生原生 `ERR_BLOCKED_BY_CLIENT` 拦截。Custom 规则通过 content script 退出页面来实现拦截。
- 一种少见的失败模式：如果宿主页面用严格的 `frame-src` CSP 拒绝 `chrome-extension:`，沙箱 iframe 会加载失败，调试浮窗会把这个错误显示出来。这些页面上自定义规则就跑不起来了；site / timed 分组依然正常工作。

### 11.3 `helpers` 对象

`helpers` 暴露若干访问器方法以及三个常量字段：

- `helpers.now` — 当前 epoch 毫秒时间戳。
- `helpers.elapsedMs` — 距上一次心跳的毫秒数。如需手动推进计时器，可使用此值。
- `helpers.currentUrl` — 与 `url` 参数相同；用于在谓词内部更方便引用。
- `helpers.getTimerHelper()`
- `helpers.getPersistenceHelper()`
- `helpers.getLogHelper()`
- `helpers.getPlatformHelper()`
- `helpers.getDomainUtility()`

所有 helper 方法都设计为安全调用：参数错误时返回 `null`、`false` 或空值，而不会抛异常。

#### 11.3.1 `getTimerHelper()`

按分组持久化的计时器。每个计时器由你自定的字符串 `id` 标识；标识作用域限定在分组内，所以两个分组都可以使用同一个 `id`（如 `"yt-shorts"`）而不冲突。状态跨浏览器重启保留。

计时器持久化字段仅有：`id`、`displayName`、`direction`（`"forward"` 或 `"backward"`）、`isPaused`、`currentMs`。**不会**保存“初始时长”——`isExpired` 即 `currentMs === 0`。Forward 计时器永远向上累加，自身不会过期。

构造方法有两个，请按意图选择——这点很重要，因为规则通常会**每次心跳**都被调用：

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **总是（重新）创建**：用传入的初始字段覆盖既有状态，包括 `currentMs`。适用于“立即重置”场景（例如在某分支里手动复位）。如果规则每次心跳都用同一 `id` 调用 `create`，计时器会被反复重置，永远无法推进。
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **幂等**。若同 `id` 已存在，仅可能更新 `displayName` 与 `direction`，`currentMs` 保留不变；若不存在则按初始字段创建。常规的“确保计时器存在并继续推进”场景请用此方法。

两个方法都接收两个**仅在本次心跳生效、不会持久化**的谓词：

- `scope: (url) => boolean` — 返回 `true` 时，本次心跳会按心跳间隔推进计时器（与默认 block group 的 usage timer 使用同一时间增量，速率因此完全一致）。同一分组内每次心跳最多只会自动推进一次，无论被多少条规则调用。
- `domain: (url) => boolean` — 返回 `true` 时，计时器在本次心跳的页面左上角覆盖层中显示。未传 `domain` 时系统回退到 `scope` 作为显示门控，因此“在 `/shorts/` 页推进”的计时器无需额外配置就能在那里显示。需要解耦“推进”与“显示”时（例如仅在 `/shorts/` 推进，但希望在整个 `youtube.com` 都展示剩余时间）才需要单独传 `domain`。

其他方法：

- `delete(id)`、`pause(id)`、`resume(id)` — 标准生命周期。`pause` 会冻结 `currentMs`。
- `setDirection(id, "forward" | "backward")`、`setCurrentMs(id, ms)`、`addMs(id, deltaMs)` — 直接修改器。
- `setDisplayName(id, name)` — 重命名标签。
- `getCurrentMs(id)`、`getDirection(id)`、`getDisplayName(id)`、`isPaused(id)`、`exists(id)`。
- `isExpired(id)` — 仅当 `currentMs === 0` 时为 `true`。
- `getState(id)` — 返回 `{ id, displayName, direction, isPaused, currentMs, isExpired }` 或 `null`。
- `list()` — 返回该分组下所有计时器的状态数组。

#### 11.3.2 `getPersistenceHelper()`

作用域限定在当前分组的类 Map 存储。值必须可 JSON 序列化。

- `set(key, value)`、`get(key, defaultValue?)`、`has(key)`、`delete(key)`、`keys()`、`entries()`、`clear()`、`size()`。

软限制：每组约 200 个键，每个值约 16 KB。

#### 11.3.3 `getLogHelper()`

- `log(...args)`、`warn(...args)`、`error(...args)` — 写入**页面控制台**（因为规则现在在 content script 中运行）。每行前缀为 `[CustomBlocker:groupId]`。

#### 11.3.4 `getDomainUtility()`

URL 检查工具。是旧 `domainHelper` + `platformHelper` 的合并替代。**不再提供 `normalize()`**，因为传入的 URL 已经规范化——直接传入即可。

- `hostnameOf(url)` — 返回如 `"youtube.com"`，失败返回 `null`。会去掉 `www.`。
- `pathnameOf(url)` — 缺失时返回 `"/"`。
- `matches(hostname, site)` — 若 `hostname` 等于 `site` 或为其子域名，则返回 `true`。
- `getPlatform(url)` — `"youtube" | "tiktok" | "instagram" | "facebook" | "twitch" | null`。
- `isYouTubeHost(host)`、`isTikTokHost(host)`、`isInstagramHost(host)`、`isFacebookHost(host)`、`isTwitchHost(host)`、`isRedditHost(host)`、`isDiscordHost(host)`。
- `youtube()`、`tiktok()`、`instagram()`、`facebook()`、`twitch()` — 每个返回一个结构相同的对象：
  - `isPlatformUrl(url)`、`isShortUrl(url)`、`isVideoUrl(url)`、`isPostUrl(url)`、`isHomePage(url)` — 布尔值。
  - `extractAuthor(url)` — 规范化作者句柄（如 `"mkbhd"`、`"channel:UC..."`、`"id:1234"`）或 `null`。
  - `extractVideoId(url)` — 平台特定的视频 id（`v=...`、路径段等）或 `null`。

#### 11.3.5 `getPlatformHelper()`

按平台拆分的 DOM 意图与子区域计时器。利用它你可以做到内置 `YouTube` / `TikTok` 等分组所能做的一切——并且更多，因为可由任意 JavaScript 驱动。

helper 本身按平台拆分为方法：

- `helpers.getPlatformHelper().youtube()`
- `helpers.getPlatformHelper().tiktok()`
- `helpers.getPlatformHelper().instagram()`
- `helpers.getPlatformHelper().facebook()`
- `helpers.getPlatformHelper().twitch()`

每个返回一个对象，含下文所列方法。接收 `predicate` 的方法会对每张匹配的信息流卡片调用一次谓词，参数 `item` 形如：

```ts
{
  url:          string | null,  // 卡片所指内容的规范 URL
  name:         string | null,  // 标题/文案
  author:       string | null,  // 规范化作者句柄
  length:       number | null,  // 秒
  views:        number | null,
  publishedAt:  string | null,  // 自由格式，如 "3 days ago"
  description:  string | null
}
```

任何字段在 DOM 不暴露时均可能为 `null`。遵循“疑罪从无”原则：若谓词关心的字段为 `null`，应返回 `false`（不屏蔽）。当系统连 `item` 都构造不出来时，谓词不会被调用。

各平台 helper 的方法：

- `hideShortButton()` / `showShortButton()` — 隐藏或恢复该平台的 “Shorts” / “For You” / “Reels” / “Clips” 入口。在 YouTube 上，这一项的行为对齐 YouTube block group 的 `videoMode: short, authorMode: none`：侧栏 `Shorts` 按钮（普通侧栏、迷你侧栏、移动版底部导航、频道页 tab）**以及**首页/订阅/搜索结果里的 Shorts 横向货架都会被隐藏。其他平台则会隐藏导航锚点及其所属的导航行容器。
- `hideHomePage()` / `showHomePage()` — 当用户处于平台主页（`/`、`/feed/...`、`/foryou` 等）时，`hideHomePage()` 会退出页面。`showHomePage()` 用于让上层分组覆盖此意图。
- `hideShorts(predicate, opts?)` / `showShorts()` — 在信息流中隐藏单个短视频。每次调用会**追加**一个谓词；卡片只要被任一活动谓词判为 `true` 即被隐藏。`showShorts()` 会清除来自下方分组所注册的所有 hide 谓词。
  - `opts.blockPageOnVisit: true` — 当用户直接打开 Shorts URL 时，也对当前页面执行该谓词；返回 `true` 则退出页面。
- `hideVideos(predicate, opts?)` / `showVideos()` — 同上，作用于长视频。
- `hidePosts(predicate, opts?)` / `showPosts()` — 同上，作用于社区帖子（YouTube / Facebook / Instagram）。
- `setShortsTimer({ id, direction, currentMs, displayName? })` — 子区域计时器的便捷写法。等价于 `helpers.getTimerHelper().getOrCreateTimer({ ..., scope: u => helpers.getDomainUtility().youtube().isShortUrl(u) })`。把 `youtube.com/shorts/*` 当作独立网站对待。内部使用 `getOrCreateTimer`，所以即便每次心跳都调用也是安全的——计时器会持续推进，`currentMs` 不会被清零。
- `setVideosTimer({ ... })` — 同上，作用于长视频。
- `setPostsTimer({ ... })` — 同上，作用于帖子。

show/hide 语义（因为规则按从下到上执行）：对 `hideShortButton`/`showShortButton` 和 `hideHomePage`/`showHomePage`，顶部分组的调用最终生效。对基于谓词的 hide，所有仍然有效的 `hideShorts` 谓词被 OR 起来；上层分组调用 `showShorts()` 会清除此前累积的所有 `hideShorts` 谓词。

### 11.4 示例

简单：工作日早晨完全隐藏 YouTube Shorts 导航按钮。

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);
  if (isWeekday && hour >= 9 && hour < 12) {
    helpers.getPlatformHelper().youtube().hideShortButton();
  }
  return false;
}
```

中等：YouTube Shorts 每日 30 分钟额度，仅在用户实际处于 Shorts 页面时显示倒计时。

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  const yt = helpers.getPlatformHelper().youtube();

  const id = yt.setShortsTimer({
    id: "yt-shorts-budget",
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts"
  });

  // 每个本地新一天开始时重置额度。
  const persistence = helpers.getPersistenceHelper();
  const today = `${month}-${dayOfMonth}`;
  if (persistence.get("lastDay") !== today) {
    helpers.getTimerHelper().setCurrentMs(id, 30 * 60 * 1000);
    persistence.set("lastDay", today);
  }

  return helpers.getTimerHelper().isExpired(id);
}
```

更难：隐藏作者句柄长度超过 16 字的 YouTube Shorts，用户直接打开此类 Shorts 时也退出页面。

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  var maxAuthorLength = 16;
  helpers.getPlatformHelper().youtube().hideShorts(
    (item) => item.author && item.author.length > maxAuthorLength,
    { blockPageOnVisit: true }
  );
  return false;
}
```

闭包变量 `maxAuthorLength` 被谓词捕获——这正是规则运行在页面上下文中的好处。

最难：按天轮换“今日平台”并设置各平台日额度，同时通过一个正向计时器记录本会话社交媒体总用时。

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  const platforms = ["youtube", "tiktok", "instagram"];
  const today = `${month}-${dayOfMonth}`;
  const persistence = helpers.getPersistenceHelper();
  const timer = helpers.getTimerHelper();
  const domain = helpers.getDomainUtility();

  if (persistence.get("lastDay") !== today) {
    for (const t of timer.list()) timer.delete(t.id);
    persistence.set("lastDay", today);
  }

  const platformOfTheDay = platforms[(month + dayOfMonth) % platforms.length];

  const sessionTotal = timer.getOrCreateTimer({
    id: "social-total",
    direction: "forward",
    currentMs: 0,
    displayName: "Social total",
    scope: (u) => platforms.includes(domain.getPlatform(u))
  });

  const cap = timer.getOrCreateTimer({
    id: "platform-of-the-day",
    direction: "backward",
    currentMs: 20 * 60 * 1000,
    displayName: `${platformOfTheDay} budget`,
    scope: (u) => domain.getPlatform(u) === platformOfTheDay
  });

  return timer.isExpired(cap);
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
- **Snooze** — 需书面理由的临时停用。
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
