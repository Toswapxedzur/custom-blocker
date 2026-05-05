# مسدودکننده سفارشی وب — راهنمای کاربری

این راهنمای مرجع کامل افزونه است. از ساده‌ترین و رایج‌ترین روندها شروع می‌کند و به‌تدریج به موضوعات پیشرفته‌تر مثل قوانین مسدودسازی سفارشی JavaScript و API کمکی می‌رسد.

اگر کاملاً تازه‌کار هستید، فقط بخش‌های **Quick start** و **Block groups overview** را بخوانید. همه چیز بعد از این دو بخش اختیاری است و به نیاز شما بستگی دارد.

---

## 1. این افزونه چه کاری انجام می‌دهد

Custom Web Blocker به شما امکان می‌دهد وب‌سایت‌ها و عوامل حواس‌پرتی آنلاین را بر اساس قوانینی که خودتان تعریف می‌کنید مسدود کنید. می‌توانید:

- سایت‌ها را فوراً با مسدودسازی شبکه بومی مرورگر مسدود کنید (همان نوعی که خطای `ERR_BLOCKED_BY_CLIENT` می‌دهد).
- برای خودتان تعداد مشخصی دقیقه در روز برای یک سایت مجاز کنید و بعد از عبور از حد، آن را مسدود کنید.
- نوع‌های خاصی از محتوا را در YouTube، TikTok، Facebook، Instagram، Twitch و Reddit مسدود کنید (نه کل سایت را).
- محتوای مسدودشده را در فید پلتفرم‌های پشتیبانی‌شده پنهان کنید، نه اینکه فقط صفحه‌های تکی را ببندید.
- زمان فعال بودن قانون را بر اساس روزهای هفته و بازه‌های زمانی `HHMM-HHMM` زمان‌بندی کنید.
- یک قانون را freeze کنید تا به‌راحتی قابل تغییر نباشد. حالت strict freeze آن را برای تعداد ساعت مشخصی قفل می‌کند و برای باز کردن نیاز به آیین تأیید 20 مرحله‌ای دارد.
- یک قانون را موقتاً snooze کنید، اما فقط بعد از نوشتن توضیحی با طول کافی.
- قوانین مسدودسازی JavaScript سفارشی بنویسید که helperهایی برای تایمر، ذخیره‌سازی پایدار، تشخیص پلتفرم، تطبیق دامنه و لاگ‌گیری دارند.
- از افزونه در بیش از 20 زبان استفاده کنید.

این افزونه از نوع Chrome Manifest V3 است و شامل یک صفحه ویرایشگر (popup)، یک background service worker و یک content script است که در همه صفحه‌ها اجرا می‌شود.

---

## 2. آشنایی با رابط کاربری

وقتی روی آیکون افزونه کلیک می‌کنید، ویرایشگر به‌صورت یک صفحه کامل وب باز می‌شود (نه یک popup کوچک). این صفحه بخش‌های زیر را دارد:

- **Top bar**
  - دکمه **Instruction Manual** (همین سند)
  - انتخابگر **Language**
- **پنل چپ — Block Groups**
  - فهرست گروه‌های مسدودسازی شما. هر کارت نام گروه، یک خط خلاصه کوتاه و یک چک‌باکس فعال/غیرفعال دارد.
  - دکمه **Add** یک گروه جدید می‌سازد. منوی کناری نوع گروه را انتخاب می‌کند.
  - **Delete All** همه گروه‌ها را حذف می‌کند و اگر گروهی freeze باشد، تأییدهای اضافی می‌خواهد.
  - می‌توانید دستگیره `::` روی کارت را به بالا/پایین بکشید تا ترتیب گروه‌ها عوض شود.
  - می‌توانید جداکننده عمودی را بکشید تا اندازه این پنل تغییر کند.
- **پنل راست — Editor**
  - ویرایش گروه انتخاب‌شده: نام، رفتار مسدودسازی، فهرست‌های مسدود، فیلترهای مخصوص نوع، زمان‌بندی، freeze و snooze.
  - تمام تغییرات به‌صورت خودکار و کسری از ثانیه پس از توقف تایپ یا تعامل ذخیره می‌شوند.
