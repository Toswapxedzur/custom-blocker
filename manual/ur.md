# کسٹم ویب بلاکر — ہدایت نامہ

یہ ایکسٹینشن کا مکمل حوالہ جاتی دستی ہے۔ یہ آسان اور عام ورک فلو سے شروع ہوتا ہے، پھر آہستہ آہستہ ایڈوانس موضوعات جیسے کسٹم JavaScript بلاکنگ رولز اور helper API تک جاتا ہے۔

اگر آپ بالکل نئے ہیں تو صرف **Quick start** اور **Block groups overview** پڑھیں۔ ان سیکشنز کے بعد والی ہر چیز اختیاری ہے، یہ آپ کی ضرورت پر منحصر ہے۔

---

## 1. یہ ایکسٹینشن کیا کرتی ہے

Custom Web Blocker آپ کو اپنی مرضی کے قوانین کے مطابق ویب سائٹس اور آن لائن توجہ بٹانے والی چیزیں بلاک کرنے دیتی ہے۔ آپ:

- براؤزر کی native network blocking سے سائٹس فوراً بلاک کر سکتے ہیں (وہی قسم کی بلاکنگ جو `ERR_BLOCKED_BY_CLIENT` دیتی ہے)۔
- کسی سائٹ پر روزانہ مخصوص منٹس کی اجازت دے سکتے ہیں، اور حد سے بڑھنے پر بلاک کر سکتے ہیں۔
- YouTube، TikTok، Facebook، Instagram، Twitch، اور Reddit پر مخصوص قسم کا مواد بلاک کر سکتے ہیں (پورا پلیٹ فارم نہیں)۔
- سپورٹڈ پلیٹ فارمز پر بلاک شدہ مواد فیڈ سے چھپا سکتے ہیں، صرف سنگل پیجز بلاک کرنے کے بجائے۔
- رول کے فعال ہونے کا شیڈول ہفتے کے دنوں اور `HHMM-HHMM` ٹائم ونڈوز کے مطابق بنا سکتے ہیں۔
- رول کو freeze کر سکتے ہیں تاکہ آسانی سے تبدیل نہ ہو۔ Strict freeze اسے مقررہ گھنٹوں کے لیے لاک کرتی ہے اور کھولنے کے لیے 20-step confirmation ritual ضروری بناتی ہے۔
- رول کو عارضی طور پر snooze کر سکتے ہیں، لیکن صرف تب جب آپ مناسب لمبی وجہ لکھیں۔
- timers، persistent storage، platform detection، domain matching، اور logging helpers کے ساتھ custom JavaScript blocking rules لکھ سکتے ہیں۔
- ایکسٹینشن کو 20+ زبانوں میں استعمال کر سکتے ہیں۔

یہ Chrome Manifest V3 ایکسٹینشن ہے، جس میں ایک editor page (popup)، ایک background service worker، اور ایک content script شامل ہے جو ہر پیج پر چلتی ہے۔

---

## 2. UI کا تعارف

جب آپ ایکسٹینشن آئیکن پر کلک کرتے ہیں تو editor ایک مکمل ویب پیج کے طور پر کھلتا ہے (چھوٹا popup نہیں)۔ اس پیج کے یہ حصے ہیں:

- **Top bar**
  - **Instruction Manual** بٹن (یہی دستاویز)
  - **Language** picker
- **Left panel — Block Groups**
  - آپ کی block groups کی فہرست۔ ہر کارڈ میں group name، مختصر summary line، اور enable/disable checkbox ہوتا ہے۔
  - **Add** بٹن نئی group بناتا ہے۔ اس کے ساتھ dropdown type منتخب کرتا ہے۔
  - **Delete All** تمام groups حذف کرتا ہے، اگر کوئی group frozen ہو تو اضافی confirmations آتی ہیں۔
  - آپ کارڈ کے `::` handle کو اوپر/نیچے drag کر کے ترتیب بدل سکتے ہیں۔
  - آپ vertical splitter drag کر کے پینل کا سائز بدل سکتے ہیں۔
