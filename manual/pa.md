# Custom Web Blocker — ਹਦਾਇਤ ਮੈਨੁਅਲ

ਇਹ ਐਕਸਟੈਂਸ਼ਨ ਲਈ ਪੂਰਾ ਰੈਫਰੈਂਸ ਮੈਨੁਅਲ ਹੈ। ਇਹ ਸਭ ਤੋਂ ਆਸਾਨ ਅਤੇ ਆਮ ਵਰਕਫਲੋ ਨਾਲ ਸ਼ੁਰੂ ਹੁੰਦਾ ਹੈ ਅਤੇ ਹੌਲੀ-ਹੌਲੀ advanced ਟਾਪਿਕਸ ਵੱਲ ਜਾਂਦਾ ਹੈ, ਜਿਵੇਂ custom JavaScript blocking rules ਅਤੇ helper API।

ਜੇ ਤੁਸੀਂ ਬਿਲਕੁਲ ਨਵੇਂ ਹੋ, ਤਾਂ ਸਿਰਫ **Quick start** ਅਤੇ **Block groups overview** ਪੜ੍ਹੋ। ਇਨ੍ਹਾਂ ਤੋਂ ਹੇਠਾਂ ਵਾਲੇ ਸਾਰੇ ਸੈਕਸ਼ਨ optional ਹਨ, ਤੁਹਾਡੀ ਲੋੜ ਮੁਤਾਬਕ।

---

## 1. ਇਹ ਐਕਸਟੈਂਸ਼ਨ ਕੀ ਕਰਦੀ ਹੈ

Custom Web Blocker ਤੁਹਾਨੂੰ ਤੁਹਾਡੇ ਆਪਣੇ ਬਣਾਏ ਨਿਯਮਾਂ ਅਨੁਸਾਰ websites ਅਤੇ online distractions ਨੂੰ block ਕਰਨ ਦਿੰਦੀ ਹੈ। ਤੁਸੀਂ ਇਹ ਕਰ ਸਕਦੇ ਹੋ:

- Browser ਦੀ native network blocking ਨਾਲ ਤੁਰੰਤ sites block ਕਰੋ (ਉਹੀ ਕਿਸਮ ਜਿਸ ਵਿੱਚ `ERR_BLOCKED_BY_CLIENT` ਆਉਂਦਾ ਹੈ)।
- ਕਿਸੇ site ਲਈ ਦਿਨ ਦੇ ਕੁਝ ਮਿੰਟ ਆਪਣੇ ਲਈ allow ਕਰੋ, ਅਤੇ limit ਤੋਂ ਬਾਅਦ block ਕਰੋ।
- YouTube, TikTok, Facebook, Instagram, Twitch, ਅਤੇ Reddit ਵਿੱਚ specific content types block ਕਰੋ (ਪੂਰੀ site ਨਹੀਂ)।
- Supported platforms ਦੇ feeds ਵਿੱਚ blocked content hide ਕਰੋ, ਸਿਰਫ single pages block ਕਰਨ ਦੀ ਬਜਾਏ।
- Week ਦੇ ਦਿਨਾਂ ਅਤੇ `HHMM-HHMM` time windows ਦੇ ਅਧਾਰ 'ਤੇ rule active ਹੋਣ ਦਾ ਸਮਾਂ schedule ਕਰੋ।
- Rule ਨੂੰ freeze ਕਰੋ ਤਾਂ ਜੋ ਇਸਨੂੰ ਆਸਾਨੀ ਨਾਲ ਬਦਲਿਆ ਨਾ ਜਾ ਸਕੇ। Strict freeze ਨਿਰਧਾਰਤ ਘੰਟਿਆਂ ਲਈ lock ਕਰਦਾ ਹੈ ਅਤੇ undo ਲਈ 20-step confirmation ritual ਲੋੜੀਂਦਾ ਹੁੰਦਾ ਹੈ।
- Rule ਨੂੰ ਅਸਥਾਈ snooze ਕਰੋ, ਪਰ ਇਸ ਤੋਂ ਪਹਿਲਾਂ ਲੰਮਾ justification ਲਿਖਣਾ ਲਾਜ਼ਮੀ ਹੈ।
- Timers, persistent storage, platform detection, domain matching, ਅਤੇ logging ਲਈ helpers ਨਾਲ custom JavaScript rules ਲਿਖੋ।
- ਐਕਸਟੈਂਸ਼ਨ ਨੂੰ 20+ ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਵਰਤੋਂ।

ਇਹ ਐਕਸਟੈਂਸ਼ਨ Chrome Manifest V3 extension ਹੈ, ਜਿਸ ਵਿੱਚ ਇੱਕ editor page (popup), ਇੱਕ background service worker, ਅਤੇ ਇੱਕ content script ਹੁੰਦੀ ਹੈ ਜੋ ਹਰ page ਵਿੱਚ ਚਲਦੀ ਹੈ।

---

## 2. UI ਟੂਰ

ਜਦੋਂ ਤੁਸੀਂ extension icon 'ਤੇ click ਕਰਦੇ ਹੋ, editor ਇੱਕ full web page ਵਜੋਂ ਖੁਲ੍ਹਦਾ ਹੈ (tiny popup ਨਹੀਂ)। Page ਵਿੱਚ ਇਹ ਹਿੱਸੇ ਹਨ:

- **Top bar**
  - **Instruction Manual** ਬਟਨ (ਇਹ ਦਸਤਾਵੇਜ਼)
  - **Language** picker
- **Left panel — Block Groups**
  - ਤੁਹਾਡੇ block groups ਦੀ ਲਿਸਟ। ਹਰ card ਵਿੱਚ group name, ਛੋਟੀ summary line, ਅਤੇ enable/disable checkbox ਹੁੰਦੀ ਹੈ।
  - **Add** ਬਟਨ ਨਵੀਂ group ਬਣਾਉਂਦਾ ਹੈ। ਨਾਲ ਵਾਲਾ dropdown type ਚੁਣਦਾ ਹੈ।
  - **Delete All** ਸਾਰੀਆਂ groups ਹਟਾਉਂਦਾ ਹੈ; ਜੇ ਕੋਈ group frozen ਹੋਵੇ ਤਾਂ extra confirmations ਲੱਗਦੀਆਂ ਹਨ।
  - ਤੁਸੀਂ card ਉੱਤੇ `::` handle ਨੂੰ drag ਕਰਕੇ groups reorder ਕਰ ਸਕਦੇ ਹੋ।
  - ਤੁਸੀਂ vertical splitter drag ਕਰਕੇ panel ਦਾ size ਬਦਲ ਸਕਦੇ ਹੋ।
