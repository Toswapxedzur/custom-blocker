# Custom Web Blocker — Kullanım Kılavuzu

Bu, eklenti için tam başvuru kılavuzudur. En kolay ve en yaygın iş akışlarıyla başlar, ardından özel JavaScript engelleme kuralları ve yardımcı API gibi ileri konulara doğru ilerler.

Eğer tamamen yeniyseniz yalnızca **Hızlı başlangıç** ve **Engelleme gruplarına genel bakış** bölümlerini okuyun. Bu bölümlerin altındaki her şey, yapmak istediklerinize bağlı olarak isteğe bağlıdır.

---

## 1. Bu eklenti ne yapar

Custom Web Blocker, kendi tanımladığınız kurallara göre web sitelerini ve çevrimiçi dikkat dağıtıcıları engellemenizi sağlar. Şunları yapabilirsiniz:

- Siteleri tarayıcının yerel ağ engellemesiyle hemen engellemek ( `ERR_BLOCKED_BY_CLIENT` üreten engellemenin aynı türü).
- Bir sitede kendinize günlük belirli sayıda dakika tanımak ve bu sınırı aşınca engellemek.
- YouTube, TikTok, Facebook, Instagram, Twitch ve Reddit'te belirli içerik türlerini engellemek (tüm siteyi değil).
- Yalnızca tekil sayfaları engellemek yerine, desteklenen platformlardaki akışlardan engellenmiş içerikleri gizlemek.
- Bir kuralın ne zaman etkin olacağını haftanın günleri ve `HHMM-HHMM` zaman pencereleriyle planlamak.
- Bir kuralı kolayca değiştiremeyeceğiniz şekilde dondurmak. Sıkı dondurma, kuralı belirttiğiniz saat kadar kilitler ve geri almak için 20 adımlı bir onay ritüeli gerektirir.
- Geçici olarak bir kuralı ertelemek (snooze), ancak bunun için yeterince uzun bir gerekçe yazmak.
- Sayaçlar, kalıcı depolama, platform tespiti, alan adı eşleme ve günlükleme için yardımcılarla özel JavaScript engelleme kuralları yazmak.
- Eklentiyi 20+ dilde kullanmak.

Eklenti bir Chrome Manifest V3 eklentisidir; bir düzenleyici sayfası (açılır arayüz), bir arka plan service worker ve her sayfada çalışan bir content script içerir.

---

## 2. Arayüz turu

Eklenti simgesine tıkladığınızda düzenleyici tam web sayfası olarak açılır (küçük bir popup değil). Sayfa şu alanlara sahiptir:

- **Üst çubuk**
  - **Instruction Manual** düğmesi (bu belge)
  - **Language** seçici
- **Sol panel — Block Groups**
  - Engelleme gruplarınızın listesi. Her kartta grup adı, kısa özet satırı ve etkinleştir/devre dışı bırak kutucuğu bulunur.
  - **Add** düğmesi yeni grup oluşturur. Yanındaki açılır menü türü seçer.
  - **Delete All**, herhangi bir grup dondurulmuşsa ek onaylarla birlikte tüm grupları kaldırır.
  - Karttaki `::` tutamacını yukarı/aşağı sürükleyerek grupları sıralayabilirsiniz.
  - Bu paneli yeniden boyutlandırmak için dikey ayırıcıyı sürükleyebilirsiniz.
- **Sağ panel — Editor**
  - Seçili grubun ayarlarını düzenler: ad, engelleme davranışı, engel listeleri, türe özel filtreler, takvim, dondurma, erteleme.
  - Yazmayı veya etkileşimi bıraktıktan bir saniyeden kısa süre sonra tüm değişiklikler otomatik kaydedilir.
- **Toast** (ortalanmış ve solan bildirim)
  - "Saved changes" gibi durum mesajlarını veya giriş hatalarını gösterir.

Bir sayfa engellenirken veya etkin bir sayacı varken, sol üstte o anda etkili tüm zaman kısıtlarını `hh:mm:ss` (veya `mm:ss`) biçiminde gösteren bir katman belirir. Birden çok kısıt, birden çok satır halinde üst üste görünür.

---

## 3. Hızlı başlangıç