- **Toast** (پیام شناور وسط صفحه که محو می‌شود)
  - پیام‌های وضعیت مثل "Saved changes" یا خطاهای ورودی را نشان می‌دهد.

وقتی یک صفحه در حال مسدود شدن است یا تایمر فعال دارد، یک overlay در گوشه بالا-چپ ظاهر می‌شود که همه محدودیت‌های زمانی اثرگذار را در قالب `hh:mm:ss` (یا `mm:ss`) نشان می‌دهد. چند محدودیت در چند خط نمایش داده می‌شوند.

---

## 3. Quick start

1. روی آیکون افزونه کلیک کنید. ویرایشگر به‌صورت صفحه کامل باز می‌شود.
2. در پنل **Block Groups** از منوی کشویی نوع گروه را انتخاب کنید:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` یا `Custom`.
3. روی **Add** کلیک کنید. یک گروه جدید ظاهر می‌شود و ویرایشگر آن را باز می‌کند.
4. برای گروه نام بگذارید.
5. فیلدهای مخصوص نوع را پر کنید (برای `Default` یعنی لیست **Blocked websites**).
6. مطمئن شوید چک‌باکس گروه در پنل چپ روشن است.
7. یکی از سایت‌های فهرست‌شده را باز کنید. مسدودسازی باید فوراً اعمال شود.

این کل مسیر اصلی است. بقیه این راهنما فقط گزینه‌های اضافه روی همین روند هستند.

---

## 4. نمای کلی گروه‌های مسدودسازی

همه چیز در این افزونه به‌صورت **block groups** سازمان‌دهی شده است. هر block group یک مجموعه قانون است:

- نام، نوع و وضعیت فعال/غیرفعال دارد.
- رفتار مسدودسازی دارد (فوری یا بعد از چند دقیقه).
- زمان‌بندی اختیاری (روزها + بازه‌های زمانی) و کنترل‌های اختیاری freeze/snooze دارد.
- بسته به نوع، فیلدهای اضافی مثل فهرست وب‌سایت‌ها، فیلتر سازندگان YouTube، نام subredditها یا یک تابع JavaScript دارد.

می‌توانید هر تعداد گروه داشته باشید. ممکن است چند گروه روی یک صفحه اعمال شوند؛ در این حالت قانون **سخت‌گیرانه‌تر** برنده است:

- "Block immediately" از "block after some time" سخت‌گیرانه‌تر است.
- گروهی که زمان باقی‌مانده کمتری دارد، از گروهی با زمان بیشتر سخت‌گیرانه‌تر است.

پس افزودن گروه‌های بیشتر فقط می‌تواند باعث شود صفحه زودتر مسدود شود، نه دیرتر.

می‌توانید گروه‌ها را با دستگیره `::` جابه‌جا کنید. ترتیب، سخت‌گیرانه‌ترین قانون را عوض نمی‌کند، اما ترتیب نمایش لیست از بالا به پایین را مشخص می‌کند.

---

## 5. نوع‌های گروه

### 5.1 `Default` — مسدود کردن وب‌سایت‌های معمولی

برای مسدود کردن دامنه‌های مشخص (رایج‌ترین کاربرد).

- **Blocked websites**: هر خط یک سایت. هم `facebook.com` و هم `https://www.facebook.com/somepage` کار می‌کنند؛ افزونه hostname را استخراج و نرمال‌سازی می‌کند.
- قانون سایت برای همان hostname و همه زیر‌دامنه‌های آن اعمال می‌شود.
- این نوع گروه از مسدودسازی شبکه بومی Chrome استفاده می‌کند، مشابه `ERR_BLOCKED_BY_CLIENT`. یعنی ناوبری به URL مسدودشده قبل از بارگذاری صفحه متوقف می‌شود.

### 5.2 `YouTube` — مسدود کردن YouTube و سایت‌های ویدیویی مشابه

یک بخش **Filters** به ویرایشگر اضافه می‌کند:

- **Content type**:
  - `Apply to all YouTube pages` — همه صفحه‌های YouTube شامل می‌شوند.
  - `Apply to Shorts` — فقط صفحه‌های Shorts شامل می‌شوند.
  - `Apply to long videos` — فقط `/watch`، `/live/`، `/embed/` و غیره.
  - `Apply to YouTube posts` — پست‌های community (`/post/...`، تب‌های community/posts کانال).
- **Author filter**:
  - `Do not filter by author` — هویت نویسنده مهم نیست.
  - `Apply to certain authors` — فقط نویسنده‌های فهرست‌شده این گروه را فعال می‌کنند.
  - `Apply to all except certain authors` — نویسنده‌های فهرست‌شده مستثنا هستند.
- **Authors**: هر خط یک نویسنده. `@handle`، URL کامل، `/channel/UC...`، `/c/...`، `/user/...` پشتیبانی می‌شوند.
- **Hide blocked entries in the YouTube feed**: وقتی این گروه فعالانه در حال مسدودسازی باشد، کارت‌های مطابق در فید YouTube پنهان می‌شوند. وقتی مسدودسازی غیرفعال شود، در نوسازی بعدی برمی‌گردند.

برای نوع‌های Shorts و Posts، وقتی author filter تنظیم نشده باشد و گروه در حال مسدودسازی باشد، افزونه ورودی‌های ناوبری مرتبط (ورودی Shorts در سایدبار، تب‌های Community/Posts کانال) و shelfهای مطابق مثل "Latest YouTube posts" را هم پنهان می‌کند.

تشخیص short-vs-long به سایت‌های ویدیویی دیگر مثل TikTok، Vimeo، Twitch clips/VODs و Dailymotion هم گسترش دارد، وقتی فرم صفحه قابل تشخیص باشد.

### 5.3 `TikTok` — مسدود کردن محتوای TikTok

همان کارت ویرایشگر پلتفرم ویدیو، اما با برچسب‌های مخصوص TikTok:

- نوع محتوا: ویدیوهای کوتاه، ویدیوها، صفحه‌های پروفایل.
- نویسنده‌ها: handleهای TikTok (`@handle`) یا URL پروفایل.
- Feed hiding در زمان فعال بودن گروه، کارت‌های مطابق را در صفحه‌های TikTok پنهان می‌کند.

### 5.4 `Facebook` — مسدود کردن محتوای Facebook

- نوع محتوا: Reels، ویدیوها، پست‌ها.
- نویسنده‌ها: نام صفحه (`page.name`)، URL پروفایل، یا فرم `profile.php?id=...` (شناسه عددی به صورت `id:<number>` حفظ می‌شود).
- Feed hiding کارت‌های مطابق فید را در Facebook پنهان می‌کند.

### 5.5 `Instagram` — مسدود کردن محتوای Instagram

- نوع محتوا: Reels، ویدیوها، پست‌ها.
- نویسنده‌ها: handleهای Instagram یا URL پروفایل.
- مسیرهای رزرو‌شده مثل `/reel/`، `/p/`، `/tv/`، `/explore/` به‌عنوان نویسنده در نظر گرفته نمی‌شوند.
- Feed hiding کارت‌های مطابق را در Instagram پنهان می‌کند.

### 5.6 `Twitch` — مسدود کردن محتوای Twitch

- نوع محتوا: clips، stream/VOD، صفحه‌های کانال.
- نویسنده‌ها: نام کانال یا URL کانال.
- مسیرهای رزرو‌شده مثل `/directory`، `/videos`، `/settings` و غیره به‌عنوان نام کانال در نظر گرفته نمی‌شوند.
- Feed hiding کارت‌های مطابق را در Twitch پنهان می‌کند.

### 5.7 `Reddit` — مسدود کردن Reddit یا subredditهای مشخص

- **Subreddits**: هر خط یک subreddit. فهرست خالی یعنی گروه روی کل Reddit اعمال می‌شود. هم `productivity` و هم `r/productivity` پذیرفته می‌شوند.

### 5.8 `Custom` — مسدودسازی با تابع JavaScript

شما یک تابع JavaScript می‌نویسید. افزونه تقریباً هر ثانیه آن را اجرا می‌کند و خروجی آن را به‌عنوان blocklist فعلی استفاده می‌کند.

