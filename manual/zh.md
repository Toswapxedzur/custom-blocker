# Vault 扩展功能参考

## 目的和状态

这是 Vault 浏览器扩展的权威功能规范。它记录了产品合同：用户可以配置的数据、配置产生的确切行为、公共自定义规则语言以及适用的限制。

它故意不是一个快速入门指南。网站教程是学习路径。本文档适用于需要配置、测试、维护、审核或重现 Vault 用户可见行为的人员。

当本文档与产品不一致时，代码即为规范事实。本文档中的名称尽可能使用产品的存储/公共词汇。诸如“返回”之类的词是指可用于自定义规则的返回值；如果浏览器或页面拒绝请求的操作，它不承诺浏览器级结果。

## 1. 产品边界

Vault 是一个焦点控制 WebExtension。它的配置单位是**块组**。一个团体可以：

- 决定应屏蔽顶级网站、平台页面、创建者、社区、服务器、频道或帐户；
- 隐藏配置的平台表面或匹配的馈送卡；
- 测量在匹配范围内花费的时间；
- 在该组类型支持的情况下应用时间表、冻结保护或临时暂停；
- 使用事件 API 运行自定义 JavaScript 规则；
- 显示页面计时器、面板、消息或页面日志；
- 重定向、导航、关闭浏览器选项卡或维护仅会话规则创建的站点阻止列表；
- 可选择参与本地连接的 Vault 桥接集群。

Vault 仅在安装它的浏览器配置文件内起作用，并且仅在浏览器允许其内容脚本运行的地方起作用。它不会：

- 安装本机应用程序或浏览器扩展；
- 阻止操作系统应用程序；
- 绕过浏览器权限提示、私密浏览限制或网站自身的安全模型；
- 当第三方平台更改其 DOM 时，保证基于选择器的隐藏；
- 使自定义规则状态可跨配置文件移植，除非用户单独导出/配置它；
- 提供网络防火墙、代理、帐户控制或家长监控服务。

全文使用以下术语：

|术语 |意义|
| --- | --- |
|集团|一个独立命名的配置对象。名称在扩展中必须是唯一的，忽略大小写。 |
|网站群|一个正常组，其域列表是其主要匹配条件。 |
|平台群|专门针对 YouTube、TikTok、Facebook、Instagram、Twitch、Reddit、Discord 或 Twitter/X 的普通群组。 |
|定制组|拥有 JavaScript 规则及其事件注册的组。它的规则决定它的行为。 |
|比赛|页面、提要项目或平台表面满足组的配置条件。 |
|活跃|该组已启用，符合其计划，并且当前未暂停。自定义组不受正常计划 UI 的控制。 |
|块|通常通过重定向到其后备目标来防止当前顶级页面保持可用。 |
|隐藏 |删除或隐藏当前呈现页面中的元素/卡片。隐藏不是网络封锁。 |
|备用网址 |特定于组的重定向目标。如果为空，则使用全局后备。 |
|允许/异常效果|平台卡判决，可从较低优先级的隐藏规则中拯救匹配的内容。它不是一般网站白名单。 |

## 2. 组模型和公共生命周期

每个存储的组都有一个稳定的 ID、名称、类型、启用标志和公共策略字段。默认情况下启用新的正常组。可以选择组、通过编辑器的自动保存行为保存、重新排序、导出、导入、冻结、解冻、延后、禁用或删除。

### 2.1 排序和重叠

多个组可以匹配同一页面。 Vault 从显示列表的末尾到开头评估存储的组。设计重叠规则时，将列表中较低的项目视为较晚/较高优先级的匹配。

对于普通的顶级站点阻止，任何适用的阻止组都可以使页面不可用。对于提要卡过滤，平台级联使用每个匹配组的顺序和效果：稍后匹配的允许/例外可以从较低优先级的阻塞谓词中拯救项目。此异常行为仅限于平台卡过滤表面；它不会撤消正常的整页站点块。

### 2.2 启用状态

禁用组被保留，但不参与正常的匹配、计时器、日程安排或普通的贪睡操作。禁用自定义组也会卸载其活动注册。重新启用不会将未保存的文本转变为活动的自定义规则；运行规则以加载保存的源。

### 2.3 公共字段

|领域|含义和限制|
| --- | --- |
|名称 |此端点内非空、修剪且唯一（不区分大小写）。该桥还按名称和类型识别可链接组，因此稳定的名称很重要。 |
|已启用 |启用或禁用正常匹配。 |
|行为 |即时阻止、限额后阻止或计时器/计数。自定义组使用自己的规则而不是这种正常的行为选择器。 |
|允许的分钟数 |允许后区块行为使用的正数。新组默认为 15 分钟。 |
|重置间隔时间 |定时正常组使用的正数。新组默认为 24​​ 小时。 |
|活跃天数 |周一至周日。当未选择当前本地工作日时，普通组处于非活动状态。 |
|时间窗口|零个或多个本地时间窗口，每行一个，写为 HHMM-HHMM。 |
|冻结模式|无、冻结、严格冻结或家长冻结。 |
|贪睡政策 |群组是否允许小睡，以及正常群组的持续时间/延迟/冷却/确认控制。 |
|备用网址 |当组阻止页面时使用的目标。 |
|跳至下一个 |当在编辑器中提供时，要求正常的阻塞流移过被阻塞的目标而不是停留在其上。 |

### 2.4 正常群体行为

普通编辑器提供三种行为：

|行为 |功能结果|
| --- | --- |
|立即封锁 |一旦该组处于活动状态并匹配，就会立即做出正常的页面块决策。 |
|几分钟后阻止 |匹配的可见页面时间将累积到配置的限额中。当配额用完时，正常组将被阻塞，直到其使用期限被重置或该组处于非活动/暂停状态。 |
|计时器（向上计数，无阻塞）|匹配的可见页面时间被记录并可以显示。此模式绝不会仅仅因为其计时器达到某个值而阻塞。 |

定时使用基于可见页面时间。当页面隐藏在后台选项卡中时，它不会收取时间费用。重置间隔是正常定时组的滚动策略间隔。普通定时器按组独立。

### 2.5 时间表

时间表适用于普通团体。自定义组没有正常的计划 UI，并且就其 JavaScript 而言被视为活动的；该规则本身必须施加任何所需的时间条件。

活动日策略使用当地时间进行评估：

