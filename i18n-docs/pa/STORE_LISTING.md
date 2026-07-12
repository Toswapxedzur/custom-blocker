# ਕਰੋਮ ਵੈੱਬ ਸਟੋਰ ਸੂਚੀਕਰਨ ਸਰੋਤ

ਇਹ ਮੌਜੂਦਾ ਮੈਨੀਫੈਸਟ V3 ਐਕਸਟੈਂਸ਼ਨ ਲਈ ਅੰਗਰੇਜ਼ੀ ਸਰੋਤ ਹੈ। ਇੱਕ ਨਵਾਂ ਸਟੋਰ ਬਿਲਡ ਪ੍ਰਕਾਸ਼ਿਤ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ `manifest.json` ਦੇ ਵਿਰੁੱਧ ਇਸਦੀ ਪੁਸ਼ਟੀ ਕਰੋ।

## ਐਕਸਟੈਂਸ਼ਨ ਦਾ ਨਾਮ

```text
Adamancia Vault
```

## ਛੋਟਾ ਵੇਰਵਾ

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## ਵਿਸਤ੍ਰਿਤ ਵੇਰਵਾ

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## ਅਨੁਮਤੀ ਦੀਆਂ ਵਿਆਖਿਆਵਾਂ

| ਇਜਾਜ਼ਤ | ਮੌਜੂਦਾ ਮਕਸਦ |
| --- | --- |
| `storage` | ਸਮੂਹ, ਸੈਟਿੰਗਾਂ ਅਤੇ ਸਥਾਨਕ ਸੰਪਾਦਕ ਸਥਿਤੀ ਨੂੰ ਸੁਰੱਖਿਅਤ ਕਰੋ। |
| `alarms` | ਪਿਛੋਕੜ ਜਾਂਚਾਂ ਅਤੇ ਸਮਾਂ-ਅਧਾਰਿਤ ਸਮੂਹ ਅੱਪਡੇਟਾਂ ਨੂੰ ਤਹਿ ਕਰੋ। |
| `offscreen` | ਨਿਯੰਤਰਿਤ ਕਸਟਮ-ਨਿਯਮ ਰਨਟਾਈਮ ਚਲਾਓ ਜਿੱਥੇ Chromium ਨੂੰ ਇੱਕ ਆਫਸਕ੍ਰੀਨ ਦਸਤਾਵੇਜ਼ ਦੀ ਲੋੜ ਹੁੰਦੀ ਹੈ। |
| `tabs` | ਇੱਕ ਸਮੂਹ ਨੂੰ ਲਾਗੂ ਕਰਨ ਅਤੇ ਸਥਿਤੀ ਦਿਖਾਉਣ ਲਈ ਲੋੜੀਂਦੇ ਕਿਰਿਆਸ਼ੀਲ ਟੈਬ ਸੰਦਰਭ ਨੂੰ ਪੜ੍ਹੋ। |
| `webNavigation` | ਨੈਵੀਗੇਸ਼ਨ ਤੋਂ ਬਾਅਦ ਲਾਗੂ ਸਮੂਹਾਂ ਦਾ ਮੁੜ-ਮੁਲਾਂਕਣ ਕਰੋ। |
| `favicon` | ਜਿੱਥੇ ਉਪਲਬਧ ਹੋਵੇ ਸੰਪਾਦਕ ਵਿੱਚ ਵੈੱਬਸਾਈਟ ਆਈਕਨ ਦਿਖਾਓ। |
| `<all_urls>` | ਉਪਭੋਗਤਾ ਦੁਆਰਾ ਬਣਾਈ ਗਈ ਵੈਬਸਾਈਟ ਅਤੇ ਪਲੇਟਫਾਰਮ ਨਿਯਮਾਂ ਨੂੰ ਉਹਨਾਂ ਪੰਨਿਆਂ 'ਤੇ ਲਾਗੂ ਕਰੋ ਜੋ ਉਪਭੋਗਤਾ ਨਿਯੰਤਰਣ ਕਰਨ ਲਈ ਚੁਣਦਾ ਹੈ। |

## ਚੈਕ ਜਾਰੀ ਕਰੋ

1. `./tests/run.sh` ਚਲਾਓ।
2. ਸਿਰਫ਼ ਰੀਲੀਜ਼ ਪ੍ਰਤੀਬੱਧਤਾ ਲਈ ਮੈਨੀਫੈਸਟ ਸੰਸਕਰਣ ਨੂੰ ਅੱਪਡੇਟ ਕਰੋ।
3. ਅੰਗਰੇਜ਼ੀ ਮੈਨੂਅਲ ਅਤੇ ਅਨੁਵਾਦ ਆਡਿਟ ਆਉਟਪੁੱਟ ਦੀ ਸਮੀਖਿਆ ਕਰੋ।
4. ਸਮੀਖਿਆ ਕੀਤੀ ਪ੍ਰਤੀਬੱਧਤਾ ਤੋਂ ਅੱਪਲੋਡ ਆਰਟੀਫੈਕਟ ਬਣਾਓ।
5. ਅੱਪਲੋਡ ਆਰਟੀਫੈਕਟ ਵਿੱਚ ਸਰੋਤ ਨੋਟਸ, ਟੈਸਟ ਫਿਕਸਚਰ, ਜਾਂ ਨਿੱਜੀ ਵਿਕਾਸ ਫਾਈਲਾਂ ਨੂੰ ਸ਼ਾਮਲ ਨਾ ਕਰੋ।