گروه‌های `Custom` این موارد را نشان نمی‌دهند: رفتار مسدودسازی، سایت‌های مسدود، دقایق مجاز، فاصله reset، روزهای زمان‌بندی، یا بازه‌های زمانی. فقط یک ورودی بزرگ دارند — تابع **Blocking Rules** — به‌همراه کنترل‌های استاندارد freeze/snooze.

برای مرجع کامل قوانین سفارشی و helper API به **Section 11** مراجعه کنید.

---

## 6. رفتار مسدودسازی

برای بیشتر نوع‌های گروه یکی از دو حالت را انتخاب می‌کنید:

### 6.1 مسدودسازی فوری

این قانون وقتی فعال است که گروه روشن باشد، زمان‌بندی اجازه دهد، و (برای گروه‌های پلتفرمی) صفحه match شود.

برای گروه‌های `Default` از مسدودسازی بومی Chrome استفاده می‌شود. برای گروه‌های پلتفرمی از منطق overlay/exit داخل صفحه استفاده می‌شود.

### 6.2 مسدودسازی بعد از تعداد مشخصی دقیقه

این یک بودجه مصرف است.

- **Allowed minutes before block** (ده‌دهی): چند دقیقه در هر دوره مجاز است. مثال: `15`، `0.5`، `90`.
- **Timer reset interval (hours)** (ده‌دهی): بودجه هر چند وقت یک‌بار reset شود. مثال: `24` برای روزانه، `1` برای ساعتی، `0.25` برای هر 15 دقیقه.

تا وقتی زمان باقی است، صفحه عادی کار می‌کند و overlay تایمر نشان می‌دهد. وقتی بودجه به صفر برسد، صفحه برای باقی دوره مسدود می‌شود و overlay مقدار `0:00` را نشان می‌دهد، سپس تب تلاش می‌کند خارج شود.

این سیستم به‌صورت per-group و per-period کار می‌کند:

- هر گروه بودجه جداگانه خود را دارد.
- زمان صرف‌شده در هر صفحه‌ای که با گروه match شود، از بودجه همان گروه کم می‌شود.
- چند تب در یک گروه بودجه را مشترک دارند. تایمرها همگام می‌مانند؛ جابه‌جایی به تب دیگر هم refresh اجباری می‌دهد تا زمان مشترک فعلی فوری نمایش داده شود.

اگر چند گروه زمان‌دار روی یک صفحه اعمال شوند، سخت‌گیرانه‌ترین آن‌ها برنده است.

---

## 7. زمان‌بندی

در کارت **Schedule** می‌توانید محدود کنید گروه چه زمانی فعال باشد:

- **Days to block**: روزهایی را انتخاب کنید که گروه اعمال شود. روزهای بدون تیک یعنی گروه در آن روز غیرفعال است.
- **Time windows**: فهرست آزاد، هر خط یک بازه در قالب `HHMM-HHMM`، برای مثال:

  ```
  0900-1000
  1200-1300
  ```

  گروه فقط داخل همین بازه‌ها فعال است. فهرست خالی یعنی کل روز.

این مورد برای همه نوع‌های گروه به‌جز `Custom` اعمال می‌شود.

---

## 8. Freeze (ضد دستکاری)

freeze کردن باعث می‌شود غیرفعال کردن گروه از روی هوس سخت شود.

در کارت **Freeze** انتخاب می‌کنید:

- **Frozen** — نمی‌توانید گروه را ویرایش یا حذف کنید و نمی‌توانید تیک فعال‌سازی آن را بردارید. برای تغییر باید آیین unfreeze را انجام دهید (پایین توضیح داده شده).
- **Strict frozen** — مثل Frozen است، اما برای تعداد ساعتی که انتخاب می‌کنید قفل می‌ماند (ده‌دهی، تا 72). تا وقتی این زمان تمام نشود، حتی آیین unfreeze هم در دسترس نیست.

وقتی گروه frozen قابل بازشدن باشد، دکمه **Unfreeze** ظاهر می‌شود. با کلیک روی آن **آیین 20 مرحله‌ای** شروع می‌شود:

- در modal پیام مربوط به خودانضباطی نمایش داده می‌شود.
- باید 20 بار روی `Confirm` کلیک کنید.
- بین هر کلیک 5 ثانیه مکث اجباری وجود دارد.
- اگر در هر مرحله لغو کنید، باید از مرحله 1 دوباره شروع کنید.
- 20 پیام به‌صورت چرخشی نمایش داده می‌شوند تا واقعاً خوانده شوند.

اگر گروه حالت "no snooze" هم داشته باشد (بخش بعدی)، در حالت frozen حتی snooze هم نمی‌توانید انجام دهید.

وضعیت freeze در خط meta کارت گروه نمایش داده می‌شود، شامل زمان باقی‌مانده strict freeze.

---

## 9. Snooze (غیرفعال‌سازی موقت)

snooze بدون unfreeze کردن، گروه را موقتاً غیرفعال می‌کند، اما فقط با یک توضیح نوشتاری.

در کارت **Snooze**:

- **Allow snooze for this group** — اگر خاموش باشد، این گروه اصلاً قابل snooze نیست (حتی در حالت frozen).
- **Snooze for (minutes)** — ده‌دهی، مدت snooze.
- **Reason** — باید **حداقل 100 کاراکتر و بیش از 20 کلمه** باشد. دکمه Start تا زمان رعایت هر دو شرط غیرفعال می‌ماند. اگر شرط رد شود، کنار دکمه یک هشدار inline می‌آید.

اگر گروه frozen باشد، مقدار دقیقه snooze روی مقداری که قبل از freeze تعیین شده قفل می‌شود. با این حال تا وقتی snooze مجاز باشد و دلیل شرایط را داشته باشد، می‌توانید snooze کنید.

یک پیام وضعیت snooze را تأیید می‌کند. با پایان snooze، گروه خودکار به حالت عادی برمی‌گردد.

همچنین می‌توانید با دکمه **End Snooze** زودتر snooze را قطع کنید.

---

## 10. عملیات گروهی

- **Delete All** همه گروه‌ها را حذف می‌کند.
  - همیشه تأیید می‌خواهد.
  - اگر حداقل یک گروه frozen باشد، همان آیین 20 مرحله‌ای unfreeze لازم است.
  - اگر هر گروهی strict-frozen و هنوز قفل باشد، **Delete All** غیرفعال است.

---

## 11. گروه‌های Custom (مرجع کامل)

یک گروه `Custom` تابع JavaScript را در background service worker اجرا می‌کند. این تابع تقریباً هر ثانیه فراخوانی می‌شود و افزونه از خروجی آن برای تصمیم‌گیری درباره دامنه‌هایی که همین حالا باید مسدود شوند استفاده می‌کند.

### 11.1 امضای تابع

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

پارامترها:

- `month` — از `1` تا `12`.
- `dayOfMonth` — از `1` تا `31`.
- `dayName` — مثلاً `"Monday"`.
- `hour` — از `0` تا `23`.
- `minute` — از `0` تا `59`.
- `blockedDomains` — فهرست جاری دامنه‌هایی که قوانین دیگر قبلاً تولید کرده‌اند. می‌توانید به آن اضافه کنید، جایگزینش کنید، یا نادیده بگیرید.
- `helpers` — مجموعه‌ای از helper objectها (پایین ببینید).

مقدار بازگشتی:

- آرایه‌ای از رشته دامنه‌ها که باید همین حالا مسدود شوند، یا
- هیچ مقداری برنگردانید (در این حالت افزونه از `blockedDomains` تغییریافته شما استفاده می‌کند).

تابع هنگام ذخیره اعتبارسنجی می‌شود. خطاهای نحوی هشدار وضعیت می‌دهند و قانون تا زمان اصلاح استفاده نمی‌شود. اگر تابع در زمان اجرا خطا بدهد، افزونه آن را catch می‌کند، در background console لاگ می‌کند و به نتیجه قبلی برمی‌گردد.

### 11.2 زمان‌بندی تطبیقی

قوانین Custom معمولاً حدود هر ثانیه اجرا می‌شوند. اگر قانون شما طولانی شود، افزونه حلقه را خودکار کند می‌کند (تا حدود هر 5 ثانیه). نیاز نیست این را خودتان مدیریت کنید.

