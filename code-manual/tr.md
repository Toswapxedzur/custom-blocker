# Vault tarayıcı uzantısı kod kılavuzu

[Kullanıcı kılavuzu](../manual/tr.md)

## Kural sözleşmesi

Source: tek bir function expression `(on, v) => { ... }`. Yalnızca eşzamanlı JavaScript ve aşağıdaki API desteklenir; JavaScript zamanlama geri çağrıları, ağ, uzantı API’leri veya doğrudan DOM erişimi yoktur. Zamana dayalı kurallar aşağıdaki yönetilen zamanlayıcıları/izleyicileri veya `ev.now` ve olayları kullanır.

- Düzenleme taslağı kaydeder; **Run** kuralı etkinleştirip grubu açar. Dondurulmuş gruplar Run çalıştıramaz. Boş source kuralı kaldırır.
- Başarılı Run, `v.state` değerini koruyarak handlers ve panels öğelerini değiştirir. Derleme/kayıt başarısız olursa önceki kural korunur; timeout kuralı durdurabilir. Engine yeniden yüklendiğinde son etkinleştirilen source yeniden kaydedilir; closure variables sıfırlanır.
- Kayıt sırasında state başlatılabilir, handlers kaydedilebilir, panels gösterilebilir ve log yazılabilir. Sayfa/dosya işlemleri ve emits handlers içinde olmalıdır; kayıt sırasında kuyruğa alınan işlemler atılır.
- Disable, handlers öğelerini bastırır ve yönetilen panels, sheets, covers ve öğe kararlarını kaldırır. Enable, saklanan panels/sheets öğelerini geri yükler ve items isteklerini yeniler. Run mevcut sheets, covers veya öğe kararlarını temizlemez. Delete kuralı ve state/effects değerlerini kaldırır. Gezinme, DOM değişiklikleri ve dosya yazımları geri alınmaz.
- Events normal grup hedefleriyle sınırlı değildir; rule içinde URLs/items filtreleyin. Actions kuyruğa alınır ve dispatch sonrasında uygulanır. Exceptions, handler'ın state/actions değerlerini geri almadan o handler'ı durdurur; sonraki handlers çalışabilir. Yalnızca file/query events eylem onayı sağlar.

## Ortak API

- `on(type, handler)` → boolean. `handler(ev)` kaydeder; birden çok handlers kayıt sırasıyla çalışır. False, geçersiz arguments veya handler limitinin dolduğu anlamına gelir. `ev = { type: string, now: number, data }`; `now` Unix milisaniyesidir.
- `v.state`: event dispatch sonrasında kaydedilen değiştirilebilir JSON object. Mevcut state'i ezmek yerine eksik fields değerlerini başlatın. Non-object veya array atanması `{}` değerine sıfırlar; serileştirilemeyen/aşırı büyük güncellemeler kaydedilmez.
- `v.log(...values)`: bu grubun Log kaydına yazar. İşleyici hataları ve bildirilen sayfa eylemi hataları da burada görünür; bildirim, eylemleri yeniden yürütmez. Logs/Clear her grup için bağımsızdır. Yükleme hataları Run durumunda görünür.
- `v.emit(type, data)`: geçerli event sonrasında bu grubun handlers değerleri için `data` öğesinin JSON kopyasını yeni `now` ile kuyruğa alır; eşzamanlı çağrı değildir.
- `v.panel(id, spec, tabId?)`: grubun adlandırılmış panelini değiştirir; erişilebilir tüm web sayfaları için `tabId` değerini atlayın veya integer tab ID kullanın. Null `spec` paneli kaldırır. Panels bölümüne bakın.
- `v.file(op, path, payload?)` → request ID string. Files bölümüne bakın.

Aşağıda adı verilen yönetilen zaman nesnesi oluşturucuları dışında, diğer ortak çağrılar `undefined` döndürür. IDs/state, görüntülenen ada değil gruba aittir.

## Yönetilen zamanlayıcılar ve kayan kullanım