1. 如果不选择当前工作日，则正常组不活动。
2. 如果未提供有效的时间窗口，则活动日表示全天。
3. 如果提供了有效窗口，则当前本地时间必须至少位于一个窗口中。

每个窗口都具有精确的形式 HHMM-HHMM，例如 0900-1200。小时必须为 00 到 23，分钟为 00 到 59，并且开始时间必须在当天结束时间之前。窗口包括其开始并排除其结束。跨午夜窗口（例如 2300-0100）无效。空行将被忽略，重复的窗口将被折叠。

### 2.6 贪睡

对于正常群体来说，贪睡是一种暂时不活动的状态，最多可分为三个阶段：

|相|结果 |
| --- | --- |
|待定 |请求的暂停已存在，但由于其激活延迟而尚未开始。该小组仍然活跃。 |
|活跃|该组在小睡时间内暂时不活动。 |
|冷却时间|暂停已结束，该组再次激活，并且在冷却时间到期之前无法开始另一次暂停。 |

普通组配置字段为：

|领域|规则|
| --- | --- |
|允许小睡 |如果关闭，则无法启动正常小睡。 |
|贪睡持续时间 |积极的分钟。新的正常组采用全局默认值，最初为 30。
|激活延迟|零分钟或更多分钟。空白表示零。 |
|冷却时间|零到五分钟。空白表示零。 |
|确认|非负整数。该产品在批准请求之前需要进行多次确认交互。 |

自定义组仅将贪睡按钮视为输入事件。 Vault 为该组发出名为 snoozePress 的自定义事件；它不代表规则应用正常的持续时间/延迟/冷却回退。自定义规则可以使用事件、其自身的持久性、面板、计时器或根本不执行任何操作。

### 2.7 冻结

冻结可保护组免受普通配置更改和正常延后更改的影响。在选择器中选择冻结模式不会自行冻结组；冻结操作应用所选模式。

|模式|功能合同|
| --- | --- |
|冷冻|该组将被锁定，直到产品的正常解冻确认流程完成。 |
|严格冷冻|在严格冻结期限结束之前，无法解冻该组。持续时间必须大于零且不超过 72 小时；新组默认为 24​​ 小时。 |
|父母冷冻|冻结/解冻管理需要监护人密码。配置对话框使用六位数字的密码。 |

冻结组无法通过普通字段进行编辑。具有脱机成员的桥接集群也可能会锁定冻结控件，因为 Vault 无法安全地跨集群协调冻结状态。冻结是针对正常 UI 操作的保护；它不会将浏览器配置文件转变为不可变的安全边界。

### 2.8 导入、导出、清除和重置

导出会生成所选组的兼容表示。导入会在添加兼容组数据之前对其进行验证和标准化。导入的组名称仍然必须是唯一的。删除组会删除该组及其正常使用/暂停状态。确认后清除会删除所有组。

重置为默认值是**全局设置**操作。它放弃扩展范围的偏好；它不是进出口替代品，应被视为具有破坏性。

## 3. 团体类型及配套合约

### 3.1 默认网站组

站点组拥有一个以行分隔的网站列表。条目被标准化为主机/域形式。主机条目与该主机及其所有子域相匹配。

|设置|结果 |
| --- | --- |
|阻止除这些网站之外的所有内容 |该列表是阻止列表。匹配的主机被阻止。 |
|阻止除这些网站之外的所有内容 |该列表是允许列表。不在列表中的每个主机都被阻止。因此，空的允许列表是有意的全网络锁定。 |
|区块首页 |将组的策略应用到可使用该控件的已配置浏览器启动/主界面。 |
|备用网址 |块的重定向目的地。空白组值会回退到全局默认值。 |

正常的站点组域列表是编辑器公开的唯一声明性整个站点列表。平台组与其自己的平台和配置的平台条件相匹配。

### 3.2 视频平台群组

YouTube、TikTok、Facebook、Instagram 和 Twitch 都是视频平台集团。每个都仅限于其自己的平台主机。组可以针对内容形式、作者/帐户范围、平台的主页提要和可选的隐藏元素控件。

一般的作者模式有：

|模式|结果 |
| --- | --- |
|全部 |不受作者限制；其他配置的轴决定匹配。 |
|包括|仅匹配列出的标准化创建者/帐户。 |
|排除|匹配除列出的条目之外的所有检测到的创建者/帐户。 |
|没有人|不匹配任何作者。这是故意不匹配的作者轴。 |
|标签包括 |当 Vault 可以对创建者进行分类时，将其与任何列出的标签相匹配。未知/未分类的创建者无法打开。 |
|标签排除 |当 Vault 可以对没有配置标签的创建者进行分类时，匹配他们。未知/未分类的创建者无法打开。 |

内容形式选择是特定于平台的：

|平台|内容形式|
| --- | --- |
| YouTube |所有页面、短片、长视频、帖子。 |
|抖音 |所有页面，短视频。 |
|脸书 |所有页面、卷轴、视频、帖子。 |
| Instagram |所有页面、卷轴、视频、帖子。 |
|抽搐|所有页面、剪辑、流/VOD、频道页面。 |

Vault 规范了作者的输入。编辑器接受平台的普通句柄/频道/页面形式和支持的个人资料 URL。它可能会拒绝格式错误的条目或将它们显示为无效，而不是默默地将它们变成不同的目标。

表面隐藏选择与顶级阻止无关。它们仅影响当前平台 UI，并且当平台更改其标记时可以停止工作。

|平台|已提供隐藏元素选择 |
| --- | --- |
| YouTube | Shorts 导航/书架/卡片、家庭推送促销/广告界面和评论。与广告相关的选项会发出警告，因为隐藏广告可能与平台条款冲突。 |
|抖音 |探索导航。 |
|脸书 |卷轴导航和卷轴表面。 |
| Instagram |卷轴和探索导航/表面。 |
|抽搐|浏览导航。 |

YouTube 创作者标签匹配使用本地/可用频道分类。丢失的分类不会仅仅因为选择了标签模式而成为块。

### 3.3 红迪

Reddit 群组仅适用于 Reddit。它的实体是一个 subreddit。 Subreddit 输入接受普通社区形式并在匹配之前对其进行规范化。

Reddit 子版块模式为：

|模式|结果 |
| --- | --- |
|全部 |应用于 Reddit，不受 subreddit 列表限制。 |
|包括|适用于列出的子版块。 |
|排除|适用于除列出的子版块之外的所有版块。 |
|没有人|不应用于 Reddit 子版块。 |