- **Right panel — Editor**
  - منتخب group کی ترمیم: name، blocking behavior، blocklists، type-specific filters، schedule، freeze، snooze۔
  - typing یا interaction رکنے کے تھوڑے وقت بعد تمام تبدیلیاں خودکار محفوظ ہو جاتی ہیں۔
- **Toast** (درمیان میں ابھرنے والا popup جو fade ہوتا ہے)
  - "Saved changes" یا input errors جیسے status messages دکھاتا ہے۔

جب کوئی پیج بلاک ہو رہا ہو یا active timer ہو تو اس کے اوپر بائیں کونے میں overlay آتا ہے، جو تمام فعال time constraints کو `hh:mm:ss` (یا `mm:ss`) فارمیٹ میں دکھاتا ہے۔ متعدد constraints الگ الگ لائنوں میں دکھتی ہیں۔

---

## 3. Quick start

1. ایکسٹینشن آئیکن پر کلک کریں۔ Editor مکمل پیج کے طور پر کھلے گا۔
2. **Block Groups** پینل میں dropdown سے group type منتخب کریں:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit`, یا `Custom`۔
3. **Add** پر کلک کریں۔ نئی group بنے گی اور editor اسے کھول دے گا۔
4. اس کا نام رکھیں۔
5. type-specific fields بھریں (مثلاً `Default` کے لیے **Blocked websites** list)۔
6. یقینی بنائیں کہ left panel میں group کا checkbox آن ہے۔
7. لسٹ میں دی گئی کسی سائٹ پر جائیں۔ بلاک فوراً لاگو ہو جانا چاہیے۔

یہی پورا happy path ہے۔ باقی دستی اسی پر اضافی اختیارات کی وضاحت ہے۔

---

## 4. Block groups کا خلاصہ

اس ایکسٹینشن میں ہر چیز **block groups** میں منظم ہے۔ ایک block group ایک rule set ہوتی ہے:

- اس کا name، type، اور enabled/disabled state ہوتا ہے۔
- اس میں blocking behavior ہوتا ہے (فوراً یا چند منٹس بعد)۔
- اس میں optional schedule (دن + time windows) اور optional freeze/snooze controls ہوتے ہیں۔
- type کے حساب سے اضافی fields ہوتی ہیں جیسے websites list، YouTube creator filters، subreddit names، یا JavaScript function۔

آپ جتنی چاہیں groups رکھ سکتے ہیں۔ ایک ہی پیج پر متعدد groups لاگو ہو سکتی ہیں؛ ایسی صورت میں **سب سے سخت** rule جیتتی ہے:

- "Block immediately" ، "block after some time" سے زیادہ سخت ہے۔
- جس group کا باقی وقت کم ہو وہ زیادہ سخت سمجھی جاتی ہے۔

اس لیے مزید groups شامل کرنے سے پیج صرف جلدی بلاک ہوگا، دیر سے نہیں۔

آپ groups کو `::` handle سے drag کر کے ترتیب بدل سکتے ہیں۔ ترتیب سختی کا فیصلہ نہیں بدلتی، مگر فہرست کی پڑھنے کی ترتیب کنٹرول کرتی ہے۔

---

## 5. Group types

### 5.1 `Default` — عام ویب سائٹس بلاک کرنا

مخصوص domains بلاک کرنے کے لیے (عام استعمال)۔

- **Blocked websites**: ہر لائن میں ایک سائٹ۔ `facebook.com` اور `https://www.facebook.com/somepage` دونوں چلتے ہیں؛ ایکسٹینشن hostname نکال کر normalize کرتی ہے۔
- site rule اس hostname اور اس کی تمام subdomains پر لاگو ہوتی ہے۔
- یہ type Chrome کی native network blocking استعمال کرتی ہے، `ERR_BLOCKED_BY_CLIENT` جیسی۔ یعنی blocked URL پر navigation پیج لوڈ ہونے سے پہلے رک جاتی ہے۔

### 5.2 `YouTube` — YouTube اور ملتی جلتی ویڈیو سائٹس بلاک کرنا

