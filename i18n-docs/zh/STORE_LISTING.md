# Chrome 网上应用店列表源

这是当前 Manifest V3 扩展的英文源代码。在发布新的商店版本之前，根据 `manifest.json` 进行验证。

## 扩展名

```text
Adamancia Vault
```

## 简短描述

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## 详细说明

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## 权限说明

|许可|目前的目的|
| --- | --- |
| `storage` |保存组、设置和本地编辑器状态。 |
| `alarms` |安排背景调查和基于时间的小组更新。 |
| `offscreen` |运行受控的自定义规则运行时，其中 Chromium 需要屏幕外文档。 |
| `tabs` |读取应用组和显示状态所需的活动选项卡上下文。 |
| `webNavigation` |导航后重新评估适用的组。 |
| `favicon` |在编辑器中显示可用的网站图标。 |
| `<all_urls>` |将用户创建的网站和平台规则应用于用户选择控制的页面。 |

## 发布检查

1. 运行`./tests/run.sh`。
2. 仅更新发布提交的清单版本。
3.审查英文手册和翻译审核输出。
4. 根据已审核的提交构建上传工件。
5. 不要在上传工件中包含源注释、测试装置或私有开发文件。