附带的表面隐藏选项隐藏“热门”/“全部”导航。 Feed-card 行为取决于 Reddit 当前可检测到的卡片结构。

### 3.4 不和谐

Discord 群组仅适用于 Discord/Discordapp 页面。它的目标是服务器 ID 或服务器/通道对。目标编辑器接受标准化的 Discord 通道路径值。

|模式|结果 |
| --- | --- |
|全部 |适用于 Discord，没有目标列表限制。 |
|包括|仅适用于列出的服务器或服务器/通道目标。 |
|排除|适用于除列出的目标之外的所有目标。 |
|没有人|适用于无目标。 |

Discord 目前在正常平台配置文件中没有提供隐藏元素选择。

### 3.5 推特/X

Twitter/X 群组适用于 X/Twitter。它可以适用于所有帐户或使用为视频平台描述的通用帐户模式，并具有标准化的句柄/个人资料链接输入。

附带的隐藏元素选项包括探索、消息、Grok、趋势和升级的提要项目。与所有基于选择器的表面控件一样，X 标记更改可能会影响其操作。

### 3.6 自定义组声明字段

自定义组主要运行其 JavaScript 源。它不使用正常行为选择器或正常计划 UI。然而，当通过兼容数据导入或配置时，它可以携带域列表：

- 非空的自定义黑名单可以参与普通的整页站点决策；
- 自定义白名单即使为空也可以参与，从而产生全网声明性锁定；
- 未配置的自定义组不会仅仅因为它有规则而意外阻止页面；
- 自定义定时器永远不会自己阻塞；规则明确决定计时器到期时是否阻塞。

## 4. 全局设置

全局设置适用于分机而不是一组。

|设置|默认 |行为 |
| --- | --- | --- |
|报价变动率 | 1000 毫秒 |共享自定义tickEvent 的频率。有效范围为 250 到 60,000 毫秒。较低的值可以使事件驱动的规则响应更快，但会使用更多的 CPU。 |
|自动保存去抖动 | 400 毫秒 |最后一次编辑器更改之后、正常设置持续之前的延迟。最大值为 5,000 毫秒。 |
|调试模式|关闭 |启用详细的自定义规则跟踪输出和页面调试日志覆盖。它不控制规则的普通日志调用是否到达弹出日志。 |
|在网页上显示自定义规则日志 |上 |控制普通页面日志 toast。规则作者仍然可以显式请求仅屏幕或仅弹出窗口的输出。 |
|默认贪睡持续时间 | 30 分钟 |创建新的正常组时使用的种子。现有组保留自己的持续时间。 |
|默认后备 URL |关于：空白 |当阻止组没有特定于组的后备 URL 时使用。 |
|帮助对创作者进行分类 |关闭 |明确选择加入。它仅将遇到的 YouTube 频道 ID 发送到配置的分类服务；它不发送标题或观看历史记录。 |
|本地文件夹 |无 |自定义规则的可选文件夹功能。参见第 9 节。

### 4.1 编辑器界面和反馈界面

扩展编辑器有一个持久组列表和一个选定组编辑器。组列表提供组类型选择器、添加、清除、选择、启用切换和拖动排序。它的分隔线是可调整大小的。所选组编辑器提供特定于组的字段和组导出/导入操作。

编辑器会在全局去抖期后自动保存普通字段更改。验证错误将报告为状态/Toast 反馈；无效的正常值不会默默地转换为不相关的设置。冻结组会禁用其普通编辑控件。

该扩展程序还具有这些用户可见的反馈界面：

|表面|功能目的|
| --- | --- |
|使用说明书|在扩展中打开此参考。 |
|语言选择器 |选择扩展界面语言。 |
|设置 |打开上述全局设置。 |
|状态/吐司反馈 |报告保存、导入、验证和操作结果。 |
|页内计时器叠加 |显示其显示范围内的活动正常计时器/倒计时项目和自定义计时器。多个项目可以共存。 |
|页面日志表面|在全局设置允许的情况下接收自定义日志、警告和错误调用。 |
|自定义日志 |规则创建的弹出可见条目的实时活动日志。可以清除并下载。 |

对于自定义组，规则字段存储源文本。 Run 首先执行规则语法预检，并且仅在成功时加载源。当文本更改时，编辑器还会执行本地源代码检查。可见的 **Let AI Code** 控件会打开一个提示字段，并复制一个代码生成包，其中包含用户的请求、当前规则以及对当前自定义规则 API 的生成引用。它不会联系人工智能服务或自动更改规则。

模板控件打开模板浏览器。模板在交付时具有标题、描述、标签、参数和生成的预览。确认后应用它会替换当前的规则文本。当前发货的模板目录为空；浏览器仍可用于将来的策划模板，并且不得将其视为活动规则的来源。

## 5. 自定义规则语言

### 5.1 规则源形式

自定义组的源是 JavaScript。在 **运行** 时，Vault 会删除由先前活动源创建的组的先前注册和状态，然后加载新源。

来源可能是：

1. a function expression accepting events and helpers; or
2. 使用提供的事件（或遗留事件）和辅助变量的裸语句。

```js
// Function-expression form
(events, helpers) => {
  events.on("openWebEvent", "welcome", (event, h) => {
    h.log("Opened", event.url);
  });
}
```

```js
// Bare-statement form
events.on("openWebEvent", "welcome", (event, h) => {
  h.log("Opened", event.url);
});
```

Run 执行 JavaScript 语法/预检检查，并且仅当成功时，才会使当前源处于活动状态。保存文本和运行文本有意不同：可以保存规则而不成为活动事件源。

当自定义组重新运行、禁用、删除或显式停止时，活动源将被卸载。重新运行会在注册开始之前清除规则的处理程序、计时器、面板、持久性存储桶和规则创建的平台谓词。沙盒恢复可以重新加载活动源；因此，规则作者必须使注册具有幂等性。

### 5.2 执行模型和安全假设

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

每个处理程序接收：

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

事件处理程序按数字优先级降序运行；同等优先级使用注册顺序。可以通过再次注册相同的事件类型和 ID 来替换处理程序。一个自定义组最多可以有 1,000 个注册处理程序。

Vault 将一名处理程序的活动工作限制为大约一秒。同一组在一分钟内超过三次截止日期会隔离该规则：Vault 会禁用它，而不是重复运行有问题的处理程序。不要使用繁忙的等待、无限循环、同步轮询或每个事件的大量突变/日志。