Editor میں **Filters** سیکشن شامل کرتا ہے:

- **Content type**:
  - `Apply to all YouTube pages` — ہر YouTube پیج شمار ہوگا۔
  - `Apply to Shorts` — صرف Shorts پیجز شمار ہوں گے۔
  - `Apply to long videos` — صرف `/watch`, `/live/`, `/embed/` وغیرہ۔
  - `Apply to YouTube posts` — community posts (`/post/...`, channel community/posts tabs)۔
- **Author filter**:
  - `Do not filter by author` — author کی شناخت اہم نہیں۔
  - `Apply to certain authors` — صرف listed authors پر یہ group لاگو ہوگی۔
  - `Apply to all except certain authors` — listed authors مستثنیٰ ہوں گے۔
- **Authors**: ہر لائن میں ایک author۔ `@handle`, full URLs, `/channel/UC...`, `/c/...`, `/user/...` قبول ہیں۔
- **Hide blocked entries in the YouTube feed**: جب یہ group فعال طور پر بلاک کر رہی ہو، YouTube feed میں matching cards چھپ جاتی ہیں۔ بلاک غیر فعال ہونے پر اگلی refresh میں واپس آتی ہیں۔

Shorts اور Posts content types میں، اگر author filter نہ ہو اور group فعال بلاکنگ میں ہو، تو ایکسٹینشن متعلقہ nav entries (Shorts sidebar entry، Community/Posts tabs) اور matching shelves جیسے "Latest YouTube posts" بھی چھپا دیتی ہے۔

short-vs-long detection دوسرے ویڈیو پلیٹ فارمز جیسے TikTok، Vimeo، Twitch clips/VODs، اور Dailymotion پر بھی لاگو ہوتی ہے جب ان کی page form detect ہو سکے۔

### 5.3 `TikTok` — TikTok مواد بلاک کرنا

ویڈیو پلیٹ فارم editor جیسا ہی کارڈ، مگر TikTok-specific labels کے ساتھ:

- Content types: short videos، videos، profile pages۔
- Authors: TikTok handles (`@handle`) یا profile URLs۔
- Feed hiding فعال ہونے پر TikTok پیجز میں matching cards چھپا دیتی ہے۔

### 5.4 `Facebook` — Facebook مواد بلاک کرنا

- Content types: Reels، videos، posts۔
- Authors: page name (`page.name`)، profile URL، یا `profile.php?id=...` فارمیٹ (عددی id `id:<number>` کے طور پر محفوظ)۔
- Feed hiding Facebook میں matching feed cards چھپا دیتی ہے۔

### 5.5 `Instagram` — Instagram مواد بلاک کرنا

- Content types: Reels، videos، posts۔
- Authors: Instagram handles یا profile URLs۔
- reserved paths جیسے `/reel/`, `/p/`, `/tv/`, `/explore/` کو author نہیں سمجھا جاتا۔
- Feed hiding Instagram میں matching cards چھپا دیتی ہے۔

### 5.6 `Twitch` — Twitch مواد بلاک کرنا

- Content types: clips، streams/VODs، channel pages۔
- Authors: channel names یا channel URLs۔
- reserved paths جیسے `/directory`, `/videos`, `/settings` وغیرہ کو channel names نہیں سمجھا جاتا۔
- Feed hiding Twitch میں matching cards چھپا دیتی ہے۔

### 5.7 `Reddit` — Reddit یا مخصوص subreddits بلاک کرنا

- **Subreddits**: ہر لائن میں ایک subreddit۔ خالی list کا مطلب group پورے Reddit پر لاگو ہوگی۔ `productivity` اور `r/productivity` دونوں قابل قبول ہیں۔

### 5.8 `Custom` — JavaScript function کے ذریعے بلاکنگ

آپ JavaScript function لکھتے ہیں۔ ایکسٹینشن اسے تقریباً ہر سیکنڈ کال کرتی ہے اور واپسی کو موجودہ blocklist کے طور پر استعمال کرتی ہے۔