1. Eklenti simgesine tıklayın. Düzenleyici tam sayfa olarak açılır.
2. **Block Groups** panelinde açılır menüden bir grup türü seçin:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` veya `Custom`.
3. **Add** düğmesine tıklayın. Yeni bir grup görünür ve düzenleyici o grubu açar.
4. Bir ad verin.
5. Türe özel alanları doldurun (`Default` için bu, **Blocked websites** listesidir).
6. Sol panelde grubun kutucuğunun açık olduğundan emin olun.
7. Listelenen sitelerden birini ziyaret edin. Engelleme hemen devreye girmelidir.

Mutlu yolun tamamı budur. Bu kılavuzun geri kalanı bunun üzerine gelen seçeneklerdir.

---

## 4. Engelleme gruplarına genel bakış

Bu eklentide her şey **engelleme grupları** olarak düzenlenir. Engelleme grubu tek bir kural setidir:

- Adı, türü ve etkin/devre dışı durumu vardır.
- Bir engelleme davranışı vardır (hemen veya belirli dakika sonra).
- İsteğe bağlı bir takvimi (günler + zaman pencereleri) ve isteğe bağlı dondurma/erteleme kontrolleri vardır.
- Türe bağlı olarak site listesi, YouTube üretici filtreleri, subreddit adları veya bir JavaScript fonksiyonu gibi ek alanlar içerir.

İstediğiniz sayıda grup oluşturabilirsiniz. Birden fazla grup aynı sayfaya uygulanabilir; bu durumda **en katı** kural kazanır:

- "Hemen engelle", "bir süre sonra engelle"yi ezer.
- Daha az kalan süreye sahip grup, daha çok kalan süreye sahip grubu ezer.

Dolayısıyla daha fazla grup eklemek, bir sayfanın daha geç değil yalnızca daha erken engellenmesine neden olabilir.

Grupları `::` tutamacından sürükleyerek yeniden sıralayabilirsiniz. Sıra, hangi kuralın daha katı olduğunu değiştirmez; yalnızca listenin yukarıdan aşağıya nasıl okunduğunu belirler.

---

## 5. Grup türleri

### 5.1 `Default` — normal web sitelerini engelle

Belirli alan adlarını engellemek içindir (tipik kullanım).

- **Blocked websites**: satır başına bir site. Hem `facebook.com` hem de `https://www.facebook.com/somepage` çalışır; eklenti ana makine adını çıkarır ve normalize eder.
- Site kuralı o ana makine adına ve tüm alt alan adlarına uygulanır.
- Bu grup türü, `ERR_BLOCKED_BY_CLIENT` benzeri Chrome'un yerel ağ engellemesini kullanır. Bu da engellenen URL'ye gezinmenin sayfa daha yüklenmeden durdurulması anlamına gelir.

### 5.2 `YouTube` — YouTube ve benzer video sitelerini engelle

Düzenleyiciye bir **Filters** bölümü ekler:

- **Content type**:
  - `Apply to all YouTube pages` — tüm YouTube sayfaları sayılır.
  - `Apply to Shorts` — yalnızca Shorts sayfaları sayılır.
  - `Apply to long videos` — yalnızca `/watch`, `/live/`, `/embed/` vb.
  - `Apply to YouTube posts` — topluluk gönderileri (`/post/...`, kanal community/posts sekmeleri).
- **Author filter**:
  - `Do not filter by author` — yazar kimliği önemli değildir.
  - `Apply to certain authors` — yalnızca listelenen yazarlar bu grubu tetikler.
  - `Apply to all except certain authors` — listelenen yazarlar muaftır.
- **Authors**: satır başına bir yazar. `@handle`, tam URL, `/channel/UC...`, `/c/...`, `/user/...` kabul edilir.
- **Hide blocked entries in the YouTube feed**: bu grup aktif olarak engellerken YouTube akışlarındaki eşleşen kartlar gizlenir. Engelleme etkisiz olduğunda, sonraki yenilemede geri gelirler.

Shorts ve Posts içerik türlerinde, yazar filtresi yoksa ve grup şu anda engelliyorsa, eklenti ilgili gezinme öğelerini de gizler (Shorts kenar çubuğu girdisi, Community/Posts kanal sekmeleri) ve "Latest YouTube posts" gibi eşleşen rafları kaldırır.