- **Right panel — Editor**
  - ਚੁਣੀ ਹੋਈ group edit ਹੁੰਦੀ ਹੈ: name, blocking behavior, blocklists, type-specific filters, schedule, freeze, snooze।
  - ਜਦੋਂ ਤੁਸੀਂ typing/interacting ਰੋਕਦੇ ਹੋ ਤਾਂ fraction of a second ਵਿੱਚ ਸਾਰੇ changes auto-save ਹੋ ਜਾਂਦੇ ਹਨ।
- **Toast** (centered popup ਜੋ fade ਹੁੰਦਾ ਹੈ)
  - "Saved changes" ਜਾਂ input errors ਵਰਗੇ status messages ਦਿਖਾਉਂਦਾ ਹੈ।

ਜਦੋਂ ਕੋਈ page block ਹੋ ਰਿਹਾ ਹੋਵੇ ਜਾਂ ਉਸ 'ਤੇ active timer ਹੋਵੇ, ਤਾਂ ਉਸਦੇ top-left ਵਿੱਚ overlay ਦਿਖਾਈ ਦਿੰਦਾ ਹੈ ਜੋ ਸਾਰੀਆਂ active time constraints `hh:mm:ss` (ਜਾਂ `mm:ss`) format ਵਿੱਚ ਦਿਖਾਉਂਦਾ ਹੈ। Multiple constraints multiple lines ਵਿੱਚ stack ਹੁੰਦੀਆਂ ਹਨ।

---

## 3. Quick start

1. Extension icon 'ਤੇ click ਕਰੋ। Editor full page ਵਜੋਂ ਖੁੱਲੇਗਾ।
2. **Block Groups** panel ਵਿੱਚ dropdown ਤੋਂ group type ਚੁਣੋ:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit`, ਜਾਂ `Custom`।
3. **Add** click ਕਰੋ। ਨਵੀਂ group ਬਣੇਗੀ ਅਤੇ editor ਉਹੀ ਖੋਲ੍ਹੇਗਾ।
4. Group ਨੂੰ name ਦਿਓ।
5. Type-specific fields ਭਰੋ (ਜਿਵੇਂ `Default` ਲਈ **Blocked websites** list)।
6. ਯਕੀਨੀ ਬਣਾਓ ਕਿ left panel ਵਿੱਚ group ਦਾ checkbox on ਹੈ।
7. Listed sites ਵਿੱਚੋਂ ਕਿਸੇ ਇੱਕ 'ਤੇ ਜਾਓ। Block ਤੁਰੰਤ ਲਾਗੂ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।

ਇਹ ਹੀ ਪੂਰਾ happy path ਹੈ। ਬਾਕੀ ਮੈਨੁਅਲ ਇਸਦੇ ਉੱਪਰ ਵਾਧੂ options ਹਨ।

---

## 4. Block groups overview

ਇਸ extension ਵਿੱਚ ਸਾਰਾ ਕੁਝ **block groups** ਵਿੱਚ organized ਹੈ। Block group ਇੱਕ rule set ਹੁੰਦੀ ਹੈ:

- ਇਸਦਾ name, type, ਅਤੇ enabled/disabled state ਹੁੰਦਾ ਹੈ।
- ਇਸਦਾ blocking behavior ਹੁੰਦਾ ਹੈ (ਤੁਰੰਤ ਜਾਂ ਕੁਝ ਮਿੰਟਾਂ ਬਾਅਦ)।
- ਇਸਦਾ optional schedule (days + time windows) ਅਤੇ optional freeze/snooze controls ਹੁੰਦੇ ਹਨ।
- Type ਦੇ ਅਨੁਸਾਰ extra fields ਹੁੰਦੀਆਂ ਹਨ, ਜਿਵੇਂ websites list, YouTube author filters, subreddit names, ਜਾਂ JavaScript function।

ਤੁਸੀਂ ਕੋਈ ਵੀ ਗਿਣਤੀ ਵਿੱਚ groups ਰੱਖ ਸਕਦੇ ਹੋ। ਇੱਕ page 'ਤੇ ਕਈ groups ਲਾਗੂ ਹੋ ਸਕਦੀਆਂ ਹਨ; ਅਜੇਹੇ case ਵਿੱਚ **ਸਭ ਤੋਂ strict** rule ਜਿੱਤਦਾ ਹੈ:

- "Block immediately" > "block after some time"।
- ਘੱਟ ਬਚੇ ਸਮੇਂ ਵਾਲੀ group > ਵੱਧ ਬਚੇ ਸਮੇਂ ਵਾਲੀ group।

ਇਸ ਲਈ ਨਵੀਆਂ groups ਜੋੜਨ ਨਾਲ page ਪਹਿਲਾਂ block ਹੋ ਸਕਦਾ ਹੈ, ਦੇਰ ਨਾਲ ਨਹੀਂ।

ਤੁਸੀਂ `::` handle ਨਾਲ groups reorder ਕਰ ਸਕਦੇ ਹੋ। Order strictness ਨਹੀਂ ਬਦਲਦਾ, ਪਰ list ਦੀ readability top-to-bottom control ਕਰਦਾ ਹੈ।

---

## 5. Group types

### 5.1 `Default` — ਆਮ websites block ਕਰੋ

Specific domains block ਕਰਨ ਲਈ (typical use case)।

- **Blocked websites**: ਹਰ line ਵਿੱਚ ਇੱਕ site। `facebook.com` ਅਤੇ `https://www.facebook.com/somepage` ਦੋਵੇਂ ਚੱਲਦੇ ਹਨ; extension hostname extract ਅਤੇ normalize ਕਰਦੀ ਹੈ।
- Site rule ਉਸ hostname ਅਤੇ ਉਸਦੇ ਸਾਰੇ subdomains 'ਤੇ ਲਾਗੂ ਹੁੰਦਾ ਹੈ।
- ਇਹ group type Chrome ਦੀ native network blocking ਵਰਤਦੀ ਹੈ, `ERR_BLOCKED_BY_CLIENT` ਵਰਗੀ। ਮਤਲਬ blocked URL 'ਤੇ navigation page load ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਰੋਕ ਦਿੱਤੀ ਜਾਂਦੀ ਹੈ।

### 5.2 `YouTube` — YouTube ਅਤੇ ਮਿਲਦੇ-ਜੁਲਦੇ video sites block ਕਰੋ

Editor ਵਿੱਚ **Filters** section ਸ਼ਾਮਲ ਹੁੰਦਾ ਹੈ:

- **Content type**:
  - `Apply to all YouTube pages` — ਹਰ YouTube page count ਹੁੰਦੀ ਹੈ।
  - `Apply to Shorts` — ਸਿਰਫ Shorts pages count ਹੁੰਦੀਆਂ ਹਨ।
  - `Apply to long videos` — ਸਿਰਫ `/watch`, `/live/`, `/embed/` ਆਦਿ।
  - `Apply to YouTube posts` — community posts (`/post/...`, channel community/posts tabs)।