### 11.3 شیء `helpers`

داخل تابع، `helpers` چند زیر-helper ارائه می‌دهد. هرکدام نام کامل و نام کوتاه دارد. getterهای صریح هم وجود دارند:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — زمان epoch فعلی بر حسب میلی‌ثانیه.

تمام متدهای helper طوری طراحی شده‌اند که امن باشند: پارامتر نامعتبر به‌جای throw، مقدار `null`، `false` یا مقدار خالی برمی‌گرداند.

#### 11.3.1 `timerHelper`

تایمرهای شمارش‌معکوس متصل به دامنه را مدیریت می‌کند. تایمرها بعد از restart مرورگر هم باقی می‌مانند. هر تایمر متعلق به گروه custom سازنده خودش است.

- `createTimer(domain, durationMs, displayName?)` — یک شناسه تایمر یکتا می‌سازد و برمی‌گرداند، یا در حالت نامعتبر `null`. مثال: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. وقتی کاربر روی صفحه‌ای مطابق آن دامنه باشد، overlay داخل صفحه `Timer1: 30:00` را نشان می‌دهد و کم می‌کند.
- `deleteTimer(id)` — تایمر را حذف می‌کند. در موفقیت `true` برمی‌گرداند.
- `pauseTimer(id)` — شمارش‌معکوس را متوقف می‌کند.
- `continueTimer(id)` / `resumeTimer(id)` — تایمر متوقف‌شده را ادامه می‌دهد.
- `resetTimer(id, durationMs?)` — تایمر را ریست و دوباره شروع می‌کند. بدون `durationMs` مقدار اولیه استفاده می‌شود.
- `addMs(id, ms)` — میلی‌ثانیه اضافه می‌کند (یا با مقدار منفی کم می‌کند).
- `remainingMs(id)` — زمان باقی‌مانده برحسب میلی‌ثانیه.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — مقادیر بولی.
- `getDomain(id)` / `getDisplayName(id)` — اطلاعات تایمر را می‌خواند.
- `findByDomain(domain)` — آرایه‌ای از شناسه تایمرها برای آن دامنه.
- `list()` — آرایه‌ای از `{ id, domain, displayName, durationMs, remainingMs, isPaused }` برای همه تایمرهایی که متعلق به این گروه‌اند.

حداکثر مدت تایمر حدود 30 روز است.

#### 11.3.2 `persistenceHelper`

ذخیره‌سازی شبیه map با scope گروه شما. مقادیر باید JSON-serializable باشند. برای نگه‌داشتن state بین فراخوانی‌ها مفید است.

- `set(key, value)` — هر مقدار JSON را ذخیره می‌کند. در موفقیت `true` برمی‌گرداند.
- `get(key, defaultValue?)` — مقدار ذخیره‌شده را می‌دهد، یا اگر وجود نداشت `defaultValue`.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

حدود نرم: حدود 200 کلید برای هر گروه، 16 KB برای هر مقدار.

#### 11.3.3 `domainHelper`

- `normalize(value)` — دامنه canonical مثل `youtube.com` را برمی‌گرداند، یا `null`.
- `matches(hostname, site)` — اگر `hostname` متعلق به `site` باشد (با پشتیبانی از subdomain) مقدار `true` می‌دهد.

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — در background console می‌نویسد.

برای دیدن این پیام‌ها: `chrome://extensions` → Developer Mode را روشن کنید → روی لینک "service worker" افزونه کلیک کنید.

#### 11.3.5 `platformHelper`

بررسی پلتفرم‌های اجتماعی/ویدیویی پشتیبانی‌شده.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — نام canonical پلتفرم را می‌دهد، یا `null`.
- `normalizeAuthor(author, platform)` — شناسه نویسنده (handle، URL و غیره) را برای پلتفرم مشخص نرمال‌سازی می‌کند، یا `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — مقدار `{ platform, hostname, pathname, type, authors, url }` می‌دهد، یا `null`.
  - `type` برابر `"short" | "long" | "post" | "unknown"` است.
  - `authors` فهرست نویسندگان نرمال‌سازی‌شده قابل تشخیص از آن URL است.
- `getType(urlOrHost)` — میانبر `detect(...).type`.
- `getPlatform(urlOrHost)` — میانبر `detect(...).platform`.
- `getAuthors(urlOrHost)` — میانبر `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — اگر URL روی آن پلتفرم باشد و یکی از نویسندگان داده‌شده match شود، `true` برمی‌گرداند.