Kısa-uzun ayrımı; TikTok, Vimeo, Twitch clips/VODs ve Dailymotion gibi diğer video sitelerine de, sayfa biçimi tespit edilebildiği sürece uygulanır.

### 5.3 `TikTok` — TikTok içeriğini engelle

Platform-video düzenleyicisiyle aynı kartı kullanır, ancak TikTok'a özel etiketlerle:

- İçerik türleri: kısa videolar, videolar, profil sayfaları.
- Yazarlar: TikTok kullanıcı adları (`@handle`) veya profil URL'leri.
- Akış gizleme, grup aktifken TikTok sayfalarındaki eşleşen kartları gizler.

### 5.4 `Facebook` — Facebook içeriğini engelle

- İçerik türleri: Reels, videolar, gönderiler.
- Yazarlar: sayfa adı (`page.name`), profil URL'si veya `profile.php?id=...` biçimi (sayısal kimlik `id:<number>` olarak korunur).
- Akış gizleme, Facebook'taki eşleşen akış kartlarını gizler.

### 5.5 `Instagram` — Instagram içeriğini engelle

- İçerik türleri: Reels, videolar, gönderiler.
- Yazarlar: Instagram kullanıcı adları veya profil URL'leri.
- `/reel/`, `/p/`, `/tv/`, `/explore/` gibi ayrılmış yollar yazar olarak kabul edilmez.
- Akış gizleme, Instagram'daki eşleşen kartları gizler.

### 5.6 `Twitch` — Twitch içeriğini engelle

- İçerik türleri: klipler, yayınlar/VOD'lar, kanal sayfaları.
- Yazarlar: kanal adları veya kanal URL'leri.
- `/directory`, `/videos`, `/settings` vb. ayrılmış yollar kanal adı olarak kabul edilmez.
- Akış gizleme, Twitch'teki eşleşen kartları gizler.

### 5.7 `Reddit` — Reddit'i veya belirli subreddit'leri engelle

- **Subreddits**: satır başına bir subreddit. Boş liste, grubun tüm Reddit'e uygulanacağı anlamına gelir. Hem `productivity` hem `r/productivity` kabul edilir.

### 5.8 `Custom` — JavaScript fonksiyonuyla engelle

Bir JavaScript fonksiyonu yazarsınız. Eklenti bu fonksiyonu yaklaşık her saniye çağırır ve dönüş değerini güncel engel listesi olarak kullanır.

`Custom` gruplarında şunlar görünmez: engelleme davranışı, engellenen siteler, izin verilen dakika, sıfırlama aralığı, takvim günleri veya zaman pencereleri. Sadece tek büyük giriş alanı olan **Blocking Rules** fonksiyonu ve standart dondurma/erteleme kontrolleri bulunur.

Özel kurallar ve yardımcı API'nin tam referansı için **Bölüm 11**'e bakın.

---

## 6. Engelleme davranışı

Çoğu grup türü için iki moddan birini seçersiniz:

### 6.1 Hemen engelle

Kural; grup açıksa, takvim izin veriyorsa ve (platform grupları için) sayfa eşleşiyorsa etkindir.

`Default` gruplarında bu Chrome'un yerel engellemesini kullanır. Platform gruplarında ise sayfa içi katman/çıkış mantığı kullanılır.

### 6.2 Belirli dakika sonra engelle

Bu bir kullanım bütçesidir.

