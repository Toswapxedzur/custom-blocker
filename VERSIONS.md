# Vault extension version history

The owner approved this capability split on 2026-10-04. Existing tags and packaged downloads remain unchanged. All new records are **alpha, source-only**. A source record does not certify store submission, signing or native release acceptance.

Current source version: **3.1.4**. See the group-level `CHANGELOG.md` for the cross-product chapters.

## 3.1.4 — 2026-10-07 — Safari folder picker presentation

- Present the user-requested native folder picker in front of Safari, then restore the extension’s background activation policy.
- Retain the existing selected-folder bookmark and bounded file-access contract.

## 3.1.3 — 2026-10-07 — Safari containing-app Quit command

- Supply the native Quit Safari Vault label in all 20 interface languages.
- Safari publication follows its separate native source; Chrome Store remains 3.1.0.

## 3.1.2 — 2026-10-07 — Bilibili creator metadata

- Collect the dedicated creator name from home cards, excluding publication-age text.
- Keep the verified creator identity and fallback for other card/page layouts.

## 3.1.1 — 2026-10-07 — Website recording resume

- Re-enabling website recording starts the already-active tab when the browser is focused.
- A settings refresh or background tab event cannot start recording an unfocused browser window.
- Safari publication is tracked separately; the existing Chrome Store listing remains 3.1.0 until a Store submission is verified.

## 3.1.0 — 2026-10-04 — Budget snooze and shared Settings

Source: `release/v3.1.0`.

- Snooze can add consumable allowance to time-limit groups instead of pausing a block.
- Mac Vault owns Classifier activation; the browser follows native group activation and rescans existing cards.
- Shared Settings, bounded searchable editors, per-rule logs, separate user/code guides and the reviewed language batch.

## 3.0.0 — 2026-09-27 — Shared policies and the new rule contract

Source: `ce23cf2dceb87cc0f0a0d26943e0415c48b56776`.

Retroactive milestone: the annotated tag names this exact historical snapshot. Its embedded version field retains the earlier number; no historical commit is rewritten and no package was distributed under this number.

- One blocking group can apply to multiple scopes and platforms, with linked budgets, schedules, Freeze gates and explicit Link/Unlink.
- Custom rules now use the bare (on, v) contract. The former helper API, Templates, count-up Timer mode and group exception effect are retired. This is a breaking behavior/API boundary.
- Rules can read pages with v.query, preserve their state across Run, and stop effects while their group is disabled.

## 2.5.0 — 2026-09-23 — Platform tagging and tool integration

Source: `c08e1a39dbddc9002d6dc7a3e5d552bb58974c82`.

Retroactive milestone: the annotated tag names this exact historical snapshot. Its embedded version field retains the earlier number; no historical commit is rewritten and no package was distributed under this number.

- Creator-less video tagging, cover-until-tagged and Classifier offline status.
- Full content-block coverage across YouTube, Reddit, Bilibili and X, plus extension settings exposed through the local hub and MCP.

## Earlier versions

All existing `v*` tags, `release/v*` branches and published artifacts are retained. Their original details remain in the group changelog and website History.