每次发送，Vault 最多接受：

|项目 |最大|
| --- | --- |
|规则日志条目 | 200 | 200
|发布活动 | 64 | 64
| DOM 操作 | 256 | 256
|行动/意图| 256 | 256
|每组面板| 24 |
|一个面板中的控件 | 32 | 32
|选择/单选控制中的选项 | 64 | 64

多余的日志、发布事件、DOM 操作和意图条目可能会被删除。自定义规则不得依赖于交付的多余条目。

### 5.3 内置事件类型

以下事件类型字符串是内置的。规则也可以使用自己的非空类型字符串，只要它不以下划线开头。

|活动类型|何时发送 |重要数据|
| --- | --- | --- |
|勾选事件 |以全局滴答率设置共享周期性滴答。 |当前页面/选项卡上下文（如果可用）。使用intervalMs注册选项来限制单个处理程序的速率。 |
|开放网络事件 |顶级页面可供该规则使用。 | URL、主机名、选项卡/页面 ID、时间。 |
|关闭网络事件 |顶级页面/选项卡关闭。 | URL/主机名上下文（如果可用）。 |
|网络更改事件 |承诺的顶级导航，包括相同 URL 重新加载。 |数据携带先前的 URL/主机名和导航标志，例如 isFirstLoad、isReload 和 SameDomain。 |
|计时器已结束 |自定义计时器更改为过期状态。 |数据：timerId、displayName、方向、currentMs。它仅传递给计时器所属组。 |
|打盹按 |用户为此自定义组按下“开始暂停”。 |规则拥有响应；不执行正常的小睡回退。 |
|面板事件 |渲染的自定义面板具有交互。 |数据和便利字段包括面板/控制/事件/值信息。 |
|本地文件事件 |请求的本地文件操作完成。 |数据和便利字段包括 requestId、路径、结果、字节、条目和错误。 |
|页面心跳事件 |当选项卡可见时，大约每 250 毫秒一次可见页面心跳。 | elapsedMs 是可见页面经过的时间。即使没有注册处理程序，作用域自定义计时器也会自动使用它。 |

### 5.4 事件注册API

函数式源的第一个参数是事件注册表。在裸语句源中，事件和事件都引用此注册表。

|方法|合同|
| --- | --- |
| events.on(type, id, handler, options) | Register a handler. Returns true when accepted, false for invalid/capped registrations. |
| events.register(type, id, handler, options) | Alias of on. |
| events.off(type, id) | Unregister a handler. Returns whether something was removed. |
| events.unregister(type, id) | Alias of off. |
| events.unregisterAll(type) | Remove all handlers owned by this group for that event type. Returns the number removed. |
| events.getEvent(type, id) | Return the registered function for this group/id, or null. |
| events.getEvents(type) | Return an object mapping this group's handler ids to functions. |
| events.countRegistered(type) | Return this group's number of registrations for type. |
| events.emit(type, data, options) | Queue a synthetic event. |
| events.post(type, data, options) | Alias of emit. |

可选的处理程序选项对象支持：

|选项 |意义|
| --- | --- |
|优先|数字顺序。较高的值先于较低的值运行。默认 0。
|间隔Ms |正数。仅对于tickEvent，抑制调用，直到自处理程序上次调用以来已经过去了这么多时间。 |

综合事件默认为组范围：只有属于发出组的处理程序才会接收它们。使用 {scope: "global" } 将事件发送到注册相同类型的每个规则。不要在事件名称中使用前导下划线；它是保留的。

### 5.5 事件对象

每个处理程序都会接收一个具有公共字段的可变事件对象：

|领域/方法 |合同|
| --- | --- |
|类型 |事件类型字符串。 |
|组ID |收件人自定义组 ID。 |
|选项卡 ID、页面 ID |浏览器标识符（如果可用）；否则为空。 |
|网址、主机名 |当前顶级 URL 和主机名，或空字符串。 |
|时间 |调度时间对象的副本，或 null。 |
|数据|特定于事件的有效负载，或 null。 |
|预防默认（）|将调度标记为页面块操作。如果存在，页面将重定向到当前重定向链接/结果；否则 Vault 使用正常的退出/后备路径。 |
|停止传播（）|停止当前事件调度的后续处理程序。 |
|设置结果（值）|存储数字或字符串结果。非空字符串被视为重定向目标；结果 1 抑制否则累积的 PreventDefault 结果。 |
|获取结果() |返回此事件对象设置的结果，或者为 null。 |
|发布（类型，数据，选项）|将合成事件放入队列，其范围规则与 Events.post 相同。 |
|设置重定向链接(url) |设置此调度的重定向 URL。仅对于非字符串输入返回 false。 |
|获取重定向链接（）|读取此调度的重定向 URL 或空字符串。 |
|关闭（id）|请求关闭选项卡。数字是选项卡 ID，字符串标识 URL，省略的值指向活动选项卡。 |
|块（id）|添加仅限会话的动态站点阻止模式。如果没有字符串 ID，请使用事件主机名。 |
|解锁（id）|删除仅限会话的动态站点阻止模式。如果没有字符串 ID，请使用事件主机名。 |
|打开（）|浏览器扩展中无操作。它无法启动应用程序。 |

处理程序可以将任意额外属性附加到事件。当事件对象处于活动状态时，通过 event.custom 或直接通过分配的名称读取它们。它们不是持久状态，也不是跨事件存储。

对于 panelEvent，添加了以下便利字段：panelId、controlId、eventName、value、values、key、code 和 keyInfo。

对于 localFileEvent，添加了以下便利字段：eventName、action、path、directoryPath、requestId、ok、text、value、entries、exists、bytes 和 error。

### 5.6 助手入口点

辅助对象具有以下直接属性：