### 11.4 مثال‌ها

ساده: مسدود کردن شبکه‌های اجتماعی در صبح روزهای کاری.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

متوسط: 30 دقیقه YouTube در هر نشست مرورگر با شمارش‌معکوس قابل مشاهده.

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

سخت‌تر: فقط زمانی یک نشست TikTok را مسدود کن که short video باشد و author در فهرست distractor شما باشد. از `platformHelper` استفاده کنید.

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

(`globalThis.location` فقط یک placeholder نمونه است — معمولاً باید `platformHelper` را با منطق خودتان هدایت کنید، نه location خود worker، چون background worker آدرس واقعی صفحه ندارد.)

سخت‌ترین: "site of the day" چرخشی با سقف روزانه که بین restartها پایدار بماند.

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

## 12. رفتار چندصفحه‌ای

- همه تب‌های باز در یک گروه، یک تایمر مشترک دارند.
- وقتی به تبی در همان گروه می‌روید، overlay بلافاصله refresh می‌شود تا زمان مشترک فعلی را نشان دهد.
- وقتی قانون جدیدی اضافه می‌شود، همه صفحه‌های باز تغییر را ظرف کسری از ثانیه تشخیص می‌دهند و refresh می‌شوند؛ نیازی به reload دستی تب‌ها نیست.
- وقتی یک قانون منقضی شود، کارت‌های پنهان‌شده فید و دکمه‌های ناوبری در refresh بعدی بازمی‌گردند.

---

## 13. بین‌المللی‌سازی

کل UI کاملاً ترجمه شده است. از انتخابگر **Language** در بالا سمت راست استفاده کنید.

زبان‌های پشتیبانی‌شده شامل English، Chinese (Simplified)، Spanish، Japanese، Korean هستند، به‌علاوه پوشش جزئی برای Hindi، Arabic، Bengali، Portuguese، Russian، Punjabi، German، French، Turkish، Vietnamese، Italian، Thai، Dutch، Polish، Indonesian، Urdu و Persian. زبان‌هایی با پوشش جزئی برای رشته‌های موجود‌نبود به English fallback می‌کنند.

خود راهنما فایل markdown مطابق زبان انتخاب‌شده را بارگذاری می‌کند و English را به‌عنوان fallback دارد.

---

## 14. پیام‌های وضعیت

پیام‌های وضعیت به‌صورت toast در مرکز صفحه ظاهر می‌شوند و حدود دو ثانیه بعد محو می‌شوند:

- "Saved changes."
- "Created \"Group name\"."
- خطاهای اعتبارسنجی مثل "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

برای فیلدهایی که محدودیت فرمت دارند، پیام کنار دکمه مرتبط هم نمایش داده می‌شود (برای snooze).

---

## 15. حریم خصوصی و ذخیره‌سازی

- همه چیز به‌صورت محلی در `chrome.storage.local` ذخیره می‌شود. هیچ داده‌ای جایی ارسال نمی‌شود.
- موارد ذخیره‌شده شامل: گروه‌های شما، تایمرهای مصرف، زمان‌های آخرین reset، رکوردهای snooze، تایمرهای سفارشی و مقادیر پایدار سفارشی هستند.
- افزونه محتوای صفحه را بیش از حد لازم برای تشخیص نوع صفحه نمی‌خواند (path/hostname/known DOM markers for video sites). پیام‌ها، پست‌ها، کامنت‌ها یا محتوای خصوصی شما خوانده نمی‌شود.

---

## 16. مجوزها

- `storage` — برای داده‌های بالا.
- `declarativeNetRequest` — برای مسدودسازی بومی گروه‌های `Default`.
- `alarms` — برای زمان‌بندی کارآمد تغییر وضعیت قوانین.
- `host_permissions: <all_urls>` — تا content script بتواند overlay تایمر را نشان دهد و context پلتفرم را در هر صفحه تشخیص دهد.