`Custom` groups میں یہ چیزیں نہیں ہوتیں: blocking behavior، blocked sites، allowed minutes، reset interval، schedule days، یا time windows۔ ان میں صرف ایک بڑا input ہوتا ہے — **Blocking Rules** function — ساتھ معیاری freeze/snooze controls۔

custom rules اور helpers API کی مکمل تفصیل کے لیے **Section 11** دیکھیں۔

---

## 6. Blocking behavior

زیادہ تر group types میں آپ دو modes میں سے ایک منتخب کرتے ہیں:

### 6.1 فوراً بلاک کریں

Rule تب فعال ہوتی ہے جب group آن ہو، schedule اجازت دے، اور (platform groups کے لیے) page match کرے۔

`Default` groups میں یہ Chrome native blocking استعمال کرتی ہے۔ platform groups میں page overlay/exit logic استعمال ہوتی ہے۔

### 6.2 مخصوص منٹس کے بعد بلاک کریں

یہ usage budget ہے۔

- **Allowed minutes before block** (decimal): ہر period میں کتنے منٹس کی اجازت۔ مثال: `15`, `0.5`, `90`۔
- **Timer reset interval (hours)** (decimal): budget کتنی بار reset ہوگا۔ مثال: `24` روزانہ، `1` ہر گھنٹے، `0.25` ہر 15 منٹ۔

جب تک وقت باقی ہو، page معمول کے مطابق چلتا ہے اور timer overlay دکھاتا ہے۔ budget صفر ہوتے ہی، باقی period کے لیے page بلاک ہو جاتا ہے اور overlay `0:00` دکھاتا ہے، پھر tab exit کی کوشش کرتی ہے۔

ایکسٹینشن per-group اور per-period کام کرتی ہے:

- ہر group کا اپنا budget ہوتا ہے۔
- group سے match ہونے والے کسی بھی page پر صرف ہونے والا وقت اسی group budget میں شمار ہوتا ہے۔
- ایک ہی group کی متعدد tabs ایک budget شیئر کرتی ہیں۔ ان کے timers synchronized رہتے ہیں؛ دوسری tab پر سوئچ کرنے سے forced refresh ہوتی ہے تاکہ فوری shared time دکھے۔

اگر ایک page پر متعدد time-limited groups لاگو ہوں تو سب سے سخت والی جیتتی ہے۔

---

## 7. Schedule

**Schedule** card میں آپ group کے فعال ہونے کا وقت محدود کر سکتے ہیں:

- **Days to block**: وہ دن منتخب کریں جن میں group لاگو ہوگی۔ unchecked دنوں میں group غیر فعال رہے گی۔
- **Time windows**: آزاد فہرست، ہر لائن میں ایک window `HHMM-HHMM` فارمیٹ میں، مثلاً:

  ```
  0900-1000
  1200-1300
  ```

  group صرف انہی windows کے اندر فعال ہوگی۔ خالی list کا مطلب پورا دن۔

یہ تمام group types پر لاگو ہے سوائے `Custom` کے۔

---

## 8. Freeze (چھیڑ چھاڑ سے تحفظ)

Freeze group کو فوری جذباتی طور پر disable کرنا مشکل بنا دیتی ہے۔

**Freeze** card میں آپ منتخب کرتے ہیں:

- **Frozen** — آپ group edit یا delete نہیں کر سکتے، اور enable toggle بھی off نہیں کر سکتے۔ کوئی تبدیلی کرنے کے لیے unfreeze ritual چلانا ہوگا (نیچے دیکھیں)۔
- **Strict frozen** — Frozen جیسا ہی، مگر آپ کی منتخب کردہ گھنٹوں (decimal، زیادہ سے زیادہ 72) تک لاک رہتی ہے۔ جب تک یہ وقت پورا نہ ہو، unfreeze ritual بھی دستیاب نہیں۔

جب frozen group unlock کے قابل ہو، **Unfreeze** بٹن ظاہر ہوتا ہے۔ اسے کلک کرنے سے **20-step ritual** شروع ہوتا ہے:

- modal میں self-discipline message دکھایا جاتا ہے۔
- آپ کو `Confirm` 20 بار کلک کرنا ہوتا ہے۔
- ہر کلک کے درمیان لازمی 5 سیکنڈ انتظار ہے۔
- کسی بھی مرحلے پر cancel کرنے کی صورت میں step 1 سے دوبارہ شروع کرنا ہوگا۔
- 20 messages rotate ہوتے ہیں تاکہ آپ واقعی پڑھیں۔

اگر group پر "no snooze" بھی منتخب ہو (اگلا سیکشن)، frozen حالت میں snooze بھی نہیں کیا جا سکتا۔

freeze status group card کی meta line میں دکھائی جاتی ہے، strict freeze کا باقی وقت بھی شامل ہوتا ہے۔

---

## 9. Snooze (عارضی disable)

Snooze group کو unfreeze کیے بغیر عارضی طور پر disable کرتی ہے، مگر صرف تحریری وجہ کے ساتھ۔

**Snooze** card میں:

- **Allow snooze for this group** — اگر off ہو تو یہ group بالکل snooze نہیں ہو سکتی (frozen حالت سمیت)۔
- **Snooze for (minutes)** — decimal، snooze کتنی دیر چلے گی۔
- **Reason** — **کم از کم 100 حروف اور 20 سے زیادہ الفاظ** لازمی ہیں۔ Start بٹن تب تک disable رہے گا جب تک دونوں شرطیں پوری نہ ہوں۔ شرط ناکام ہونے پر بٹن کے پاس inline warning آتی ہے۔

اگر group frozen ہو تو snooze minutes وہی رہتی ہیں جو freeze سے پہلے منتخب کی گئی تھیں۔ پھر بھی snooze ممکن ہے، بشرطیکہ snooze allowed ہو اور reason قواعد پوری کرے۔

status message snooze کی تصدیق دیتا ہے۔ snooze ختم ہونے پر group خودکار طور پر معمول پر آ جاتی ہے۔

آپ **End Snooze** بٹن سے snooze جلدی بھی ختم کر سکتے ہیں۔

---

## 10. Bulk actions

- **Delete All** تمام groups ہٹا دیتا ہے۔
  - ہمیشہ confirmation مانگتا ہے۔
  - اگر کم از کم ایک group frozen ہو تو unfreeze والا ہی 20-step ritual درکار ہوتا ہے۔
  - اگر کوئی group strict-frozen ہو اور ابھی locked ہو تو **Delete All** disabled رہتا ہے۔

---

## 11. Custom groups (مکمل حوالہ)

`Custom` group background service worker میں JavaScript function چلاتی ہے۔ function تقریباً ہر سیکنڈ کال ہوتی ہے، اور ایکسٹینشن واپسی کی بنیاد پر فیصلہ کرتی ہے کہ ابھی کون سے domains بلاک ہونے چاہییں۔

### 11.1 Function signature

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parameters:

- `month` — `1` سے `12`۔
- `dayOfMonth` — `1` سے `31`۔
- `dayName` — مثال `"Monday"`۔
- `hour` — `0` سے `23`۔
- `minute` — `0` سے `59`۔
- `blockedDomains` — domains کی جاری فہرست جو دوسری rules پہلے بنا چکی ہیں۔ آپ اس میں اضافہ، تبدیلی، یا نظر انداز کر سکتے ہیں۔
- `helpers` — helper objects کا مجموعہ (نیچے دیکھیں)۔

واپسی:

- domain strings کی array جو ابھی بلاک ہونی چاہییں، یا
- کچھ بھی return نہ کریں (اس صورت میں ایکسٹینشن mutated `blockedDomains` استعمال کرے گی)۔

function save کے وقت validate ہوتی ہے۔ syntax errors پر status warning آتی ہے اور rule تب تک استعمال نہیں ہوتی جب تک درست نہ کریں۔ اگر runtime پر function error throw کرے تو ایکسٹینشن اسے catch کر کے background console میں log کرتی ہے اور پچھلے result پر واپس آ جاتی ہے۔

### 11.2 Adaptive scheduling