|切入点|意义|
| --- | --- |
| helpers.now | Current dispatch timestamp in milliseconds. |
| helpers.currentUrl | Current unmodified URL string for this dispatch. |
| helpers.groupId | Owning Custom-group id. |
| helpers.log / warn / error | Direct aliases for the log helper. |
| helpers.logScreen / warnScreen / errorScreen | Direct aliases for screen-only logs. |
| helpers.logPopup / warnPopup / errorPopup | Direct aliases for popup-only logs. |
| helpers.getLogHelper() | Returns the log helper. |
| helpers.getDomainHelper(), getDomainUtility() | Return the domain helper. |
| helpers.getTimerHelper() | Returns the timer helper. |
| helpers.getPanelHelper() | Returns the panel helper. |
| helpers.getPersistenceHelper() | Returns the persistence helper. |
| helpers.getRedirectionHelper() | Returns the redirect helper. |
| helpers.getDOMHelper() | Returns the DOM helper. |
| helpers.getNavigationHelper() | Returns the navigation helper. |
| helpers.getStorageHelper() | Returns the persistence plus asynchronous storage helper. |
| helpers.getLocalFolderHelper() | Returns the optional local-folder helper. |
| helpers.getTabHelper() | Returns the tab-snapshot helper. |
| helpers.getWindowHelper() | Returns the browser-tab/window helper. |
| helpers.getPlatformHelper() | Returns the platform-helper collection. |
| helpers.platform() | Returns the platform-helper collection. |
| helpers.platform(name) | Returns the named raw platform API. Valid names: youtube, tiktok, facebook, instagram, twitch. |

## 6. 自定义助手参考

### 6.1 域助手

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

|方法|退货及行为|
| --- | --- |
|主机名(url) |没有前导 www. 的标准化小写主机，或者 null 表示无效 URL。 |
|路径名(url) | URL 路径名，或 /（当 URL 无法解析时）。 |
|匹配（主机名，站点）|当主机名等于站点或其子域时为真。 |
|获取平台（网址）| youtube、tiktok、instagram、facebook、twitch 或 null。 |
| isYouTubeHost(主机)、isTikTokHost(主机)、isInstagramHost(主机)、isFacebookHost(主机)、isTwitchHost(主机)、isRedditHost(主机)、isDiscordHost(主机) |主机分类器。 |
| youtube()、tiktok()、instagram()、facebook()、twitch() |返回该平台的 URL 分类器对象。 |
| isEmptyStartPage(url) | isEmptyStartPage(url) | isEmptyStartPage(url) |对于浏览器支持的空白/新选项卡/起始页 URL 为 true。 |
| matchesAny(url, 模式) |将 URL 与一个 RegExp、RegExp 数组或编译为正则表达式的字符串进行匹配。无效的字符串模式将被忽略。 |
| pathStartsWith(url, 路径) |对于精确路径或路径的后代，为真。提供了缺少的前导斜杠。 |
| queryHas(url, 键, 值) |如果查询键存在则为 True；当提供值时，它也必须等于字符串值。 |
|查询获取（网址，键）|查询值或 null。 |
| isSearchPage(url) | isSearchPage(url) |检测支持的 Google、Bing、DuckDuckGo、YouTube、Reddit 和 X/Twitter 搜索 URL。 |
| isInfiniteFeedUrl(url) | isInfiniteFeedUrl(url) |检测支持的无限进给表面。 |
|相同部分（a，b）|仅当两个 URL 共享主机和第一个路径名段时才为 true。 |

每个平台 URL 分类器对象都公开 isPlatformUrl(url)、isShortUrl(url)、isVideoUrl(url)、isPostUrl(url)、isHomePage(url)、extractAuthor(url) 和 extractVideoId(url)。当 URL 有效但无法识别此类内容时，方法可以返回 false/null。

### 6.2 定时器助手

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

创建/获取选项：

|选项 |意义|
| --- | --- |
|编号 |必需的非空计时器 ID。 |
|显示名称 |人类可读的覆盖标签。 |
|方向 |向前计数；任何其他值都会向后/倒计时。 |
|当前女士 |初始毫秒，下限为零，如果存在界限则有界。 |
|最小Ms、最大Ms |可选的正最小/最大界限。 |
|步女士 |用于已过刻度的可选正量化步骤。 |
|覆盖样式 |颜色、背景、字体大小、字体粗细、边框、边框半径、填充、不透明度和图标的可选字符串。不支持/无效的部分将被丢弃。 |
|范围（网址）|决定可见页面时间在何处累积的谓词。 |
|域名（网址）|决定计时器在叠加层中出现的位置的谓词；默认为范围。 |
|累积时间(url) |可选的额外谓词。仅当 range 和 accrueWhen 都为 true 时，时间才会累积。 |

|方法|行为 |
| --- | --- |
|创建（选项）|创建/替换计时器并重置其状态。返回 id 或 null。 |
| getOrCreateTimer（选项）|仅在不存在时创建。现有状态保持不变。返回 id 或 null。 |
|删除（id）|删除计时器及其范围/显示谓词。 |
|暂停（id），恢复（id）|更改暂停状态。仅当可能发生状态更改时才返回 true。 |
| setDirection(id, 方向) |向前或向后设置。 |
| setCurrentMs(id, 毫秒) |设置绝对计数，强制限制。 |
| addMs(id, deltaMs), subMs(id, deltaMs) |调整计数，加强界限。 |
| setBounds(id, minMs, maxMs) | setBounds(id, minMs, maxMs) |设置正界限；为绑定传递 null 以将其删除。 |
| setStep(id, 步骤Ms) |设置正刻度量化。传递 null 或零来清除它。 |
| setOverlayStyle(id, 样式) |替换/清除允许的叠加样式。 |
| setDisplayName(id, 名称) |设置叠加标签。 |
| getCurrentMs(id) | 获取当前Ms(id)数字，缺席计时器为零。 |
|已过期（id）|仅当计时器存在且 currentMs 为零时才为 True。 |
|已暂停（id）|布尔值。 |
| getDirection(id)、getDisplayName(id) |方向/名称或空。 |
|存在（id）|布尔值。 |
|获取状态（id）|可串行化的计时器快照或 null。 |
|列表（）|可串行化的定时器快照数组。 |

当自定义源保持加载状态时，范围谓词会被记住。 Vault 在可见的 pageHeartbeatEvent 周期期间推进匹配计时器，每次调度每个计时器一个刻度。向后计时器在零处停止并在过渡到零时发出timerEnded。它保持为零，直到规则更改/重置它。使用定时器结束的处理程序来决定过期的定时器是否应该调用 PreventDefault、设置重定向或执行其他操作。

### 6.3 持久化和异步存储

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

|方法|行为 |
| --- | --- |
|获取（键，默认值）|读取克隆值或默认值。 |
|设置（键，值）|存储 JSON 安全的克隆。对于无效键/值或键帽耗尽，返回 false。 |
|删除（键）|删除现有密钥；返回是否存在。 |
|有（键）|布尔值。 |
|键() |键数组。 |
|条目() |克隆的[键，值]对数组。 |
|清除（）|删除该组的所有规则持久性。 |
|大小（）|钥匙数量。 |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