- **Allowed minutes before block** (ondalıklı): dönem başına kendinize tanıdığınız dakika sayısı. Örnek: `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (ondalıklı): bütçenin ne sıklıkla sıfırlanacağı. Örnek: günlük için `24`, saatlik için `1`, 15 dakikada bir için `0.25`.

Süreniz varken sayfa normal çalışır ve sayaç katmanını gösterir. Bütçe sıfıra indiğinde, sayfa dönemin geri kalanında engellenir ve katmanda `0:00` görünür; ardından sekme çıkmayı dener.

Eklenti mantığı grup ve dönem bazındadır:

- Her grubun kendi bütçesi vardır.
- Grupla eşleşen herhangi bir sayfada geçirilen süre, o grubun bütçesinden düşer.
- Aynı gruptaki birden fazla sekme aynı bütçeyi paylaşır. Sayaçlar senkronize kalır; başka sekmeye geçmek de yenilemeyi zorlayarak anlık paylaşılan süreyi gösterir.

Aynı sayfaya birden fazla zaman kısıtlı grup uygulanırsa, en katı olan kazanır.

---

## 7. Takvim

**Schedule** kartında bir grubun ne zaman etkin olacağını kısıtlayabilirsiniz:

- **Days to block**: grubun uygulanacağı günleri seçin. İşaretlenmemiş günlerde grup etkisizdir.
- **Time windows**: serbest biçimli liste; satır başına bir pencere olacak şekilde `HHMM-HHMM`, örneğin:

  ```
  0900-1000
  1200-1300
  ```

  Grup yalnızca bu pencerelerin içinde etkindir. Boş liste tüm gün anlamına gelir.

Bu, `Custom` dışında tüm grup türlerine uygulanır.

---

## 8. Dondurma (kurcalamaya karşı)

Dondurma, bir grubu ani dürtüyle devre dışı bırakmayı zorlaştırır.

**Freeze** kartında şunları seçersiniz:

- **Frozen** — grubu düzenleyemez veya silemezsiniz, ayrıca etkinleştirme kutucuğunu kapatamazsınız. Bir şeyi değiştirmek için dondurma kaldırma ritüelini çalıştırmanız gerekir (aşağıya bakın).
- **Strict frozen** — Frozen ile aynı, ancak seçtiğiniz saat kadar (ondalıklı, en çok 72) kilitli kalır. Bu süre dolmadan dondurma kaldırma ritüeli bile kullanılamaz.

Dondurulmuş grup kilidi açılabilir durumdaysa **Unfreeze** düğmesi görünür. Buna tıklamak **20 adımlı ritüeli** başlatır:

- Pencerede öz disiplin mesajı gösterilir.
- `Confirm` düğmesine 20 kez tıklamanız gerekir.
- Tıklamalar arasında zorunlu 5 saniye bekleme vardır.
- Herhangi bir noktada iptal ederseniz 1. adımdan yeniden başlarsınız.
- 20 mesaj döngüsel döner, böylece gerçekten okursunuz.

Grup ayrıca "no snooze" (sonraki bölüm) olarak işaretliyse, donduruluyken onu erteleyemezsiniz.

Dondurma durumu grup kartının meta satırında, sıkı dondurma için kalan süreyle birlikte gösterilir.

---

## 9. Snooze (geçici devre dışı bırakma)

Snooze, bir grubun dondurmasını kaldırmadan geçici olarak devre dışı bırakır; ancak yalnızca yazılı bir gerekçe ile.

**Snooze** kartında:

- **Allow snooze for this group** — kapalıysa bu grup hiç snooze edilemez (dondurulmuşken dahil).
- **Snooze for (minutes)** — ondalıklı, snooze süresi.
- **Reason** — **en az 100 karakter ve 20 kelimeden fazla** olmalıdır. Her ikisi de sağlanana kadar Start düğmesi devre dışı kalır. Kural sağlanmazsa düğmenin yanında satır içi uyarı görünür.

Grup dondurulmuşsa snooze dakikası, dondurma öncesinde seçilen değerde kilitlenir. Yine de snooze izni açıksa ve gerekçe kurallara uyuyorsa erteleyebilirsiniz.

Bir durum mesajı snooze'u onaylar. Snooze bittiğinde grup otomatik olarak normale döner.

Snooze'u **End Snooze** düğmesiyle erken de sonlandırabilirsiniz.

---

## 10. Toplu işlemler

- **Delete All** tüm grupları kaldırır.
  - Her zaman onay ister.
  - En az bir grup dondurulmuşsa, dondurma kaldırmadakiyle aynı 20 adımlı ritüel gerekir.
  - Herhangi bir grup strict-frozen ve hâlâ kilitliyse **Delete All** devre dışıdır.

---

## 11. Custom gruplar (tam referans)

Bir `Custom` grubu arka plan service worker içinde bir JavaScript fonksiyonu çalıştırır. Fonksiyon yaklaşık her saniye çağrılır ve eklenti dönen sonuca göre şu anda hangi alan adlarının engellenmesi gerektiğine karar verir.

### 11.1 Fonksiyon imzası

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parametreler:

- `month` — `1` ile `12`.
- `dayOfMonth` — `1` ile `31`.
- `dayName` — örneğin `"Monday"`.
- `hour` — `0` ile `23`.
- `minute` — `0` ile `59`.
- `blockedDomains` — diğer kuralların hâlihazırda ürettiği çalışan alan adı listesi. Buna ekleme yapabilir, tamamen değiştirebilir veya görmezden gelebilirsiniz.
- `helpers` — yardımcı nesneler paketi (aşağıya bakın).

Dönüş değeri:

- Şu anda engellenmesi gereken alan adı dizisi, VEYA
- hiçbir şey (bu durumda eklenti `blockedDomains` üzerinde yaptığınız değişikliği kullanır).

Fonksiyon kaydederken doğrulanır. Sözdizimi hataları durum uyarısı üretir ve siz düzeltmeden kural kullanılmaz. Fonksiyon çalışma anında hata fırlatırsa eklenti bunu yakalar, arka plan konsoluna yazar ve önceki sonuca geri döner.

### 11.2 Uyarlanabilir zamanlama

Özel kurallar normalde yaklaşık her saniye çalışır. Kuralınız çok uzun sürmeye başlarsa eklenti döngüyü otomatik olarak yavaşlatır (yaklaşık 5 saniyeye kadar). Bunu sizin yönetmeniz gerekmez.

### 11.3 `helpers` nesnesi

Fonksiyon içinde `helpers`, çeşitli alt yardımcıları sunar. Her birinin uzun adı ve kısa takma adı vardır. Ayrıca açık getter metodları da bulunur:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — milisaniye cinsinden mevcut epoch zamanı.

Tüm yardımcı metotlar güvenli olacak şekilde tasarlanmıştır: kötü parametreler hata fırlatmak yerine `null`, `false` veya boş değer döndürür.

#### 11.3.1 `timerHelper`

Bir alan adına bağlı geri sayım sayaçlarını yönetir. Sayaçlar tarayıcı yeniden başlatılsa da korunur. Her sayaç onu oluşturan custom gruba aittir.

- `createTimer(domain, durationMs, displayName?)` — benzersiz bir sayaç kimliği oluşturur ve döndürür; geçersizse `null` döner. Örnek: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Kullanıcı bu alan adıyla eşleşen bir sayfadayken sayfa içi katman `Timer1: 30:00` gösterir ve geri sayar.
- `deleteTimer(id)` — sayacı siler. Başarıda `true` döner.
- `pauseTimer(id)` — geri sayımı duraklatır.
- `continueTimer(id)` / `resumeTimer(id)` — duraklatılmış sayacı sürdürür.
- `resetTimer(id, durationMs?)` — sayacı yeniden başlatır. `durationMs` verilmezse orijinali kullanır.
- `addMs(id, ms)` — milisaniye ekler (negatif değerle çıkarır).
- `remainingMs(id)` — kalan milisaniye.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — boolean.
- `getDomain(id)` / `getDisplayName(id)` — sayaç bilgisini okur.
- `findByDomain(domain)` — o alan adına ait sayaç kimlikleri dizisi.
- `list()` — bu grubun sahip olduğu her sayaç için `{ id, domain, displayName, durationMs, remainingMs, isPaused }` dizisi.

Maksimum sayaç süresi yaklaşık 30 gündür.

#### 11.3.2 `persistenceHelper`

Grubunuza özel map benzeri depolama. Değerler JSON olarak serileştirilebilir olmalıdır. Çağrılar arasında durumu hatırlamak için kullanışlıdır.

- `set(key, value)` — herhangi bir JSON değerini saklar. Başarıda `true` döner.
- `get(key, defaultValue?)` — saklanan değeri döndürür; yoksa `defaultValue`.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Yumuşak limitler: grup başına yaklaşık 200 anahtar, değer başına 16 KB.

#### 11.3.3 `domainHelper`

- `normalize(value)` — `youtube.com` gibi kanonik alan adını döndürür veya `null`.
- `matches(hostname, site)` — `hostname`, `site` alanına aitse `true` (alt alan adlarını da kapsar).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — arka plan konsoluna yazar.

Bu mesajları görmek için: `chrome://extensions` → Developer Mode'u etkinleştirin → eklentinin "service worker" bağlantısına tıklayın.