عام طور پر custom rules تقریباً ہر سیکنڈ چلتی ہیں۔ اگر rule زیادہ وقت لینے لگے تو ایکسٹینشن loop خودکار طور پر سست کرتی ہے (تقریباً ہر 5 سیکنڈ تک)۔ یہ آپ کو خود manage نہیں کرنا پڑتا۔

### 11.3 `helpers` object

function کے اندر `helpers` کئی sub-helpers دیتی ہے۔ ہر helper کا long name اور short alias موجود ہے۔ explicit getter methods بھی ہیں:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — موجودہ epoch time milliseconds میں۔

تمام helper methods محفوظ طریقے سے بنائی گئی ہیں: غلط parameters پر exception کے بجائے `null`, `false`, یا empty value دیتی ہیں۔

#### 11.3.1 `timerHelper`

domain سے منسلک countdown timers کو manage کرتی ہے۔ timers browser restart کے بعد بھی برقرار رہتی ہیں۔ ہر timer اسی custom group کی ملکیت ہوتی ہے جس نے اسے بنایا ہو۔

- `createTimer(domain, durationMs, displayName?)` — unique timer id بناتی اور دیتی ہے، غلط ہونے پر `null`۔ مثال: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`۔ user جب matching domain والے page پر ہو تو overlay `Timer1: 30:00` دکھا کر countdown کرتی ہے۔
- `deleteTimer(id)` — timer حذف کرتی ہے۔ کامیابی پر `true`۔
- `pauseTimer(id)` — countdown pause۔
- `continueTimer(id)` / `resumeTimer(id)` — paused timer resume۔
- `resetTimer(id, durationMs?)` — timer دوبارہ شروع۔ `durationMs` نہ ہو تو اصل duration۔
- `addMs(id, ms)` — milliseconds شامل (یا منفی سے کم)۔
- `remainingMs(id)` — باقی milliseconds۔
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — booleans۔
- `getDomain(id)` / `getDisplayName(id)` — timer info پڑھیں۔
- `findByDomain(domain)` — اس domain کے timer ids کی array۔
- `list()` — ہر timer کے لیے `{ id, domain, displayName, durationMs, remainingMs, isPaused }` کی array جو اس group کی ملکیت ہو۔

timer کی زیادہ سے زیادہ مدت تقریباً 30 دن ہے۔

#### 11.3.2 `persistenceHelper`

آپ کی group scope میں map جیسا storage۔ values JSON-serializable ہونی چاہییں۔ calls کے درمیان state یاد رکھنے کے لیے مفید۔

- `set(key, value)` — کوئی بھی JSON value store کرتا ہے۔ کامیابی پر `true`۔
- `get(key, defaultValue?)` — stored value دیتا ہے، ورنہ `defaultValue`۔
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`۔

soft limits: تقریباً 200 keys فی group، 16 KB فی value۔

#### 11.3.3 `domainHelper`

- `normalize(value)` — canonical domain جیسے `youtube.com` واپس کرتا ہے، یا `null`۔
- `matches(hostname, site)` — اگر `hostname` ، `site` سے تعلق رکھتا ہو (subdomains سمیت) تو `true`۔

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — background console میں لکھتی ہیں۔

یہ messages دیکھنے کے لیے: `chrome://extensions` → Developer Mode enable کریں → ایکسٹینشن کے "service worker" لنک پر کلک کریں۔

#### 11.3.5 `platformHelper`