---

## 17. عیب‌یابی

- **گروهی که اضافه کرده‌ام هیچ کاری نمی‌کند.** مطمئن شوید گروه فعال است، زمان‌بندی الان اجازه می‌دهد، snooze فعال نیست و (برای گروه‌های پلتفرمی) صفحه واقعاً با content type و author filter انتخاب‌شده match می‌شود.
- **تایمر در یک تب گیر کرده یا نادرست است.** از تب خارج شوید و برگردید یا تب را focus کنید — این کار refresh اجباری از تایمر مشترک را فعال می‌کند.
- **کارت‌های فید دوباره ظاهر می‌شوند در حالی که باید پنهان باشند.** Feed hiding فقط وقتی اجرا می‌شود که قانون فعالانه در حال مسدودسازی باشد. اگر قانون `after-minutes` دارید، feed hiding وقتی زمان شما صفر شود فعال می‌شود.
- **یک دکمه ناوبری YouTube که انتظار داشتم پنهان شود هنوز هست.** پنهان‌سازی ناوبری نیاز دارد قانون روی "do not filter by author" باشد و content type برابر Shorts یا YouTube posts باشد. با author filter، پنهان‌سازی فقط در سطح کارت انجام می‌شود.
- **قانون custom کاری نکرد یا بی‌صدا خطا داد.** `chrome://extensions` را باز کنید، Developer Mode را فعال کنید، روی لینک "service worker" افزونه کلیک کنید و console را بررسی کنید. برای ردیابی قانون از `helpers.logHelper.log(...)` استفاده کنید.
- **نمی‌توانم گروهی را حذف کنم.** احتمالاً freeze است. گروه‌های strict-frozen تا پایان قفل اصلاً حذف نمی‌شوند؛ گروه‌های frozen غیر strict با آیین unfreeze قابل حذف‌اند.

---

## 18. واژه‌نامه

- **Block group** — یک مجموعه قانون با type، behavior، schedule و freeze/snooze اختصاصی.
- **Instant block** — قانون هر زمان فعال باشد فوراً مسدود می‌کند.
- **After-minutes block** — قانون فقط پس از تمام شدن بودجه زمانی دوره شروع به مسدود کردن می‌کند.
- **Reset interval** — میزان تناوب reset شدن بودجه after-minutes.
- **Schedule** — روزها + بازه‌های زمانی که گروه در آن فعال است.
- **Freeze / Strict freeze** — حالت‌های ضد دستکاری.
- **Snooze** — غیرفعال‌سازی موقت با دلیل نوشتاری.
- **Author filter** — در گروه‌های پلتفرمی، قانون را به سازندگان محتوای مشخص محدود می‌کند.
- **Content type** — در گروه‌های پلتفرمی، قانون را به شکل‌های مشخص محتوا (short, long, post) محدود می‌کند.
- **Helpers** — ابزارهای کمکی که به تابع قانون custom داده می‌شوند.
- **Platform** — یکی از `youtube`، `tiktok`، `facebook`، `instagram`، `twitch`. هرکدام نوع گروه و منطق feed hiding مخصوص خود را دارند.

---

## 19. محدودیت‌ها

- Feed hiding به DOM فعلی هر پلتفرم وابسته است. اگر پلتفرم چیدمان را عوض کند، selectorهای پنهان‌سازی ممکن است نیاز به به‌روزرسانی داشته باشند.
- تشخیص context پلتفرم برای سایت‌های غیر-YouTube عمدتاً URL-based است، بنابراین روی URLهای canonical محتوا قابل‌اعتمادتر است.
- حلقه‌های custom rule در background worker اجرا می‌شوند، نه داخل صفحه‌ها، بنابراین اطلاعات سطح DOM داخل تابع در دسترس نیست. به‌جای آن از `platformHelper.detect(url)` با رشته URL استفاده کنید.
- مرورگر ممکن است service worker را در حالت idle معلق کند. افزونه به‌محض نیاز صفحه یا alarm آن را از سر می‌گیرد؛ تایمرهای مصرف به‌خاطر این موضوع دقت خود را از دست نمی‌دهند.