- **Author filter**:
  - `Do not filter by author` — author ਦੀ ਪਹਿਚਾਣ matter ਨਹੀਂ ਕਰਦੀ।
  - `Apply to certain authors` — ਸਿਰਫ listed authors ਇਸ group ਨੂੰ trigger ਕਰਦੇ ਹਨ।
  - `Apply to all except certain authors` — listed authors exempt ਹਨ।
- **Authors**: ਹਰ line ਵਿੱਚ ਇੱਕ author। `@handle`, full URLs, `/channel/UC...`, `/c/...`, `/user/...` accepted ਹਨ।
- **Hide blocked entries in the YouTube feed**: ਜਦੋਂ ਇਹ group actively block ਕਰ ਰਹੀ ਹੋਵੇ, matching cards YouTube feeds ਵਿੱਚ hide ਹੋ ਜਾਂਦੀਆਂ ਹਨ। Block inactive ਹੋਣ 'ਤੇ next refresh 'ਤੇ ਵਾਪਸ ਆ ਜਾਂਦੀਆਂ ਹਨ।

Shorts ਅਤੇ Posts content types ਲਈ, ਜਦੋਂ author filter set ਨਾ ਹੋਵੇ ਅਤੇ group currently block ਕਰ ਰਹੀ ਹੋਵੇ, extension relevant nav entries (Shorts sidebar entry, Community/Posts channel tabs) ਅਤੇ matching shelves ਜਿਵੇਂ "Latest YouTube posts" ਵੀ hide ਕਰਦੀ ਹੈ।

Short-vs-long detection ਹੋਰ video sites ਜਿਵੇਂ TikTok, Vimeo, Twitch clips/VODs, ਅਤੇ Dailymotion ਤੱਕ ਵੀ ਵਧਦੀ ਹੈ, ਜਦੋਂ page form detect ਹੋ ਸਕੇ।

### 5.3 `TikTok` — TikTok content block ਕਰੋ

ਉਹੀ editor card ਜੋ platform-video editor ਵਿੱਚ ਹੁੰਦੀ ਹੈ, ਪਰ TikTok-specific labels ਨਾਲ:

- Content types: short videos, videos, profile pages।
- Authors: TikTok handles (`@handle`) ਜਾਂ profile URLs।
- Group active ਹੋਣ ਦੌਰਾਨ feed hiding TikTok pages 'ਤੇ matching cards hide ਕਰਦੀ ਹੈ।

### 5.4 `Facebook` — Facebook content block ਕਰੋ

- Content types: Reels, videos, posts।
- Authors: page name (`page.name`), profile URL, ਜਾਂ `profile.php?id=...` form (numeric id `id:<number>` ਵਜੋਂ preserve ਹੁੰਦੀ ਹੈ)।
- Feed hiding Facebook 'ਤੇ matching feed cards hide ਕਰਦੀ ਹੈ।

### 5.5 `Instagram` — Instagram content block ਕਰੋ

- Content types: Reels, videos, posts।
- Authors: Instagram handles ਜਾਂ profile URLs।
- Reserved paths ਜਿਵੇਂ `/reel/`, `/p/`, `/tv/`, `/explore/` authors ਨਹੀਂ ਮੰਨੇ ਜਾਂਦੇ।
- Feed hiding Instagram 'ਤੇ matching cards hide ਕਰਦੀ ਹੈ।

### 5.6 `Twitch` — Twitch content block ਕਰੋ

- Content types: clips, streams/VODs, channel pages।
- Authors: channel names ਜਾਂ channel URLs।
- Reserved paths ਜਿਵੇਂ `/directory`, `/videos`, `/settings`, ਆਦਿ channel names ਨਹੀਂ ਮੰਨੇ ਜਾਂਦੇ।
- Feed hiding Twitch 'ਤੇ matching cards hide ਕਰਦੀ ਹੈ।

### 5.7 `Reddit` — Reddit ਜਾਂ specific subreddits block ਕਰੋ

- **Subreddits**: ਹਰ line ਵਿੱਚ ਇੱਕ subreddit। Empty list ਦਾ ਮਤਲਬ group ਪੂਰੇ Reddit 'ਤੇ ਲਾਗੂ ਹੈ। `productivity` ਅਤੇ `r/productivity` ਦੋਵੇਂ accepted ਹਨ।

### 5.8 `Custom` — JavaScript function ਨਾਲ block ਕਰੋ

ਤੁਸੀਂ JavaScript function ਲਿਖਦੇ ਹੋ। Extension ਇਸਨੂੰ ਲਗਭਗ ਹਰ second call ਕਰਦੀ ਹੈ ਅਤੇ ਜੋ ਇਹ return ਕਰਦੀ ਹੈ ਉਹ current blocklist ਵਜੋਂ ਵਰਤਦੀ ਹੈ।

`Custom` groups ਵਿੱਚ ਇਹ ਨਹੀਂ ਦਿਖਾਇਆ ਜਾਂਦਾ: blocking behavior, blocked sites, allowed minutes, reset interval, schedule days, ਜਾਂ time windows। ਇਨ੍ਹਾਂ ਵਿੱਚ ਸਿਰਫ ਇੱਕ ਵੱਡਾ input ਹੁੰਦਾ ਹੈ — **Blocking Rules** function — ਨਾਲ standard freeze/snooze controls।

ਪੂਰਾ custom rules reference ਅਤੇ helpers API ਲਈ **Section 11** ਵੇਖੋ।

---

## 6. Blocking behavior

ਜ਼ਿਆਦਾਤਰ group types ਲਈ ਤੁਸੀਂ ਦੋ modes ਵਿੱਚੋਂ ਇੱਕ ਚੁਣਦੇ ਹੋ:

### 6.1 ਤੁਰੰਤ block

Rule ਤਦ active ਹੁੰਦਾ ਹੈ ਜਦੋਂ group on ਹੋਵੇ, schedule allow ਕਰੇ, ਅਤੇ (platform groups ਲਈ) page match ਕਰੇ।

`Default` groups ਲਈ Chrome native blocking ਵਰਤੀ ਜਾਂਦੀ ਹੈ। Platform groups ਲਈ in-page overlay/exit logic ਵਰਤੀ ਜਾਂਦੀ ਹੈ।

### 6.2 ਕੁਝ ਮਿੰਟਾਂ ਬਾਅਦ block

ਇਹ usage budget ਹੈ।