سپورٹڈ social/video platforms کا معائنہ:

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`۔
- `normalizePlatform(value)` — canonical platform name دیتا ہے، یا `null`۔
- `normalizeAuthor(author, platform)` — مخصوص platform کے لیے author identifier (handle، URL وغیرہ) normalize کرتا ہے، یا `null`۔
- `detect(urlOrHost)` / `getContext(urlOrHost)` — `{ platform, hostname, pathname, type, authors, url }` دیتا ہے، یا `null`۔
  - `type` کی قدر `"short" | "long" | "post" | "unknown"`۔
  - `authors` اس URL سے detect ہونے والے normalized authors کی فہرست۔
- `getType(urlOrHost)` — `detect(...).type` کا shortcut۔
- `getPlatform(urlOrHost)` — `detect(...).platform` کا shortcut۔
- `getAuthors(urlOrHost)` — `detect(...).authors` کا shortcut۔
- `matchesAuthor(urlOrHost, platform, authors)` — اگر URL اسی platform پر ہو اور دیے گئے authors میں سے کوئی match کرے تو `true`۔

### 11.4 Examples

آسان: ہفتے کے دنوں کی صبح social media بلاک کریں۔

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

درمیانہ: ہر browser session میں YouTube کے 30 منٹس، visible countdown کے ساتھ۔

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

مشکل: TikTok session صرف تب بلاک کریں جب وہ short videos ہو اور author آپ کی distractor list میں ہو۔ `platformHelper` استعمال کریں۔

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

(`globalThis.location` صرف ایک مثال placeholder ہے — عموماً آپ `platformHelper` کو اپنی logic سے چلائیں گے، worker location سے نہیں، کیونکہ background worker کے پاس حقیقی page URL نہیں ہوتا۔)

سب سے مشکل: روزانہ بدلنے والی "site of the day" جس کی daily cap ہو اور restart کے بعد بھی state محفوظ رہے۔

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

- ایک ہی group کی تمام open tabs ایک timer شیئر کرتی ہیں۔
- جب آپ اسی group کی tab پر سوئچ کرتے ہیں تو overlay فوراً refresh ہو کر shared time دکھاتی ہے۔
- نئی rule شامل ہونے پر تمام open pages تبدیلی شناخت کر کے سیکنڈ کے حصے میں refresh ہو جاتے ہیں؛ tabs manually reload کرنے کی ضرورت نہیں۔
- rule ختم ہونے پر hidden feed cards اور nav buttons اگلی refresh پر بحال ہو جاتے ہیں۔

---

## 13. Internationalization

پورا UI مکمل طور پر ترجمہ شدہ ہے۔ اوپر دائیں **Language** picker استعمال کریں۔

سپورٹڈ زبانوں میں English، Chinese (Simplified)، Spanish، Japanese، Korean شامل ہیں، اور Hindi، Arabic، Bengali، Portuguese، Russian، Punjabi، German، French، Turkish، Vietnamese، Italian، Thai، Dutch، Polish، Indonesian، Urdu، اور Persian کے لیے جزوی کوریج موجود ہے۔ جزوی کوریج والی زبانوں میں missing strings کے لیے English fallback استعمال ہوتی ہے۔

instruction manual خود منتخب زبان کے مطابق markdown file لوڈ کرتی ہے، اور fallback کے طور پر English استعمال کرتی ہے۔

---

## 14. Status messages

status messages مرکز میں toast کے طور پر ظاہر ہوتی ہیں اور تقریباً دو سیکنڈ بعد fade ہو جاتی ہیں:

- "Saved changes."
- "Created \"Group name\"."
- validation errors جیسے "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

فارمیٹ والی input fields کے لیے message متعلقہ بٹن کے ساتھ بھی دکھائی جاتی ہے (snooze کے لیے)۔

---

## 15. Privacy and storage

- تمام data مقامی طور پر `chrome.storage.local` میں محفوظ ہوتا ہے۔ کوئی data کہیں نہیں بھیجا جاتا۔
- محفوظ items میں شامل ہیں: آپ کی groups، usage timers، last reset times، snooze records، custom timers، اور custom persistent values۔
- ایکسٹینشن page content اس حد سے زیادہ نہیں پڑھتی جتنا page type detect کرنے کے لیے ضروری ہو (path/hostname/known DOM markers for video sites)۔ یہ آپ کے messages، posts، comments، یا private content نہیں پڑھتی۔

---

## 16. Permissions

- `storage` — اوپر والے data کے لیے۔
- `declarativeNetRequest` — `Default` groups کی native blocking کے لیے۔
- `alarms` — rule transitions کو مؤثر طریقے سے schedule کرنے کے لیے۔
- `host_permissions: <all_urls>` — تاکہ content script timer overlay دکھا سکے اور کسی بھی page پر platform context detect کر سکے۔

---

## 17. Troubleshooting

- **میں نے group شامل کی مگر کچھ نہیں ہوا۔** یقینی بنائیں group enabled ہے، schedule اس وقت اجازت دے رہا ہے، کوئی snooze active نہیں، اور (platform groups کے لیے) page واقعی منتخب content type اور author filter سے match کرتا ہے۔
- **ایک tab میں timer غلط یا پھنسی ہوئی ہے۔** tab سے ہٹ کر واپس آئیں یا tab focus کریں — اس سے shared timer سے forced refresh ہوتی ہے۔
- **feed cards دوبارہ نظر آ رہی ہیں جبکہ انہیں چھپنا چاہیے تھا۔** feed hiding صرف تب چلتی ہے جب rule فعال بلاکنگ میں ہو۔ اگر `after-minutes` rule ہو تو وقت صفر ہونے پر hiding شروع ہوتی ہے۔
- **YouTube nav button جسے چھپنا چاہیے تھا ابھی بھی موجود ہے۔** nav hiding کے لیے rule "do not filter by author" پر ہونی چاہیے اور content type Shorts یا YouTube posts ہو۔ author filters کے ساتھ hiding صرف per-card ہوتی ہے۔
- **custom rule نے کچھ نہیں کیا یا خاموشی سے error دیا۔** `chrome://extensions` کھولیں، Developer Mode آن کریں، ایکسٹینشن کے "service worker" لنک پر کلک کریں، اور console دیکھیں۔ اپنی rule trace کرنے کے لیے `helpers.logHelper.log(...)` استعمال کریں۔
- **میں group delete نہیں کر سکتا۔** غالباً وہ frozen ہے۔ strict-frozen group لاک ختم ہونے تک delete نہیں ہو سکتی؛ non-strict frozen group unfreeze ritual کے بعد delete ہو سکتی ہے۔