|方法|行为 |
| --- | --- |
| requestAsyncGet(键) |请求异步存储读取。排队时返回 true。使用稍后的事件/您自己的状态流来响应；它不是同步吸气剂。 |
| requestAsyncSet(键, 值) |请求异步 JSON 安全存储。排队时返回 true。 |

规则持久性在运行时被清除，因为新的活动源以干净的自定义规则状态开始。

### 6.4 日志记录助手

Get it with helpers.getLogHelper(). Every method accepts any number of values.

|方法|目的地 |
| --- | --- |
|日志、警告、错误 |弹出活动日志；启用全局页面日志 toast 时的页面 toast。 |
|日志屏幕、警告屏幕、错误屏幕 |仅页面 toast/调试界面；从弹出日志中排除。 |
|日志弹出、警告弹出、错误弹出 |仅弹出活动日志；从页面 toast 中排除。 |

日志还尝试使用 CustomBlocker 组前缀到达浏览器控制台。这是诊断输出，而不是持久性 API。使用状态持久化助手。

### 6.5 重定向助手

Get it with helpers.getRedirectionHelper().

|方法|行为 |
| --- | --- |
| get()、getRedirectLink() |返回当前调度重定向 URL 或空字符串。 |
|设置（url），setRedirectLink（url）|设置当前调度的重定向 URL。 |
|创建消息 URL（消息）|创建显示所提供消息的扩展本地消息页面 URL。 |

单独设置重定向不会强制导航。根据所需的规则流，将其与 event.preventDefault() 配对，或通过 event.setResult() 设置非空字符串。

### 6.6 DOM 助手

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

|方法|要求采取的行动 |
| --- | --- |
|隐藏（选择器），显示（选择器） |隐藏/显示匹配元素。 |
| addClass（选择器，类名），removeClass（选择器，类名）|改变 CSS 类。 |
| setText(选择器, 文本) |替换文字内容。 |
|单击（选择器）|单击匹配的元素。 |
|注入 CSS(css, id) |添加已识别的 CSS 块。 |
|删除InjectedCSS(id) |删除先前识别的注入 CSS 块。 |
|滚动到（选择器）|将匹配的元素滚动到视图中。 |

DOM 操作不提供不受限制的页面脚本。它们是有界的操作面，并且在从心跳/刻度处理程序中使用时应该是幂等的。

### 6.7 导航、选项卡和浏览器窗口帮助程序

Get navigation with helpers.getNavigationHelper().

|方法|要求采取的行动 |
| --- | --- |
|返回() |返回当前选项卡。 |
|前进（）|向前导航当前选项卡。 |
|重新加载（）|重新加载当前选项卡。 |
|转到（网址）|将当前选项卡导航到 URL。 |
|关闭选项卡（）|关闭当前选项卡。 |

Get a snapshot helper with helpers.getTabHelper().

|方法|返回/行动|
| --- | --- |
|列表（）|当前选项卡快照的副本。 |
|获取活动选项卡（）|活动选项卡快照或为空。 |
| getById(id) | getById(id) |匹配选项卡快照或为空。 |
|计数打开() |快照中的选项卡数量。 |
|请求刷新() |请求新的选项卡快照以供以后的规则工作使用。 |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

|方法|行为 |
| --- | --- |
|当前（）|当前活动选项卡对象：id、url、主机名、标题、isBrowser。 |
|全部（）|包含 id、url、主机名、标题、活动的选项卡对象数组。 |
|关闭（idOrUrl）|通过数字选项卡 ID、确切的 URL 字符串或省略时的活动选项卡关闭。 |
|关闭选项卡（）|关闭活动选项卡。 |
|块（图案）|添加标准化的仅会话域块并应用它。 |
|解锁（模式）|删除标准化的仅会话域块。 |
| isBlocked(urlOrHostname) | isBlocked(urlOrHostname) | isBlocked(urlOrHostname) |查询规则创建的会话阻止列表。 |
| getBlocked() | getBlocked() |列出当前会话创建的模式。 |

规则创建的块模式将 http/https 规范化，将 www. 和路径引导到主机模式中。它们与确切的主机和子域匹配。该动态阻止列表是会话内存，而不是保存的普通站点组。

### 6.8 本地文件夹助手

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

|方法|行为 |
| --- | --- |
|可用（）|报告API表面存在；它不能证明文件夹当前已被授权。 |
|请求读取（路径）|请求阅读文本。 |
| requestWrite（路径，文本）|请求文本写入。 |
| requestAppend(路径, 文本) |请求附加文本。 |
|请求列表（路径=“”）|请求目录列表。 |
|请求存在（路径）|请求存在性测试。 |
| requestReadJson(路径) |请求读取JSON；路径必须以 .json 结尾。 |
| requestWriteJson（路径，值）|请求 JSON 写入；路径必须以 .json 结尾，并且值必须是 JSON 安全的。 |

路径始终相对于选定的根。它们不能是绝对的、驱动器限定的、点前缀的或包含 .或..段。文件操作仅接受 .txt、.csv 和 .json 文件。可以随时撤销文件夹选择；失败的请求会在 localFileEvent 中报告 ok false 和错误字符串。

### 6.9 平台助手

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

所有原始平台 API 均公开：

|方法|行为 |
| --- | --- |
|隐藏（谓词，选项）|为该平台上的每个提要卡插槽设置相同的每项谓词。 |
|隐藏（槽、谓词、选项）|为每一项设置一个谓词。谓词接收该平台提供的平台项目/快照。 |
|允许（谓词，选项），允许（槽，谓词，选项）|与 hide 相同，但创建允许/例外判决。 |
|显示（），显示（插槽）|清除所有或一个已安装的谓词槽。 |
|表面（名称，“隐藏”或“显示”）|隐藏/显示整个平台区域。 home 是主页的公共名称。 |
|计时器（插槽，选项）|配置平台分段定时器。提供时返回 options.id，否则返回 null。 |
|重新扫描() |外部规则状态更改后重新评估已扫描的摘要卡。 |
|快照（）|返回当前平台快照或 null。 |
|插槽（），表面（），timerSlots（）|返回该平台支持的名称。 |
| isPlatformUrl、isShortUrl、isVideoUrl、isPostUrl、isHomePage、extractAuthor、extractVideoId |该平台的 URL 帮助程序。 |