- **Allowed minutes before block** (decimal): ਇੱਕ period ਵਿੱਚ ਤੁਸੀਂ ਆਪਣੇ ਲਈ ਕਿੰਨੇ ਮਿੰਟ allow ਕਰਦੇ ਹੋ। ਉਦਾਹਰਨ: `15`, `0.5`, `90`।
- **Timer reset interval (hours)** (decimal): budget ਕਿੰਨੀ ਵਾਰ reset ਹੁੰਦਾ ਹੈ। ਉਦਾਹਰਨ: `24` daily ਲਈ, `1` hourly ਲਈ, `0.25` ਹਰ 15 ਮਿੰਟ ਲਈ।

ਜਦ ਤੱਕ time ਬਚਿਆ ਹੈ, page normally ਚੱਲਦਾ ਹੈ ਅਤੇ timer overlay ਦਿਖਦਾ ਹੈ। ਜਦੋਂ budget zero 'ਤੇ ਪਹੁੰਚਦਾ ਹੈ, page ਬਾਕੀ period ਲਈ block ਹੋ ਜਾਂਦਾ ਹੈ, overlay `0:00` ਦਿਖਾਉਂਦਾ ਹੈ, ਫਿਰ tab exit ਕਰਨ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰਦੀ ਹੈ।

Extension per-group, per-period ਆਧਾਰ 'ਤੇ ਕੰਮ ਕਰਦੀ ਹੈ:

- ਹਰ group ਦਾ ਆਪਣਾ budget ਹੈ।
- Group ਨਾਲ match ਕਰਦੀ ਕਿਸੇ ਵੀ page 'ਤੇ spent time ਉਸ group ਦੇ budget ਵਿੱਚ count ਹੁੰਦਾ ਹੈ।
- ਇੱਕੋ group ਵਿੱਚ multiple tabs budget share ਕਰਦੀਆਂ ਹਨ। ਉਨ੍ਹਾਂ ਦੇ timers synchronized ਰਹਿੰਦੇ ਹਨ; ਦੂਜੀ tab 'ਤੇ switch ਕਰਨਾ forced refresh ਵੀ ਕਰਦਾ ਹੈ ਤਾਂ ਜੋ shared time ਤੁਰੰਤ ਦਿਖੇ।

ਜੇ ਇੱਕੋ page 'ਤੇ multiple time-limited groups ਲਾਗੂ ਹੁੰਦੀਆਂ ਹਨ, ਤਾਂ strictest rule ਜਿੱਤਦੀ ਹੈ।

---

## 7. Schedule

**Schedule** card ਵਿੱਚ ਤੁਸੀਂ group active ਹੋਣ ਦਾ ਸਮਾਂ ਸੀਮਿਤ ਕਰ ਸਕਦੇ ਹੋ:

- **Days to block**: ਉਹ ਦਿਨ ਚੁਣੋ ਜਿਨ੍ਹਾਂ ਵਿੱਚ group ਲਾਗੂ ਹੋਵੇ। Unchecked days ਦਾ ਮਤਲਬ ਉਸ ਦਿਨ group inactive ਹੈ।
- **Time windows**: free-form list, ਹਰ line ਵਿੱਚ ਇੱਕ window `HHMM-HHMM` format ਵਿੱਚ, ਉਦਾਹਰਨ:

  ```
  0900-1000
  1200-1300
  ```

  Group ਸਿਰਫ ਇਨ੍ਹਾਂ windows ਦੇ ਅੰਦਰ active ਰਹਿੰਦੀ ਹੈ। Empty list ਦਾ ਮਤਲਬ full-day।

ਇਹ `Custom` ਤੋਂ ਇਲਾਵਾ ਸਾਰੀਆਂ group types 'ਤੇ ਲਾਗੂ ਹੁੰਦਾ ਹੈ।

---

## 8. Freeze (anti-tampering)

Freeze group ਨੂੰ impulse ਵਿੱਚ disable ਕਰਨਾ ਔਖਾ ਬਣਾਉਂਦਾ ਹੈ।

**Freeze** card ਵਿੱਚ ਤੁਸੀਂ ਚੁਣਦੇ ਹੋ:

- **Frozen** — ਤੁਸੀਂ group edit/delete ਨਹੀਂ ਕਰ ਸਕਦੇ, ਅਤੇ enable toggle uncheck ਵੀ ਨਹੀਂ ਕਰ ਸਕਦੇ। ਕੁਝ ਵੀ ਬਦਲਣ ਲਈ unfreeze ritual ਲਾਜ਼ਮੀ ਹੈ (ਹੇਠਾਂ ਵੇਖੋ)।
- **Strict frozen** — Frozen ਵਰਗਾ ਹੀ, ਪਰ ਇਹ ਤੁਹਾਡੇ ਚੁਣੇ ਘੰਟਿਆਂ ਲਈ locked ਰਹਿੰਦਾ ਹੈ (decimal, ਵੱਧ ਤੋਂ ਵੱਧ 72)। Timer ਮੁੱਕਣ ਤੱਕ unfreeze ritual ਵੀ available ਨਹੀਂ ਹੁੰਦਾ।

ਜਦੋਂ frozen group unlockable ਹੋਵੇ, **Unfreeze** button ਦਿਖਾਈ ਦਿੰਦਾ ਹੈ। ਇਸ 'ਤੇ click ਕਰਨ ਨਾਲ **20-step ritual** ਸ਼ੁਰੂ ਹੁੰਦੀ ਹੈ:

- Modal ਵਿੱਚ self-discipline ਸੁਨੇਹਾ ਦਿਖਦਾ ਹੈ।
- ਤੁਹਾਨੂੰ `Confirm` 20 ਵਾਰ click ਕਰਨਾ ਪੈਂਦਾ ਹੈ।
- ਹਰ click ਵਿਚਕਾਰ 5-second forced wait ਹੁੰਦੀ ਹੈ।
- ਜੇ ਤੁਸੀਂ ਵਿਚਕਾਰ cancel ਕਰ ਦਿੰਦੇ ਹੋ, ਤਾਂ step 1 ਤੋਂ ਦੁਬਾਰਾ ਸ਼ੁਰੂ ਕਰਨਾ ਪੈਂਦਾ ਹੈ।
- 20 messages rotate ਹੁੰਦੀਆਂ ਹਨ ਤਾਂ ਜੋ ਤੁਸੀਂ ਸੱਚਮੁੱਚ ਪੜ੍ਹੋ।

ਜੇ group "no snooze" ਵਜੋਂ mark ਹੈ (ਅਗਲਾ section ਵੇਖੋ), ਤਾਂ frozen ਹੋਣ ਦੌਰਾਨ ਤੁਸੀਂ ਇਸਨੂੰ snooze ਵੀ ਨਹੀਂ ਕਰ ਸਕਦੇ।