---

## 18. Glossary

- **Block group** — ایک rule set جس کا اپنا type، behavior، schedule، اور freeze/snooze ہو۔
- **Instant block** — rule فعال ہوتے ہی فوراً بلاک کرتی ہے۔
- **After-minutes block** — rule تب بلاک کرنا شروع کرتی ہے جب period کا time budget ختم ہو جائے۔
- **Reset interval** — after-minutes budget کتنی بار reset ہوتا ہے۔
- **Schedule** — دن + time windows جن میں group فعال ہو۔
- **Freeze / Strict freeze** — anti-tampering states۔
- **Snooze** — تحریری وجہ کے ساتھ عارضی disable۔
- **Author filter** — platform groups میں rule کو مخصوص creators تک محدود کرتا ہے۔
- **Content type** — platform groups میں rule کو مخصوص content forms (short, long, post) تک محدود کرتا ہے۔
- **Helpers** — utilities جو custom rule function کو دی جاتی ہیں۔
- **Platform** — `youtube`, `tiktok`, `facebook`, `instagram`, `twitch` میں سے ایک۔ ہر ایک کی اپنی group type اور feed hiding logic ہے۔

---

## 19. Limitations

- feed hiding ہر platform کے موجودہ DOM پر منحصر ہے۔ اگر layout بدل جائے تو hiding selectors اپڈیٹ کرنے پڑ سکتے ہیں۔
- non-YouTube sites کے لیے platform context detection زیادہ تر URL-based ہے، اس لیے canonical content URLs پر زیادہ reliable ہے۔
- custom rule loops background worker میں چلتی ہیں، pages میں نہیں، اس لیے function کے اندر DOM-level معلومات دستیاب نہیں ہوتیں۔ اس کے بجائے URL string کے ساتھ `platformHelper.detect(url)` استعمال کریں۔
- browser idle ہونے پر service worker suspend کر سکتا ہے۔ extension جیسے ہی page یا alarm کو ضرورت ہو اسے resume کر دیتی ہے؛ usage timers کی درستگی برقرار رہتی ہے۔