#### 11.3.5 `platformHelper`

Desteklenen sosyal/video platformlarını inceler.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — kanonik platform adını döndürür veya `null`.
- `normalizeAuthor(author, platform)` — belirli platform için yazar tanımlayıcısını (handle, URL vb.) normalize eder veya `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — `{ platform, hostname, pathname, type, authors, url }` döndürür veya `null`.
  - `type` değeri `"short" | "long" | "post" | "unknown"` olur.
  - `authors`, bu URL'den tespit edilebilen normalize yazarların listesidir.
- `getType(urlOrHost)` — `detect(...).type` için kısa yol.
- `getPlatform(urlOrHost)` — `detect(...).platform` için kısa yol.
- `getAuthors(urlOrHost)` — `detect(...).authors` için kısa yol.
- `matchesAuthor(urlOrHost, platform, authors)` — URL bu platformdaysa ve verilen yazarlardan biri eşleşiyorsa `true` döndürür.

### 11.4 Örnekler

Kolay: hafta içi sabahları sosyal medyayı engelle.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Orta: tarayıcı oturumu başına 30 dakika YouTube, görünür geri sayım ile.

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

Daha zor: TikTok oturumunu yalnızca kısa videoysa VE yazar dikkat dağıtıcı listenizdeyse engelle. `platformHelper` kullanın.

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

(`globalThis.location` sadece örnek bir yer tutucudur — normalde `platformHelper`'ı worker'ın konumundan değil kendi mantığınızdan beslersiniz; çünkü arka plan worker'ında gerçek bir sayfa URL'si yoktur.)

En zor: her gün dönen "günün sitesi", yeniden başlatmalarda kalıcı günlük limit ile.

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

## 12. Çoklu sayfa davranışı

- Aynı gruptaki tüm açık sekmeler aynı sayacı paylaşır.
- Aynı gruptaki bir sekmeye geçtiğinizde katman, güncel paylaşılan süreyi göstermek için anında yenilenir.
- Yeni kural eklendiğinde tüm açık sayfalar değişikliği algılar ve saniyenin çok küçük bir bölümünde yenilenir; sekmeleri elle yeniden yüklemeniz gerekmez.
- Kural süresi dolduğunda gizlenen akış kartları ve gezinme düğmeleri bir sonraki yenilemede geri yüklenir.

---

## 13. Uluslararasılaştırma

Tüm arayüz tamamen çevrilidir. Sağ üstteki **Language** seçicisini kullanın.

Desteklenen diller arasında İngilizce, Çince (Basitleştirilmiş), İspanyolca, Japonca, Korece bulunur; ayrıca Hintçe, Arapça, Bengalce, Portekizce, Rusça, Pencapça, Almanca, Fransızca, Türkçe, Vietnamca, İtalyanca, Tayca, Felemenkçe, Lehçe, Endonezce, Urduca ve Farsça için kısmi kapsam vardır. Kısmi kapsama sahip dillerde eksik metinler için İngilizceye geri dönülür.

Talimat kılavuzunun kendisi, seçtiğiniz dile karşılık gelen markdown dosyasını yükler; yedek dil İngilizcedir.

---

## 14. Durum mesajları

Durum mesajları ortalanmış bir toast olarak görünür ve yaklaşık iki saniye sonra solar:

- "Saved changes."
- "Created \"Group name\"."
- "Allowed minutes must be a number greater than 0." gibi doğrulama hataları.
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

Biçim gereksinimi olan giriş alanlarında mesaj, ilgili düğmenin yanında da görünür (snooze için).

---

## 15. Gizlilik ve depolama

- Her şey yerel olarak `chrome.storage.local` içinde saklanır. Hiçbir veri bir yere gönderilmez.
- Saklanan öğeler şunları içerir: gruplarınız, kullanım sayaçları, son sıfırlama zamanları, snooze kayıtları, özel sayaçlar ve özel kalıcı değerler.
- Eklenti, sayfa türünü tespit etmek için gerekenin ötesinde sayfa içeriğini okumaz (yol/ana makine adı/video siteleri için bilinen DOM işaretleri). Mesajlarınızı, gönderilerinizi, yorumlarınızı veya özel içeriğinizi okumaz.

---

## 16. İzinler

- `storage` — yukarıdaki veriler için.
- `declarativeNetRequest` — `Default` gruplarının yerel engellenmesi için.
- `alarms` — kural geçişlerini verimli planlamak için.
- `host_permissions: <all_urls>` — content script'in sayaç katmanını gösterebilmesi ve herhangi bir sayfada platform bağlamını tespit edebilmesi için.

---

## 17. Sorun giderme

- **Eklediğim bir grup hiçbir şey yapmıyor.** Grubun etkin olduğundan, takvimin şu an izin verdiğinden, aktif bir snooze olmadığından ve (platform grupları için) sayfanın gerçekten seçilen içerik türü ile yazar filtresine uyduğundan emin olun.
- **Bir sekmede sayaç takılı kaldı veya yanlış.** Başka sekmeye geçip geri dönün ya da sekmeyi odaklayın — bu, paylaşılan sayaçtan zorunlu yenilemeyi tetikler.
- **Gizli olması gereken akış kartları yeniden görünüyor.** Akış gizleme yalnızca kural aktif biçimde engellerken çalışır. `after-minutes` kuralı kullanıyorsanız, akış gizleme süreniz sıfıra inince devreye girer.
- **Gizlenmesini beklediğim bir YouTube gezinme düğmesi hâlâ görünüyor.** Gezinme gizleme için kuralın "do not filter by author" olması ve içerik türünün Shorts veya YouTube posts olması gerekir. Yazar filtrelerinde gizleme yalnızca kart bazındadır.
- **Custom kural hiçbir şey yapmadı veya sessizce hata verdi.** `chrome://extensions` açın, Developer Mode'u etkinleştirin, eklentinin "service worker" bağlantısına tıklayın ve konsolu kontrol edin. Kuralı izlemek için `helpers.logHelper.log(...)` kullanın.
- **Bir grubu silemiyorum.** Büyük olasılıkla dondurulmuştur. Strict-frozen gruplar kilit süresi bitmeden hiç silinemez; strict olmayan dondurulmuş gruplar dondurma kaldırma ritüeliyle silinebilir.