Freeze status group card ਦੀ meta line ਵਿੱਚ ਦਿਖਦੀ ਹੈ, strict freeze ਲਈ remaining time ਸਮੇਤ।

---

## 9. Snooze (temporary disable)

Snooze group ਨੂੰ unfreeze ਕੀਤੇ ਬਿਨਾਂ ਅਸਥਾਈ disable ਕਰਦੀ ਹੈ, ਪਰ ਸਿਰਫ ਲਿਖਤੀ justification ਨਾਲ।

**Snooze** card ਵਿੱਚ:

- **Allow snooze for this group** — ਜੇ off ਹੈ, ਤਾਂ ਇਹ group snooze ਨਹੀਂ ਹੋ ਸਕਦੀ (frozen ਹੋਣ ਦੌਰਾਨ ਵੀ ਨਹੀਂ)।
- **Snooze for (minutes)** — decimal, snooze ਕਿੰਨਾ ਚੱਲੇਗਾ।
- **Reason** — **ਘੱਟੋ-ਘੱਟ 100 characters ਅਤੇ 20 ਤੋਂ ਵੱਧ words** ਹੋਣੇ ਚਾਹੀਦੇ ਹਨ। ਦੋਵੇਂ ਸ਼ਰਤਾਂ ਪੂਰੀਆਂ ਹੋਣ ਤੱਕ Start button disabled ਰਹਿੰਦੀ ਹੈ। Rule fail ਹੋਣ 'ਤੇ button ਦੇ ਕੋਲ inline warning ਆਉਂਦੀ ਹੈ।

ਜੇ group frozen ਹੈ, snooze minutes freeze ਤੋਂ ਪਹਿਲਾਂ ਚੁਣੀ value 'ਤੇ locked ਰਹਿੰਦੇ ਹਨ। ਫਿਰ ਵੀ ਤੁਸੀਂ snooze ਕਰ ਸਕਦੇ ਹੋ, ਜਦ ਤੱਕ snooze allow ਹੈ ਅਤੇ reason rules ਪੂਰੀ ਕਰਦੀ ਹੈ।

ਇੱਕ status message snooze confirm ਕਰਦਾ ਹੈ। Snooze ਖਤਮ ਹੋਣ 'ਤੇ group ਆਪ ਹੀ normal ਵਿੱਚ ਵਾਪਸ ਆ ਜਾਂਦੀ ਹੈ।

ਤੁਸੀਂ **End Snooze** button ਨਾਲ snooze ਜਲਦੀ ਖਤਮ ਵੀ ਕਰ ਸਕਦੇ ਹੋ।

---

## 10. Bulk actions

- **Delete All** ਸਾਰੀਆਂ groups ਹਟਾਉਂਦਾ ਹੈ।
  - ਇਹ ਹਮੇਸ਼ਾਂ confirmation ਮੰਗਦਾ ਹੈ।
  - ਜੇ ਘੱਟੋ-ਘੱਟ ਇੱਕ group frozen ਹੈ, ਤਾਂ unfreeze ਵਾਲੀ same 20-step ritual ਲਾਗੂ ਹੁੰਦੀ ਹੈ।
  - ਜੇ ਕੋਈ group strict-frozen ਹੋ ਕੇ ਅਜੇ locked ਹੈ, ਤਾਂ **Delete All** disabled ਰਹਿੰਦਾ ਹੈ।

---

## 11. Custom groups (full reference)

`Custom` group background service worker ਵਿੱਚ JavaScript function ਚਲਾਉਂਦੀ ਹੈ। ਇਹ function ਲਗਭਗ ਹਰ second call ਹੁੰਦੀ ਹੈ, ਅਤੇ extension ਇਸਦੇ return ਦੇ ਅਧਾਰ 'ਤੇ ਫੈਸਲਾ ਕਰਦੀ ਹੈ ਕਿ ਇਸ ਵੇਲੇ ਕਿਹੜੇ domains block ਹੋਣੇ ਚਾਹੀਦੇ ਹਨ।

### 11.1 Function signature

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parameters:

- `month` — `1` ਤੋਂ `12`।
- `dayOfMonth` — `1` ਤੋਂ `31`।
- `dayName` — ਜਿਵੇਂ `"Monday"`।
- `hour` — `0` ਤੋਂ `23`।
- `minute` — `0` ਤੋਂ `59`।
- `blockedDomains` — domains ਦੀ running list ਜੋ ਹੋਰ rules ਪਹਿਲਾਂ ਹੀ ਬਣਾਈਆਂ ਹਨ। ਤੁਸੀਂ ਇਸ ਵਿੱਚ add, replace, ਜਾਂ ignore ਕਰ ਸਕਦੇ ਹੋ।
- `helpers` — helper objects ਦਾ bundle (ਹੇਠਾਂ ਵੇਖੋ)।

Return value:

- Domain strings ਦੀ array ਜੋ ਹੁਣੇ block ਹੋਣੀਆਂ ਚਾਹੀਦੀਆਂ ਹਨ, OR
- ਕੁਝ ਨਾ return ਕਰੋ (ਇਸ case ਵਿੱਚ extension ਉਹ ਵਰਤੇਗੀ ਜੋ ਤੁਸੀਂ `blockedDomains` mutate ਕੀਤੀ ਹੈ)।

Save ਕਰਨ ਸਮੇਂ function validate ਹੁੰਦੀ ਹੈ। Syntax errors status warning ਦਿੰਦੀਆਂ ਹਨ, ਅਤੇ fix ਹੋਣ ਤੱਕ rule ਵਰਤੀ ਨਹੀਂ ਜਾਂਦੀ। ਜੇ runtime ਵਿੱਚ function throw ਕਰੇ, extension ਇਸਨੂੰ catch ਕਰਦੀ ਹੈ, background console ਵਿੱਚ log ਕਰਦੀ ਹੈ, ਅਤੇ previous result 'ਤੇ fallback ਕਰਦੀ ਹੈ।

### 11.2 Adaptive scheduling

Custom rules ਆਮ ਤੌਰ 'ਤੇ ਲਗਭਗ ਹਰ second run ਹੁੰਦੀਆਂ ਹਨ। ਜੇ ਤੁਹਾਡੀ rule ਬਹੁਤ ਸਮਾਂ ਲੈਣ ਲੱਗੇ, extension loop ਆਪ ਹੀ slow ਕਰ ਦਿੰਦੀ ਹੈ (ਲਗਭਗ ਹਰ 5 seconds ਤੱਕ)। ਤੁਹਾਨੂੰ ਇਹ manually manage ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ।

### 11.3 `helpers` object

