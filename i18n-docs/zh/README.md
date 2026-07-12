# 保险库扩展

Vault 扩展是 Chromium 浏览器的 Manifest V3 焦点工具。其当前编辑器管理网站块组、支持的平台组、自定义 JavaScript 组、计划、冻结和暂停控件以及可选的 Web 应用程序桥接链接。

源代码是产品合同。 [manual/en.md](manual/en.md) 中的英文应用内手册解释了附带的控件；它取代了以前的复印和机器翻译的手册。

## 当前能力

- 具有阻止列表或允许列表行为、可选重定向、立即阻止、时间限制或倒计时的默认网站组。
- YouTube、TikTok、Facebook、Instagram、Twitch、Reddit、Discord 和 Twitter / X 的专用群组。
- 当前平台配置文件支持的特定于平台的过滤器和可选的隐藏元素控件。
- 具有语法检查、模板、运行控件、受控运行时和日志源的自定义 JavaScript 组。
- 每组计划、冻结模式、暂停控制、导入/导出和自动保存。
- 支持的自定义规则文本、CSV 和 JSON 操作的可选本地文件夹访问。
- 可选连接到本机 Vault 桥集线器以实现显式链接的组。

## 本地运行

1. 在 Chromium 浏览器中打开 `chrome://extensions`。
2. 启用**开发者模式**。
3. 选择 **加载解压** 并选择此存储库文件夹。
4. 打开 Vault 扩展并创建一个组。

该清单需要 Chrome 116 或更高版本才能使用其当前的屏幕外和规则 API。

## 开发检查

从此文件夹运行扩展测试套件：

```bash
./tests/run.sh
```

该套件练习助手行为、平台配置文件、Markdown 渲染和翻译目录审核。

## 本地化手册和翻译

英文文档仍然是规范来源。该扩展将其本地化手册放在 `manual/en.md` 旁边，其他维护文档的本地化副本位于 `i18n-docs/<locale>/` 下。

`translation/*.json` 中的 UI 目录对于每个受支持的区域设置都是完整的。通过以下方式验证目录和本地化文档：

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## 范围

Vault 扩展仅在安装它的浏览器配置文件中以及浏览器授予其访问权限的页面上起作用。除非用户明确连接桥并链接匹配的组，否则它不会安装本机应用程序、更改系统权限或同步组。