`v.timer(id, {direction:"down", durationMs:300000})` başlangıçta duraklatılmış, adlandırılmış bir geri sayım oluşturur veya mevcut olanı döndürür. İleri sayan bir zamanlayıcı için `{direction:"up"}` kullanın. Döndürülen nesne `start()`, `pause()`, `resume()`, `reset()` ve `snapshot()` yöntemlerini sunar. Start/resume idempotenttir; reset, geçen süreyi sıfırlayıp duraklatılmış duruma döndürür. Anlık görüntü alanları `ready`, `error`, `elapsedMs`, `remainingMs` (ileri sayımda null), `running` ve `completed` içerir.

Çalışan zamanlayıcılar, uygulama/tarayıcı kapalıyken veya kural devre dışıyken gerçek zamanla ilerler. Tamamlanan geri sayım, `timerEnded` olayını `{id, direction, durationMs, generation, incarnation}` verisiyle, her zamanlayıcı örneklenmesi ve nesli için her üyeye kuralı bir sonraki kez çalıştığında bir kez iletir; Run bunu yeniden oynatmaz. İletim, ana sistemin olaylarına bağlıdır; bu gerçek zamanlı bir alarm değildir. Mevcut metin denetimi üzerinden göstermek için bir panele `{type:"timer", timerId:"focus", label:"Focus"}` ekleyin.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` adlandırılmış bir aktif kullanım izleyicisi oluşturur veya mevcut olanı döndürür. `assign({websites:["youtube.com","reddit.com"], apps:[]})` bu üyenin hedef atamalarını değiştirir. Yerel kurallar bunun yerine platforma ait uygulama kimliklerini atayabilir. Alan adları alt alan adlarını da kapsar. Bir izleyici hedeflerinin kullanımını ortak havuzda toplar; diğer kimliklerin bağımsız hakları vardır. `snapshot()`, `ready`, `error`, `usedMs`, `remainingMs`, `available` ve `nextReturnAtMs` (kaydedilmiş herhangi bir kullanımın geçerliliğini yitireceği en yakın milisaniye) döndürür. `available(target?)`, bir hedef verildiğinde atamayı da denetler. `reset()` bu nesnenin geçmişini temizler.

Hak sınırını aşan kullanım dahil, gözlemlenen uygun kullanımın tamamı sayılır; izleyici kendi başına sayfa/uygulama engellemez. Görünür sayfaların çakışan aralıkları bir kez sayılır; yerel uygulamalarda gözlemlenen ön plan kullanımı sayılır. Devre dışı kurallar kullanım eklemez; geçmişin süresi yine aralıkların tam sınırlarında dolar. Kullanılabilirlik, yalnızca kalan geçmiş limitin altına düştüğünde geri gelir. Düzenli etkinlik sinyali örnekleri beş saniyeyle sınırlıdır; kapatma/devre dışı kalma boşlukları etkinlik üretmez. Kullanıcının yaydığı olaylar kullanım eklemez.

Bağlı özel gruplardaki aynı nesne kimlikleri, tek bir yerel merkez yetkili durum kaynağını paylaşır. Bağlama, izleyici geçmişini ve atamalarını birleştirir ve bağlantıyı başlatan üyenin zamanlayıcı durumunu korur; uyumsuz yapılandırmalarda bağlama reddedilir. Her üye kendi tamamlanma olayını alır. Bağlantının kopması, güncel yetkili kaynak geri gelene kadar paylaşılan izleyicileri kullanılamaz kılar ve zamanlayıcı denetimlerini reddeder. Bağ kaldırıldığında her üye son paylaşılan kullanımı ve zamanlayıcı durumunu korur, kendi hedeflerini geri yükler ve eski bağdan gelen komutları bırakır. Merkez, geri dönen üye son anlık görüntüyü kaydedip onaylayana kadar onu saklar; yeni bir bağlantı kullanılabilir olmadan önce bekleyen devirler tamamlanır.

Adlandırılmış nesneler, ayrılmış `v.state.$vaultTime` alanında Run ve yeniden başlatma sonrasında korunur; bu alanı doğrudan düzenlemeyin. Açıkça kaldırmak için `v.removeTime(id)` kullanın. Kimlikler 1–80 ASCII harfi, rakam, `_` veya `-` içerir; ayrılmış özellik adları reddedilir. En fazla 32 nesne, kuralın 64 KiB UTF-8 durum limitini paylaşır. Süreler, en fazla 365 gün olmak üzere tam sayı milisaniyelerle belirtilir. Kayan geçmiş 1024 dakikalık kova ve 2048 birleştirilmiş aralıkla sınırlıdır. Geçmiş kapasitesi hataları, açıkça sıfırlanana kadar izleyiciyi kullanılamaz durumda bırakır; geçersiz yapılandırmalar ve aşırı büyük kayıtlar, kayıtlı verileri silmeden hata bildirir.

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## Tarayıcı events

Aşağıdaki payload gösterimi yürütülebilir kod değil, types bilgisi verir. `?` isteğe bağlı fields alanlarını belirtir.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` yaklaşık değerdir; tick sayısı yerine timestamps kullanın. `active`, tarayıcı penceresinde seçili sayfa anlamına gelir; kullanıcının sayfaya baktığını kanıtlamaz. URLs boş/kısıtlı olabilir.
- `visible`, erişilebilir ve gizli olmayan sayfalardan gelir; `elapsedMs` son heartbeat üzerinden geçen süredir ve sayfa kaplanmışken sıfırdır. Birikmiş kullanım veya oynatma süresi değildir.
- `items`, desteklenen yeni/değişmiş akış öğelerini bildirir ve Run/yeniden etkinleştirme sonrasında tekrar gönderir. `ref`, o sayfadaki kartı tanımlar, kalıcı content ID değildir; `ref === "page"` sayfanın kendisini belirtir. Başlıklar/URLs/yazarlar boş olabilir. `authors`, platforma özel source identifiers içerir.
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Öğelerin kullanılabilirliği sayfanın desteklenen markup öğesine bağlıdır.
- Tags, bağlı desktop Classifier ve etiketlemenin etkin olduğu build/platform gerektirir (Chromium ve Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence 1–5 arasındadır. `tagsSettled === false` beklemede/kullanılamaz demektir, etiketsiz değil; settled `tags: []` etiketsiz demektir.
- `snooze`, grubun Snooze düğmesine basıldığı anlamına gelir. Tek başına duraklatma uygulamaz.
- Query/file yanıtları isteği yapan gruba yöneltilir. `requestId` ile eşleştirin, `error`/`ok` denetleyin ve ticks kullanarak deadline belirleyin: sayfa kapanınca, engine yeniden yüklenince veya grup kapatılınca yanıtlar kaybolabilir. Request IDs Run sonrasında tekrarlanabilir; bekleyen requests kalıcı iş değildir.

## Tarayıcı eylemleri

Integer `tabId` bir event içinden gelmelidir. Page actions, Vault'ın erişebildiği sayfa gerektirir; tarayıcının dahili sayfaları kullanılamaz. Geçersiz girişler/kullanılamayan hedefler genellikle etkisizdir.

- `v.item(tabId, ref, verdict)`: `"hide"` bir akış kartını kaldırır, `"dim"` medyasını kaplar, `"allow"` alt gruplardan muaf tutar, `null` bu grubun verdict değerini temizler. Bilinmeyen refs etkisizdir; `v.cover` ile `isPage` değerini kullanın. Verdicts grup listesi sırasına uyar: üstteki hide kazanır; üstteki dim, alttaki allow sonrasında da sürer; allow alttaki verdicts değerlerini önler. Yeniden kullanılan/kaldırılan kart için yeni karar gerekir.
- `v.cover(tabId, on, message?)`: true sayfayı kaplar, false özel kaplamayı kaldırır; message varsayılan olarak boş (en fazla 500 karakter). Her sayfada bir custom-cover slot vardır; grup sırasından bağımsız olarak son uygulanan cover çağrısı kazanır. Adres değişikliği kaplamayı kaldırır; normal engelleme yine de sayfayı kaplayabilir.
- `v.go(tabId, target)`: HTTP(S) URL veya `"back"`, `"forward"`, `"reload"` (target en fazla 4096 karakter).
- `v.close(tabId)`: tab öğesini kapatır.
- `v.css(tabIdOrStar, id, css)`: integer tab ID veya `"*"`; o ID'ye sahip grup stylesheet değerini değiştirir veya null ile kaldırır. Adres değişikliğinde tab sheets sona erer; `"*"` sheets gelecekteki sayfalara da uygulanır. ID en fazla 80, CSS en fazla 100000 karakter.
- `v.dom(tabId, selector, op, arg?)`: CSS selector (en fazla 1000); `scrollTo` dışındaki tüm eşleşmeler ilkini kullanır. Ops: `hide` inline `display:none!important` ayarlar; `show` inline display değerini kaldırır; `click`; `setText` metni `arg` ile değiştirir; `addClass`/`removeClass` bir class name kullanır; `scrollTo` görünür konuma getirir. Arg en fazla 2000. Değişiklikler açıkça geri alınana/sayfa değiştirilene kadar sürer.
- `v.query(tabId, selector)` → request ID string veya geçersiz arguments için null. Sonuç sonraki bir `query` event değeridir: en fazla 50 matches, küçük harfli `tag`, normalized text ≤1000 karakter, attributes ≤2000, value ≤1000. Eşleşme olmaması başarılı `[]`; geçersiz CSS `error: "invalid-selector"` verir. Vault receiver olmayan bir sayfa yanıt vermeyebilir.

## Panels

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

Varsayılan: sağ alt konum; dikey layout; sola hizalama; role region; içerik kadar genişlik. Genişlik presetleri 220/280/360px; sayısal panel genişliği 180–520px aralığına alınır. Control genişliği 32–520px, yükseklik 20–360px aralığındadır. Sayısal boyutlar pixel strings de kabul eder. Dikey varyantlar aralığı değiştirir; inline/row satır kaydırmaz; wrap/toolbar kaydırır; twoColumn/grid/split/form ızgara kullanır; stack boşluğu en aza indirir. Role erişilebilirlik anlamı sağlar, modal engelleme değil.

IDs ASCII letters/digits/`_`/`-` biçimine normalize edilir (en fazla 80); benzersiz ve kararlı IDs seçin. Atlanan control ID `control-N` olur; atlanan/bilinmeyen type text olur. Atlanan text/lists boştur; disabled false olur. `v.panel` çağrısı spec değerinin tamamını değiştirir. Atlanan `value`, control için son event value öğesini yeniden kullanır, ardından type normalization uygular; açıkça verilen `value` bunu geçersiz kılar. Autofocus varsayılan olarak false. Bilinmeyen fields atılır; rule tarafından sağlanan panel renkleri/fonts/CSS desteklenmez.

Control alanları ve değerleri:

- `text`: string `text`; varsayılan label. `html`: string `html`; scripts, event attributes, tehlikeli URLs ve styling kaldırılır.
- `button`: `label`, isteğe bağlı `action: "submit" | "cancel" | "close"`; value string (varsayılan boş). Actions events üretir; otomatik olarak bir şeyi göndermez/kapatmaz.
- `checkbox`, `toggle`: boolean `value` (varsayılan false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (varsayılan boş). Boş option values kaldırılır; labels varsayılan olarak value olur.
- `textInput`, `textarea`: string value (varsayılan boş), `placeholder`; textarea `rows` 1–12 (varsayılan 3).
- `numberInput`, `range`: numeric value (varsayılan 0), `min`, `max`, pozitif `step`. Values sınırlar içinde kalır; belirtilmeyen normalization sınırları −1000000…1000000. Range widgets varsayılan 0…100; açık sınırlar belirleyin.
- `date`: string `YYYY-MM-DD`; `time`: string `HH:MM` veya `HH:MM:SS`; geçersiz ilk biçimler boş olur. `color`: `#RRGGBB` (varsayılan `#000000`).
- `pin`: rakam string'i; `length` 3–12 (varsayılan 6), `masked` varsayılan true, `autoSubmit` false. `section`: `text`, `controls`, isteğe bağlı layout/align/role (role varsayılan group); depth 3'teki child sections children içermez (root controls depth 0).

Panel events: giriş controls öğeleri `input`/`change` gönderir (text input blur/Enter ile, textarea blur/Ctrl-or-Cmd+Enter ile değişir). Normal controls ayrıca `focus`, `blur`, `key` gönderir; key metadata rule'a iletilmez. Buttons `click` **ve** yapılandırılmış action öğesini ayrı events olarak gönderir; yalnızca birini işleyin. PIN, autoSubmit tamamlanınca `change` ve `submit` gönderir. Mount/unmount `controlId: ""`, `value: true` kullanır. `values`, ID ile anahtarlanmış geçerli giriş değerlerini içerir; buttons/text/HTML içermez. Events kaynak tab ID taşımaz; sekmeye özgü etkileşimlerde ayrı panel IDs kullanın.

Metin sınırları: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; diğer value strings 512; option value/label 256. Fazlalık kesilir.

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Settings içinde **Özel kural klasörü** ve izin gerekir. Safari native klasör seçiciyi ve korunan security-scoped grant değerini kullanır; yalnızca seçilen klasöre erişilebilir.

- `path` görecelidir; `/` dizinleri ayırır. Segmentlerde ASCII letters/digits, boşluklar ve `_.,@()-` kullanılabilir; başında nokta, `.`/`..`, absolute path veya URL olamaz. Dosya uzantısı: `.txt`, `.csv`, `.json` (büyük/küçük harfe duyarsız). List path bir directory'dir; `""` seçili root öğelerini listeler. Symlinks üzerinden olanlar dâhil, seçili klasör dışına çıkan yollar reddedilir.
- Read UTF-8 text döndürür. Write değiştirir/oluşturur; append otomatik newline olmadan oluşturur/ekler. Yazarken parent directories oluşturulur. String payload aynen yazılır; diğer JSON payloads serileştirilir; null/atlanmış boş text demektir. JSON/CSV parsing rule'a aittir. En büyük dosya boyutu: 1048576 UTF-8 bytes.
- List doğrudan görünen alt dizinleri ve desteklenen dosyaları döndürür. Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; dosyalarda extension noktayı içerir. Exists, desteklenen bir file path için boolean döndürür.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Kullanılmayan result fields null; başarıda error boştur. Hatalara invalid-path, unsupported-file-type, permission/folder unavailable, missing file ve file-too-large dahildir. error değerini sabit ve eksiksiz enum değil, string olarak değerlendirin. Requests işlem/sıra garantisi vermez; her path için read-modify-write işlemlerini serileştirin.

## Sınırlar

Grup başına her olay için: kuyrukta 256 eylem, 200 günlük çağrısı, 64 olay yayımı; fazlası atılır. Kural başına: 1000 işleyici, 24 panel; her denetim listesi 32 girdi ve her seçim 64 seçenek içerir; fazlası yok sayılır/kesilir. Olay yayım zincirleri 16 nesilden sonra durur. Serileştirilmiş durum limiti: 65536 UTF-8 baytı. Kayıt işlemini ve her olayın işleyicilerinin toplam süresini 1 saniyenin altında tutun; tekrarlanan aşımlar veya kesin zaman aşımı, Run çalıştırılana kadar grubu durdurur. Log 200 girdi tutar, grup başına saniyede 50 girdi kabul eder ve uzun mesajları yaklaşık 4096 karakterde keser. Zamanlayıcılar/yanıtlar olanaklar ölçüsünde çalışır; gerçek zaman garantisi yoktur.

## Tam kural

Snooze veya panel düğmesiyle başlatılan beş dakikalık duraklama:

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```