Function ਦੇ ਅੰਦਰ `helpers` ਕਈ sub-helpers expose ਕਰਦੀ ਹੈ। ਹਰ helper ਦਾ long name ਅਤੇ short alias ਦੋਵੇਂ ਹਨ। Explicit getter methods ਵੀ ਹਨ:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — current epoch time milliseconds ਵਿੱਚ।

ਸਾਰੇ helper methods safe ਬਣਾਏ ਗਏ ਹਨ: ਗਲਤ parameters 'ਤੇ throw ਕਰਨ ਦੀ ਬਜਾਏ `null`, `false`, ਜਾਂ empty value ਵਾਪਸ ਦਿੰਦੇ ਹਨ।

#### 11.3.1 `timerHelper`

Domain ਨਾਲ linked countdown timers manage ਕਰਦੀ ਹੈ। Timers browser restart ਤੋਂ ਬਾਅਦ ਵੀ persist ਰਹਿੰਦੇ ਹਨ। ਹਰ timer ਉਸ custom group ਨਾਲ ਸੰਬੰਧਿਤ ਹੁੰਦਾ ਹੈ ਜਿਸ ਨੇ ਇਸਨੂੰ ਬਣਾਇਆ।

- `createTimer(domain, durationMs, displayName?)` — unique timer id ਬਣਾਕੇ return ਕਰਦਾ ਹੈ, ਜਾਂ invalid ਹੋਣ 'ਤੇ `null`। ਉਦਾਹਰਨ: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`। ਜਦ ਤੱਕ user ਉਸ domain ਨਾਲ match ਕਰਦੀ page 'ਤੇ ਹੈ, in-page overlay `Timer1: 30:00` ਦਿਖਾ ਕੇ countdown ਕਰੇਗਾ।
- `deleteTimer(id)` — timer delete ਕਰਦਾ ਹੈ। Success 'ਤੇ `true`।
- `pauseTimer(id)` — countdown pause ਕਰਦਾ ਹੈ।
- `continueTimer(id)` / `resumeTimer(id)` — paused timer resume ਕਰਦਾ ਹੈ।
- `resetTimer(id, durationMs?)` — timer restart ਕਰਦਾ ਹੈ। `durationMs` ਨਾ ਦੇਣ 'ਤੇ original duration ਵਰਤਦਾ ਹੈ।
- `addMs(id, ms)` — milliseconds ਜੋੜਦਾ ਹੈ (negative values ਨਾਲ ਘਟਾਂਦਾ ਹੈ)।
- `remainingMs(id)` — ਬਚੀਆਂ milliseconds।
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — booleans।
- `getDomain(id)` / `getDisplayName(id)` — timer info ਪੜ੍ਹੋ।
- `findByDomain(domain)` — ਉਸ domain ਲਈ timer ids ਦੀ array।
- `list()` — ਇਸ group ਦੇ ਹਰ timer ਲਈ `{ id, domain, displayName, durationMs, remainingMs, isPaused }` ਦੀ array।

Maximum timer duration ਲਗਭਗ 30 ਦਿਨ ਹੈ।

#### 11.3.2 `persistenceHelper`

ਤੁਹਾਡੀ group ਲਈ scoped map-like storage। Values JSON-serializable ਹੋਣੀਆਂ ਚਾਹੀਦੀਆਂ ਹਨ। Calls ਵਿਚਕਾਰ state ਯਾਦ ਰੱਖਣ ਲਈ useful ਹੈ।

- `set(key, value)` — ਕੋਈ ਵੀ JSON value store ਕਰਦਾ ਹੈ। Success 'ਤੇ `true`।
- `get(key, defaultValue?)` — stored value return ਕਰਦਾ ਹੈ, ਜਾਂ missing ਹੋਣ 'ਤੇ `defaultValue`।
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Soft limits: ਹਰ group ਲਈ ਲਗਭਗ 200 keys, ਹਰ value ਲਈ 16 KB।

#### 11.3.3 `domainHelper`

- `normalize(value)` — canonical domain ਜਿਵੇਂ `youtube.com` return ਕਰਦਾ ਹੈ, ਜਾਂ `null`।
- `matches(hostname, site)` — ਜੇ `hostname`, `site` ਨਾਲ ਸਬੰਧਤ ਹੈ ਤਾਂ `true` (subdomains handle ਕਰਦਾ ਹੈ)।

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — background console ਵਿੱਚ ਲਿਖਦੇ ਹਨ।

ਇਹ messages ਵੇਖਣ ਲਈ: `chrome://extensions` → Developer Mode enable ਕਰੋ → extension ਦੇ "service worker" link 'ਤੇ click ਕਰੋ।

#### 11.3.5 `platformHelper`

Supported social/video platforms inspect ਕਰਦਾ ਹੈ।

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — canonical platform name return ਕਰਦਾ ਹੈ, ਜਾਂ `null`।
- `normalizeAuthor(author, platform)` — specific platform ਲਈ author identifier (handle, URL, ਆਦਿ) normalize ਕਰਦਾ ਹੈ, ਜਾਂ `null`।
- `detect(urlOrHost)` / `getContext(urlOrHost)` — `{ platform, hostname, pathname, type, authors, url }` return ਕਰਦਾ ਹੈ, ਜਾਂ `null`।
  - `type` `"short" | "long" | "post" | "unknown"` ਹੈ।
  - `authors` ਉਸ URL ਤੋਂ detect ਹੋ ਸਕਣ ਵਾਲੇ normalized authors ਦੀ list ਹੈ।
- `getType(urlOrHost)` — `detect(...).type` ਲਈ shortcut।
- `getPlatform(urlOrHost)` — `detect(...).platform` ਲਈ shortcut।
- `getAuthors(urlOrHost)` — `detect(...).authors` ਲਈ shortcut।
- `matchesAuthor(urlOrHost, platform, authors)` — ਜੇ URL ਉਸ platform 'ਤੇ ਹੈ ਅਤੇ ਦਿੱਤੇ authors ਵਿੱਚੋਂ ਕੋਈ match ਕਰਦਾ ਹੈ ਤਾਂ `true`।

### 11.4 Examples