一个槽拥有一个组/平台的一个谓词。稍后对同一插槽的隐藏/允许调用将替换先前的谓词；它不是隐式“或”。可选选项对象识别：

|选项 |效果|
| --- | --- |
|阻止页面访问 |当访问匹配的卡片/页面时，请求页面阻止而不仅仅是隐藏卡片。 |
|效果|阻止（默认）或允许。允许助手设置自动允许。 |

每当谓词取决于首次评估卡后更改的状态（例如面板复选框、配额或时间阈值）时，调用重新扫描。

原始平台支持矩阵：

|平台|谓词槽 |表面名称|定时器槽 |
| --- | --- | --- | --- |
| YouTube |短片、视频、帖子、评论、直播 |主页、shortButton、评论、直播 |短片、视频、帖子 |
|抖音 |视频、评论、直播 |首页、评论、直播 |视频 |
| Instagram |短裤、帖子、评论 |首页，评论|短裤、帖子|
|脸书 |短片、视频、帖子、评论、直播 |首页、评论、直播 |短片、视频、帖子 |
|抽搐|短片、直播、视频、直播 |首页、评论、直播 |短片、直播、视频 |

原始自定义平台帮助程序不会公开 Reddit、Discord 或 Twitter/X。使用通用 URL、DOM、计时器、面板和导航功能在这些网站上进行自定义工作。

## 7. 自定义面板

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### 7.1 面板API

|方法|行为 |
| --- | --- |
|创建（配置）|创建或替换面板。返回标准化面板 ID 或 null。 |
| getOrCreatePanel(配置) |仅在缺席时创建；返回 id 或 null。 |
|更新（id，补丁）|验证后替换指定的面板字段。 |
|删除（id）|删除面板及其注册的内联处理程序。 |
|显示（id），隐藏（id）|改变可见性。 |
| setValue(panelId, controlId, value) | 设置值(panelId, controlId, value) |验证后设置可写控制值。 |
| updateControl(panelId, controlId, 补丁) |替换控件的允许字段。 |
|禁用（panelId，controlId），启用（panelId，controlId）|切换控制可用性。 |
| setOptions(panelId, controlId, 选项) |替换选择/单选选项。 |
| setText(panelId, controlId, 文本) |更新按钮标签、文本/部分文本或其他控件标签。 |
| setTheme(panelId, 主题) |更换面板主题。 |
| setTitle(panelId, 标题), setDescription(panelId, 描述) |更新文字。 |
| getValue(面板 ID, 控制 ID) |返回克隆值或未定义值。 |
|获取值（面板 ID）|返回由控件 id 键控的所有可写值。 |
|获取状态（id）|返回可序列化的面板快照或 null。 |
|列表（）|返回所有面板的可序列化快照。 |
|注意（配置）|创建一个紧凑的右下角状态面板，其中包含可选的消息/文本。 |
|确认（配置）|创建一个居中对话框，其中包含生成的确认和取消按钮。 |
|清单（配置）|创建复选框项目面板。 |
|表单（配置）|从字段创建表单布局面板。 |

### 7.2 面板配置

|领域|接受的价值观/行为 |
| --- | --- |
|编号 |必需的。标准化为字母、数字、下划线、连字符；最多 80 个字符。 |
|标题 |面板标题，最多 240 个字符。 |
|描述或正文 |描述，最多 1,000 个字符。 |
|位置|左上、右上、左下、右下或中心。默认右下角。 |
|对齐|左、中或右。默认左侧。 |
|布局|垂直、紧凑、舒适、宽敞、内联、行、换行、双列、网格、拆分、表单、工具栏或堆栈。默认垂直。 |
|优先|数字显示顺序，限制为 -1000 到 1000。首先显示较高的面板。 |
|宽度|小、中、大或 180 到 520 像素。 |
|文本大小/字体大小 | 10 到 32 px，或 0.65 到 2 rem/em。 |
| ariaLabel/a11yLabel |可访问的标签。 |
|角色 |区域、对话框、警报、状态、表单或组。 |
|自动对焦 |布尔值。 |
|主题/颜色 |背景、前景、重音、边框、静音、字体大小/文本大小、标题大小。 |
|控制|最多包含 32 个控件的数组，部分嵌套最多三层。 |
|可见| False 隐藏面板。 |
|范围（url），域（url）|控制可用性/显示的功能。域优先；没有域，范围控制显示。 |

面板内联处理程序字段可以出现在面板或单个控件上：onEvent、onChange、onClick、onInput、onFocus、onBlur、onSubmit、onClose、onMount、onUnmount、onKey 和 onKeyDown。每个接收正常的（事件、助手）参数。当使用控件定义重新创建/更新该面板时，内联处理程序将被替换。

### 7.3 控制

可用的控件类型有文本、复选框、选择、文本输入、文本区域、按钮、部分、计时器、数字输入、范围、切换、单选、日期、时间、颜色、引脚和 html。别名输入、下拉列表、组、数字、滑块、开关、原始和标记标准化为其相应的类型。

所有控件都接受 id、type、label、value、disabled、priority 以及相关布局、align、ariaLabel/a11yLabel、autoFocus、宽度、高度和行。

|类型 |重要领域和价值契约 |
| --- | --- |
|文字|呈现为非输入文本的文本（或标签）。 |
|复选框、切换 |布尔值。 |
|选择，收音机|选项作为字符串或 { value, label } 对象；最大 64。值是一个短字符串。 |
|文本输入、文本区域 |字符串值，最大2000个字符；可选占位符。 |
|按钮|标签/文字；可选操作提交、取消或关闭。 |
|部分|文本/描述、角色和嵌套控件。 |
|定时器| timerId 或计时器快照；格式为 ms、ss、mm:ss 或 hh:mm:ss； showExpired 默认为 true。 |
|数字输入，范围 |数值固定为提供的最小值/最大值；可选的积极步骤。 |
|日期 |仅 YYYY-MM-DD 值。 |
|时间 |仅 HH:MM 或 HH:MM:SS 值。 |
|颜色 |六位 #RRGGBB 输入值。 |
|针|仅数字，长度 3 到 12，默认屏蔽，可选自动提交。 |
| html |净化后的标记。脚本块、内联事件属性和 javascript: URL 已删除。 |

每个渲染的交互都会生成 panelEvent。事件的值对象包含面板的可写控件，不包括按钮、文本和计时器控件。在处理程序观察事件之前，关闭操作会隐藏面板。

## 8. 自定义规则操作配方

