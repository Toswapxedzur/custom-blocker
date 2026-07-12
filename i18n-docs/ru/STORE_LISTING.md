# Источник листинга Интернет-магазина Chrome

Это английский источник текущего расширения Manifest V3. Проверьте его на соответствие `manifest.json` перед публикацией новой сборки магазина.

## Имя расширения

```text
Adamancia Vault
```

## Краткое описание

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Подробное описание

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Пояснения к разрешениям

| Разрешение | Текущая цель |
| --- | --- |
| `storage` | Сохраняйте группы, настройки и состояние локального редактора. |
| `alarms` | Запланируйте проверку биографических данных и обновление групп по времени. |
| `offscreen` | Запустите управляемую среду выполнения с пользовательскими правилами, где Chromium требует закадровый документ. |
| `tabs` | Прочитайте контекст активной вкладки, необходимый для применения группы и отображения статуса. |
| `webNavigation` | Повторно оцените соответствующие группы после навигации. |
| `favicon` | Отображайте значки веб-сайтов в редакторе, если они доступны. |
| `<all_urls>` | Применяйте созданные пользователем правила веб-сайта и платформы к страницам, которые пользователь выбирает контролировать. |

## Проверки выпуска

1. Запустите `./tests/run.sh`.
2. Обновите версию манифеста только для фиксации выпуска.
3. Просмотрите руководство на английском языке и результаты аудита перевода.
4. Создайте артефакт загрузки из проверенного коммита.
5. Не включайте примечания к исходному коду, тестовые приспособления или файлы частной разработки в загружаемый артефакт.