Easy: weekday mornings ਵਿੱਚ social media block ਕਰੋ।

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Medium: ਹਰ browser session ਵਿੱਚ YouTube ਲਈ 30 minutes, visible countdown ਨਾਲ।

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper } = helpers;
  let id = persistenceHelper.get("youtubeTimer");

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer("youtube.com", 30 * 60 * 1000, "YouTube");
    persistenceHelper.set("youtubeTimer", id);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, "youtube.com"];
  }

  return blockedDomains;
}
```

Harder: TikTok session ਨੂੰ ਸਿਰਫ ਉਸ ਵੇਲੇ block ਕਰੋ ਜਦੋਂ ਉਹ short videos ਹੋਣ ਅਤੇ author ਤੁਹਾਡੀ distractor list ਵਿੱਚ ਹੋਵੇ। `platformHelper` ਵਰਤੋ।

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { platformHelper, logHelper } = helpers;
  const distractors = ["someuser", "anotheruser"];
  const url = "https://www.tiktok.com" + (globalThis.location?.pathname ?? "");
  const ctx = platformHelper.detect(url);

  if (ctx?.platform === "tiktok" && ctx.type === "short") {
    if (platformHelper.matchesAuthor(url, "tiktok", distractors)) {
      logHelper.log("Blocking TikTok short by", ctx.authors);
      return [...blockedDomains, "tiktok.com"];
    }
  }

  return blockedDomains;
}
```

(`globalThis.location` ਸਿਰਫ placeholder example ਹੈ — ਆਮ ਤੌਰ 'ਤੇ ਤੁਸੀਂ `platformHelper` ਨੂੰ ਆਪਣੀ logic ਨਾਲ drive ਕਰੋਗੇ, worker ਦੀ location ਨਾਲ ਨਹੀਂ, ਕਿਉਂਕਿ background worker ਕੋਲ real page URL ਨਹੀਂ ਹੁੰਦਾ।)

Hardest: daily cap ਨਾਲ rotating "site of the day", ਜੋ restarts ਤੋਂ ਬਾਅਦ ਵੀ persist ਰਹੇ।

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper, domainHelper, logHelper } = helpers;
  const sites = ["reddit.com", "twitter.com", "news.ycombinator.com"];
  const today = `${month}-${dayOfMonth}`;
  const lastDay = persistenceHelper.get("lastDay");

  if (today !== lastDay) {
    for (const id of timerHelper.list().map((t) => t.id)) {
      timerHelper.deleteTimer(id);
    }
    persistenceHelper.set("lastDay", today);
  }

  const site = sites[(month + dayOfMonth) % sites.length];
  let id = persistenceHelper.get(`timer:${site}`);

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer(site, 20 * 60 * 1000, `${site} budget`);
    persistenceHelper.set(`timer:${site}`, id);
    logHelper.log("Started budget for", site);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, domainHelper.normalize(site)];
  }

  return blockedDomains;
}
```

---

## 12. Multi-page behavior

- ਇੱਕੋ group ਦੀਆਂ ਸਾਰੀਆਂ open tabs ਇੱਕੋ timer share ਕਰਦੀਆਂ ਹਨ।
- ਜਦੋਂ ਤੁਸੀਂ same group ਦੀ tab 'ਤੇ switch ਕਰਦੇ ਹੋ, overlay ਤੁਰੰਤ refresh ਹੁੰਦੀ ਹੈ ਅਤੇ current shared time ਦਿਖਾਉਂਦੀ ਹੈ।
- ਨਵਾਂ rule add ਹੋਣ 'ਤੇ ਹਰ open page fraction of a second ਵਿੱਚ change detect ਕਰਕੇ refresh ਕਰਦੀ ਹੈ; tabs manually reload ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ।
- ਜਦੋਂ rule expire ਹੁੰਦਾ ਹੈ, hidden feed cards ਅਤੇ nav buttons next refresh 'ਤੇ restore ਹੋ ਜਾਂਦੇ ਹਨ।

---

## 13. Internationalization

ਪੂਰੀ UI fully translated ਹੈ। Top-right ਵਿੱਚ **Language** picker ਵਰਤੋ।

Supported languages ਵਿੱਚ English, Chinese (Simplified), Spanish, Japanese, Korean ਸ਼ਾਮਲ ਹਨ, ਅਤੇ Hindi, Arabic, Bengali, Portuguese, Russian, Punjabi, German, French, Turkish, Vietnamese, Italian, Thai, Dutch, Polish, Indonesian, Urdu, ਅਤੇ Persian ਲਈ partial coverage ਹੈ। ਜਿੱਥੇ strings missing ਹੁੰਦੀਆਂ ਹਨ, ਉੱਥੇ English fallback ਹੁੰਦੀ ਹੈ।

Instruction manual ਖੁਦ ਤੁਹਾਡੀ selected language ਦੇ markdown file ਨੂੰ load ਕਰਦੀ ਹੈ, English fallback ਨਾਲ।

---

## 14. Status messages

Status messages centered toast ਵਜੋਂ ਦਿਖਦੀਆਂ ਹਨ ਜੋ ਲਗਭਗ ਦੋ seconds ਬਾਅਦ fade out ਹੁੰਦੀਆਂ ਹਨ:

- "Saved changes."
- "Created \"Group name\"."
- Validation errors ਜਿਵੇਂ "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

Format requirements ਵਾਲੇ input fields ਲਈ message relevant button ਦੇ ਕੋਲ ਵੀ ਦਿਖਾਈ ਦਿੰਦਾ ਹੈ (snooze ਲਈ)।

---

## 15. Privacy ਅਤੇ storage

- ਸਭ ਕੁਝ local `chrome.storage.local` ਵਿੱਚ store ਹੁੰਦਾ ਹੈ। ਕੋਈ data ਕਿਤੇ send ਨਹੀਂ ਹੁੰਦਾ।
- Stored items ਵਿੱਚ ਇਹ ਸ਼ਾਮਲ ਹਨ: ਤੁਹਾਡੀਆਂ groups, usage timers, last reset times, snooze records, custom timers, ਅਤੇ custom persistent values।
- Extension page content ਨੂੰ ਉਸ ਤੋਂ ਵੱਧ ਨਹੀਂ ਪੜ੍ਹਦੀ ਜਿੰਨਾ page type detect ਕਰਨ ਲਈ ਲੋੜੀਂਦਾ ਹੈ (path/hostname/known DOM markers for video sites)। ਇਹ ਤੁਹਾਡੇ messages, posts, comments, ਜਾਂ private content ਨਹੀਂ ਪੜ੍ਹਦੀ।

---

## 16. Permissions

- `storage` — ਉੱਪਰ ਦਿੱਤੇ data ਲਈ।
- `declarativeNetRequest` — `Default` groups ਦੀ native blocking ਲਈ।
- `alarms` — rule transitions ਨੂੰ efficiently schedule ਕਰਨ ਲਈ।
- `host_permissions: <all_urls>` — ਤਾਂ ਜੋ content script ਕਿਸੇ ਵੀ page 'ਤੇ timer overlay ਦਿਖਾ ਸਕੇ ਅਤੇ platform context detect ਕਰ ਸਕੇ।

---

## 17. Troubleshooting

- **ਜੋ group ਮੈਂ add ਕੀਤੀ, ਉਹ ਕੁਝ ਨਹੀਂ ਕਰਦੀ।** ਯਕੀਨੀ ਬਣਾਓ group enabled ਹੈ, schedule ਇਸ ਵੇਲੇ allow ਕਰਦਾ ਹੈ, ਕੋਈ snooze active ਨਹੀਂ, ਅਤੇ (platform groups ਲਈ) page ਚੁਣੇ content type ਅਤੇ author filter ਨਾਲ match ਕਰਦੀ ਹੈ।
- **ਇੱਕ tab ਵਿੱਚ timer ਅਟਕਿਆ/ਗਲਤ ਹੈ।** Tab ਤੋਂ ਬਾਹਰ ਜਾ ਕੇ ਵਾਪਸ ਆਓ, ਜਾਂ tab focus ਕਰੋ — ਇਹ shared timer ਤੋਂ forced refresh trigger ਕਰਦਾ ਹੈ।
- **Feed cards ਵਾਪਸ ਆ ਜਾਂਦੀਆਂ ਹਨ ਜਦਕਿ hide ਹੋਣੀਆਂ ਚਾਹੀਦੀਆਂ ਹਨ।** Feed hiding ਸਿਰਫ rule actively block ਕਰਨ ਦੌਰਾਨ ਚਲਦੀ ਹੈ। ਜੇ ਤੁਹਾਡੇ ਕੋਲ `after-minutes` rule ਹੈ, ਤਾਂ hiding time zero ਹੋਣ ਤੋਂ ਬਾਅਦ ਚਾਲੂ ਹੁੰਦੀ ਹੈ।
- **YouTube ਦਾ nav button ਜੋ hide ਹੋਣਾ ਸੀ, ਅਜੇ ਵੀ ਦਿਖਦਾ ਹੈ।** Nav hiding ਲਈ rule "do not filter by author" 'ਤੇ ਹੋਣਾ ਲਾਜ਼ਮੀ ਹੈ ਅਤੇ content type Shorts ਜਾਂ YouTube posts ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ। Author filters ਨਾਲ hiding per-card ਹੀ ਹੁੰਦੀ ਹੈ।
- **Custom rule ਨੇ ਕੁਝ ਨਹੀਂ ਕੀਤਾ ਜਾਂ ਚੁੱਪਚਾਪ throw ਹੋਈ।** `chrome://extensions` ਖੋਲ੍ਹੋ, Developer Mode enable ਕਰੋ, extension ਦੇ "service worker" link 'ਤੇ click ਕਰੋ, ਅਤੇ console ਵੇਖੋ। Rule trace ਕਰਨ ਲਈ `helpers.logHelper.log(...)` ਵਰਤੋ।
- **ਮੈਂ group delete ਨਹੀਂ ਕਰ ਸਕਦਾ/ਸਕਦੀ।** ਸ਼ਾਇਦ ਇਹ frozen ਹੈ। Strict-frozen groups lock expire ਹੋਣ ਤੱਕ delete ਨਹੀਂ ਹੁੰਦੀਆਂ; non-strict frozen groups unfreeze ritual ਰਾਹੀਂ delete ਹੋ ਸਕਦੀਆਂ ਹਨ।