以下示例是公共组合的规范，而不是教程。

### 8.1 重定向打开的页面

```js
(events, helpers) => {
  events.on("openWebEvent", "redirect-distracting-search", (event, h) => {
    const domain = h.getDomainHelper();
    if (!domain.isSearchPage(event.url)) return;
    event.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Return to your planned task."));
    event.preventDefault();
  });
}
```

### 8.2 具有显式块的可见时间倒计时

```js
(events, helpers) => {
  const timer = helpers.getTimerHelper();
  timer.create({
    id: "reading-budget",
    displayName: "Reading budget",
    direction: "backward",
    currentMs: 10 * 60 * 1000,
    scope: (url) => url.includes("example.com")
  });

  events.on("timerEnded", "stop-at-zero", (event) => {
    if (event.data?.timerId !== "reading-budget") return;
    event.setRedirectLink("about:blank");
    event.preventDefault();
  });
}
```

### 8.3 从面板更改 feed 谓词

```js
(events, helpers) => {
  const panel = helpers.getPanelHelper();
  const youtube = helpers.platform("youtube");

  panel.create({
    id: "feed-filter",
    title: "Feed filter",
    controls: [{
      id: "hide-sponsored",
      type: "toggle",
      label: "Hide sponsored items",
      value: true,
      onChange: (event, h) => {
        const api = h.platform("youtube");
        if (event.value) {
          api.hide("videos", (item) => item?.sponsored === true);
        } else {
          api.show("videos");
        }
        api.rescan();
      }
    }]
  });

  youtube.hide("shorts", () => true);
}
```

必须为活动平台表面提供的平台快照/项目值编写谓词。如果平台无法可靠地识别字段，则谓词应该失败打开而不是假设值是 true。

## 9. 本地文件夹请求协议

本地文件夹操作不是立即文件 I/O。完整的功能序列是：

1. 用户在全局设置中选择一个文件夹。
2. 规则对请求进行排队并接收请求 ID。
3. Vault 请求授权文件夹能力来执行该操作。
4. Vault 将 localFileEvent 发送到同一自定义组。
5. 处理程序将 event.requestId 与原始请求 ID 相关联。

成功读取文本文件的文本或 JSON 的值。列表返回条目。存在返回存在。写入/追加提供适用的字节。失败提供 ok false 和 error。规则绝不能假定所选文件夹在重新加载、浏览器重新启动或权限撤销后仍保持授权。

## 10. 自定义规则安全和故障语义

### 10.1 编译运行错误

检查语法报告编译失败。 Run 还可以在注册过程中报告运行时错误。如果类似函数的源存在语法错误，Vault 不会默默地将其视为无害的裸语句。

空源有零个处理程序。它作为非活动自定义规则有效，但不执行已配置的自定义操作。

### 10.2 处理程序错误

来自一个处理程序的异常与整个事件调度是隔离的。是诊断输出；它不会使后来的处理程序神奇地成功。使用窄处理程序并记录可操作的错误。

### 10.3 隔离

在重复超过截止日期或注册过程中超时后，Vault 可以隔离自定义组。隔离会禁用该组并记录其中止原因。更正源，保存它，然后再次显式运行它以恢复活动注册。

### 10.4 浏览器/页面限制

没有自定义规则接收不受限制的扩展 API。特别是：

- DOM 选择器在发生变化的平台上找不到任何内容；
- 导航、选项卡关闭和屏幕操作仍受浏览器功能的限制；
- 扩展无法打开本机应用程序；
- 本地文件夹操作需要用户授予的文件夹和支持的文件类型；
- 事件处理程序不能依赖不可见页面继续产生可见时间心跳；
- 页面可以独立于规则重新加载、导航、丢弃或使内容脚本无效；
- 规则创建的动态站点块是会话状态操作，而不是永久站点组编辑。

## 11. Web 应用程序桥

浏览器扩展会自动连接到 ws://127.0.0.1:8787 上兼容的本地 Vault 中心。用户没有连接开关，并且协议必须兼容。

Vault 会先快速探测，随后在扩展运行期间持续进行较慢的重连。自动传输本身不会合并组；链接和取消链接组仍需明确操作。

### 11.1 连接组

仅当组的名称和类型匹配并且有资格链接时，组才可链接。用户明确选择/链接参与节目。链接的基团形成簇。断开连接使本地组数据保持不变；它停止实时同步。

该桥同步支持的链接组的共享标量策略，包括正常阻止模式、允许/重置值、暂停设置、活动天/窗口、冻结状态/选择/持续时间、主页策略、白名单设置、后备 URL 和跳到下一个策略。它还协调集群成员的使用和休眠状态。

该桥不承诺每个特定于产品的字段、平台选择器、自定义源文本或特定于浏览器的功能都可以转移到不同的程序。即使网桥已连接，组也可以保持本地状态且未链接。

冻结桥集群要求所有相关成员都在线，以进行需要协调突变的冻结状态操作。连接是本地传输，而不是云备份或远程控制通道。

## 12. 维护者验证清单

在审核发布或复制行为时使用此清单：

1. 确认该组具有非空的唯一名称、正确的类型、启用状态和预期列表/顺序。
2. 对于普通组，确认活动工作日、有效的本地时间窗口、无活动休眠以及非冻结编辑状态。
3. 对于站点组，测试确切的主机、子域和（对于白名单）列表之外的主机。
4. 对于平台组，分别测试页面级匹配、目标项目/卡片匹配、作者模式、内容形式模式以及每个启用的表面隐藏。
5. 对于定时正常组，验证可见页面累积、配额到期或累计非阻塞行为以及重置间隔。
6. 对于自定义规则，运行语法检查、运行、检查处理程序计数/日志、测试每个已注册的内置事件，然后测试重新加载/导航。
7. 在范围边界和零处测试每个自定义计时器；验证规则中是否有任何块是明确的。
8. 使用每个控制值、禁用状态、提交/取消/关闭操作和 panelEvent 处理程序测试面板。
9. 在成功之前测试本地文件夹失败：没有选择文件夹、撤销权限、无效路径、不支持的扩展名、然后授权读/写。
10. 在依赖同步或冻结协调之前，请测试自动传输启动、已链接/未链接组以及离线集群成员。

## 13. 版本控制规则

这个英文文件是维护的源手册。本地化手册是其翻译，可能需要在功能文档更新后重新生成。产品来源仍然是实现级别模糊性的典型事实。