---

## 18. Sözlük

- **Block group** — kendi türü, davranışı, takvimi ve dondurma/ertelemesi olan tek kural seti.
- **Instant block** — kural etkin olduğu anda hemen engeller.
- **After-minutes block** — kural, dönem bütçesi tükendikten sonra engellemeye başlar.
- **Reset interval** — after-minutes bütçesinin ne sıklıkla sıfırlandığı.
- **Schedule** — bir grubun etkin olduğu günler + zaman pencereleri.
- **Freeze / Strict freeze** — kurcalamaya karşı durumlar.
- **Snooze** — yazılı gerekçe ile geçici devre dışı bırakma.
- **Author filter** — platform gruplarında kuralı belirli içerik üreticileriyle sınırlar.
- **Content type** — platform gruplarında kuralı belirli içerik biçimleriyle sınırlar (short, long, post).
- **Helpers** — özel kural fonksiyonuna geçirilen yardımcı araçlar.
- **Platform** — `youtube`, `tiktok`, `facebook`, `instagram`, `twitch` değerlerinden biri. Her birinin kendi grup türü ve akış gizleme mantığı vardır.

---

## 19. Sınırlamalar

- Akış gizleme, her platformun güncel DOM yapısına bağlıdır. Platform düzenini değiştirirse gizleme seçicilerinin güncellenmesi gerekebilir.
- YouTube dışı siteler için platform bağlamı tespiti çoğunlukla URL tabanlıdır; bu nedenle en güvenilir sonuçlar kanonik içerik URL'lerinde alınır.
- Custom kural döngüleri sayfalarda değil arka plan worker'ında çalışır; bu yüzden fonksiyon içinde DOM düzeyi bilgi mevcut değildir. Bunun yerine URL dizesiyle `platformHelper.detect(url)` kullanın.
- Tarayıcı service worker'ı boşta kalınca askıya alabilir. Eklenti, bir sayfa veya alarm ihtiyaç duyduğunda hemen yeniden başlatır; kullanım sayaçları bu nedenle doğruluk kaybetmez.