---

## 18. Glossary

- **Block group** — ਇੱਕ rule set ਜਿਸਦਾ ਆਪਣਾ type, behavior, schedule, ਅਤੇ freeze/snooze ਹੁੰਦਾ ਹੈ।
- **Instant block** — rule active ਹੋਣ ਨਾਲ ਹੀ ਤੁਰੰਤ block ਕਰਦੀ ਹੈ।
- **After-minutes block** — rule period ਦਾ time budget ਖਤਮ ਹੋਣ ਤੋਂ ਬਾਅਦ ਹੀ block ਕਰਦੀ ਹੈ।
- **Reset interval** — after-minutes budget ਕਿੰਨੀ ਵਾਰ reset ਹੁੰਦਾ ਹੈ।
- **Schedule** — ਦਿਨ + time windows ਜਿਨ੍ਹਾਂ ਦੌਰਾਨ group active ਹੁੰਦੀ ਹੈ।
- **Freeze / Strict freeze** — anti-tampering states।
- **Snooze** — ਲਿਖਤੀ justification ਨਾਲ temporary disable।
- **Author filter** — platform groups ਲਈ rule ਨੂੰ ਕੁਝ content creators ਤੱਕ ਸੀਮਿਤ ਕਰਦਾ ਹੈ।
- **Content type** — platform groups ਲਈ rule ਨੂੰ ਕੁਝ content forms (short, long, post) ਤੱਕ ਸੀਮਿਤ ਕਰਦਾ ਹੈ।
- **Helpers** — custom rule function ਨੂੰ ਦਿੱਤੀਆਂ utilities।
- **Platform** — `youtube`, `tiktok`, `facebook`, `instagram`, `twitch` ਵਿੱਚੋਂ ਇੱਕ। ਹਰ ਇੱਕ ਦਾ ਆਪਣਾ group type ਅਤੇ feed hiding logic ਹੁੰਦਾ ਹੈ।

---

## 19. Limitations

- Feed hiding ਹਰ platform ਦੇ current DOM 'ਤੇ ਨਿਰਭਰ ਕਰਦੀ ਹੈ। ਜੇ platform ਆਪਣਾ layout ਬਦਲ ਦੇਵੇ, ਤਾਂ hiding selectors update ਕਰਨੇ ਪੈ ਸਕਦੇ ਹਨ।
- Non-YouTube sites ਲਈ platform context detection ਜ਼ਿਆਦਾਤਰ URL-based ਹੈ, ਇਸ ਲਈ canonical content URLs 'ਤੇ ਸਭ ਤੋਂ ਭਰੋਸੇਯੋਗ ਹੁੰਦੀ ਹੈ।
- Custom rule loops background worker ਵਿੱਚ ਚਲਦੀਆਂ ਹਨ, pages ਵਿੱਚ ਨਹੀਂ, ਇਸ ਲਈ function ਦੇ ਅੰਦਰ DOM-level information available ਨਹੀਂ ਹੁੰਦੀ। ਇਸਦੀ ਬਜਾਏ URL string ਨਾਲ `platformHelper.detect(url)` ਵਰਤੋ।
- Browser idle ਵੇਲੇ service worker suspend ਕਰ ਸਕਦਾ ਹੈ। Page ਜਾਂ alarm ਨੂੰ ਜ਼ਰੂਰਤ ਹੋਣ 'ਤੇ extension ਇਸਨੂੰ ਤੁਰੰਤ resume ਕਰਦੀ ਹੈ; usage timers ਦੀ accuracy ਇਸ ਕਾਰਨ ਨਹੀਂ ਘਟਦੀ।

