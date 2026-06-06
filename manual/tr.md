# Özel Web Engelleyici — Kullanım Kılavuzu

Bu, uzantının tam referans kılavuzudur. En kolay, en yaygın iş akışlarıyla başlar ve yavaş yavaş özel olaya dayalı engelleme kuralları ve yardımcı API gibi gelişmiş konulara geçer.

Yepyeniyseniz **Hızlı başlangıç** ve **Grupları engelle'ye genel bakış** bölümlerini okuyun. Ne yapmak istediğinize bağlı olarak bu bölümlerin altındaki her şey isteğe bağlıdır.

---

## 1. Bu uzantı ne işe yarar?

Özel Web Engelleyici, web sitelerini ve çevrimiçi dikkat dağıtıcı unsurları kendi tanımladığınız kurallara göre engellemenizi sağlar. Şunları yapabilirsiniz:

- Tarayıcının yerel ağ engellemesiyle siteleri hemen engelleyin (`ERR_BLOCKED_BY_CLIENT` üreten aynı tür blok).
- Bir sitede kendinize günde belirli sayıda dakika ayırın ve bu sınırı aştığınızda siteyi engelleyin.
- Yutub, kısa video ağı, Feysbuk, fotoğraf ağı, Tiviç ve Redit'te (sitenin tamamında değil) belirli içerik türlerini engelleyin.
- Yalnızca tek sayfaları engellemek yerine, desteklenen platformlardaki akışlarda engellenen içeriği gizleyin.
- Haftanın gününe ve `HHMM-HHMM` zaman pencerelerine göre bir kuralın ne zaman aktif olacağını zamanlayın.
- Kolayca değiştirememek için bir kuralı dondurun. Kesin dondurma, belirli bir saat boyunca onu kilitler ve geri alınması için 20 adımlı bir onay ritüeli gerektirir.
- Bir kuralı geçici olarak erteleyin, ancak bunu yalnızca yeterince uzun bir gerekçe yazdıktan sonra yapın.
- İleri/geri zamanlayıcılar, grup başına kalıcı depolama, platform başına DOM amaçları (gezinme düğmelerini gizleme, besleme kartlarını yüklemeye göre gizleme, alt bölüm başına zamanlayıcıları ayarlama), URL yardımcı programları ve yapılandırılmış günlük kaydı için yardımcılarla betik dili'te **olay odaklı** özel kurallar yazın.
- 50'den fazla hazır şablondan (zamanlayıcılar, programlar, yayın gizleme, odak oturumları, yönlendirmeler, dürtüklemeler, kalıcılık, DOM ayarlamaları, hata ayıklama yardımcıları) oluşan yerleşik kitaplıktan seçim yapın.
- Uzantıyı 20'den fazla dilde kullanın.

Uzantı, bir düzenleyici sayfası (açılır pencere), bir arka plan hizmet çalışanı, özel kural kodunu barındıran bir ekran dışı sanal alan ve her sayfada çalışan bir içerik komut dosyası içeren bir Krom tarayıcısı Manifest V3 uzantısıdır. Özel kurallar ekran dışı sanal alanda bulunur; Çalıştır tıklaması başına bir kez yüklenirler ve kural devre dışı bırakılana veya silinene kadar kayıtlı kalırlar.

---

## 2. Kullanıcı arayüzü turu

Uzantının simgesini tıkladığınızda düzenleyici tam bir web sayfası olarak açılır (küçük bir açılır pencere olarak değil). Sayfada şu alanlar bulunur:

- **Üst çubuk**
  - **Kullanma Kılavuzu** düğmesi (bu belge)
  - **Dil** seçici
  - **Ayarlar** donanımı (**Hata ayıklama modu** dahil gelişmiş geçişler)
- **Sol panel — Blok Grupları**
  - Blok gruplarınızın listesi. Her kartta grup adı, kısa bir özet satırı ve etkinleştirme/devre dışı bırakma onay kutusu gösterilir.
  - **Ekle** düğmesi yeni bir grup oluşturur. Yanındaki açılır menü türü seçer.
  - **Tümünü Sil**, herhangi bir grubun dondurulması durumunda ekstra onaylarla birlikte her grubu kaldırır.
  - Grupları yeniden sıralamak için karttaki `::` tutamacını yukarı veya aşağı sürükleyebilirsiniz.
  - Bu paneli yeniden boyutlandırmak için dikey ayırıcıyı sürükleyebilirsiniz.
- **Sağ panel — Düzenleyici**
  - Seçili olan grubu düzenler: ad, engelleme davranışı, engelleme listeleri, türe özel filtreler, program, dondurma, erteleme.
  - Yazmayı veya etkileşimi durdurmanızın ardından tüm değişiklikler otomatik olarak saniyenin çok küçük bir bölümünde kaydedilir.
  - **Özel** gruplar için düzenleyici ayrıca **Şablonlar** tarayıcısını, **Çalıştır** düğmesini ve **Günlük** panelini (v1.1'de *Etkinlik günlüğü* olarak yeniden adlandırılmıştır) gösterir.
- **Toast** (ortada kaybolan açılır pencere) — "Kayıtlı değişiklikler" gibi durum mesajlarını gösterir. veya giriş hataları.
- **Sayfa içi yer paylaşımı** — Bir sekmede herhangi bir etkin zamanlayıcı veya blok bulunurken, sol üst köşesinde onu etkileyen her kısıtlamayı `hh:mm:ss` (veya `mm:ss`) biçiminde gösteren bir yer paylaşımı görünür. Birden çok kısıtlama birden çok satırda toplanır. Varsayılan blok grubu geri sayımları ve Özel kural zamanlayıcıları bu katmanı paylaşır.

---

## 3. Hızlı başlangıç1. Uzantı simgesine tıklayın. Editör tam sayfa olarak açılır.
2. **Grupları Engelle** panelinde açılır menüden bir grup türü seçin:
   - `Default`, `Yutub`, `kısa video ağı`, `Feysbuk`, `fotoğraf ağı`, `Tiviç`, `Redit` veya `Custom`.
3. **Ekle**'yi tıklayın. Yeni bir grup belirir ve editör onu açar.
4. Ona bir isim verin.
5. Türe özel alanları doldurun (`Default` için bu, **Engellenen web siteleri** listesi anlamına gelir).
6. Sol paneldeki grubun onay kutusunun açık olduğundan emin olun.
7. Listelenen sitelerden birini ziyaret edin. Engellemenin derhal yürürlüğe girmesi gerekiyor.

Mutlu yolun tamamı budur. Bu kılavuzun geri kalanı bunun üzerindeki seçeneklerden ibarettir.

> Özel bir grupta **Çalıştır**'a bastığınızda, yeni kural **gelecekteki** sayfa etkinliklerine eklenir. Zaten açık olan sekmeler, siz onları yeniden yükleyene kadar önceki kuralı çalıştırmaya devam eder. Açılan pencerede her başarılı Çalıştırmadan sonra bu yönde bir hatırlatma görüntülenir.

---

## 4. Blok gruplarına genel bakış

Bu uzantıdaki her şey **blok grupları** olarak düzenlenmiştir. Bir blok grubu bir kural kümesinden oluşur:

- Bir adı, türü ve etkin/devre dışı durumu vardır.
- Engelleme davranışı vardır (hemen, birkaç dakika sonra veya sabit geri sayım).
- İsteğe bağlı bir programa (günler + zaman pencereleri) ve isteğe bağlı dondurma/erteleme kontrollerine sahiptir.
- Türe bağlı olarak web siteleri listesi, Yutub içerik oluşturucu filtreleri, alt düzenleme adları veya etkinliğe dayalı betik dili kuralı gibi ek alanlar bulunur.

İstediğiniz sayıda gruba sahip olabilirsiniz. Aynı sayfaya birden fazla grup uygulanabilir; bu durumda **en katı** kural kazanır:

- "Hemen engelle", "bir süre sonra engelle" seçeneğinden üstündür.
- Daha az süreye sahip olan grup, daha fazla süreye sahip olan grubu yener.

Yani daha fazla grup eklemek sayfa bloğunun yalnızca daha erken oluşmasını sağlar, daha sonra asla.

**Değerlendirme sırası aşağıdan yukarıya doğrudur.** Uzantı, blok gruplarınızı yinelediğinde listenin en altındaki gruptan başlar ve yukarı doğru ilerler. Listenin en üstündeki grup en son değerlendirilir ve "son sözü" alır; örneğin, alttaki grup `helpers.getPlatformHelper().youtube().hideShortButton()`'yu ve üstteki grup `showShortButton()`'yu ararsa düğme görünür kalır. Bu sırayı değiştirmek için karttaki `::` tutamacını sürükleyin.

---

## 5. Grup türleri

### 5.1 `Default` — sıradan web sitelerini engelleyin

Belirli etki alanlarını engellemek için (tipik kullanım durumu).

- **Engellenen web siteleri**: satır başına bir site. Hem `facebook.com` hem de `https://www.facebook.com/somepage` çalışır; uzantı ana bilgisayar adını çıkarır ve normalleştirir.
- Bu ana makine adı ve tüm alt alan adları için bir site kuralı geçerlidir.
- Bu grup türü, `ERR_BLOCKED_BY_CLIENT`'ya benzer şekilde Krom tarayıcısı'un yerel ağ engellemesini kullanır. Bu, engellenen bir URL'ye gezinmenin sayfa yüklenmeden önce durdurulduğu anlamına gelir.

### 5.2 `Yutub` — Yutub ve benzeri video sitelerini engelleyin

Düzenleyiciye **Filtreler** bölümü ekler:

- **İçerik türü**:
  - `Apply to all Yutub pages` — her Yutub sayfası önemlidir.
  - `Apply to Shorts` — yalnızca Shorts sayfaları sayılır.
  - `Apply to long videos` — yalnızca `/watch`, `/live/`, `/embed/`, vb.
  - `Apply to Yutub posts` — topluluk gönderileri (`/post/...`, kanal topluluğu/gönderiler sekmeleri).
- **Yazar filtresi**:
  - `Do not filter by author` — yazarın kimliği önemli değil.
  - `Apply to certain authors` — yalnızca listelenen yazarlar bu grubu tetikler.
  - `Apply to all except certain authors` — listelenen yazarlar muaftır.
- **Yazarlar**: her satıra bir yazar. `@handle`, tam URL'ler, `/channel/UC...`, `/c/...`, `/user/...`'yu kabul eder.
- **Yutub yayınındaki engellenen girişleri gizle**: Bu grup aktif olarak engelleme yaparken, Yutub yayınlarındaki eşleşen kartlar gizlenir. Blok devre dışı kaldığında bir sonraki yenilemede geri gelirler.

Kısa Videolar ve Gönderiler içerik türleri için, herhangi bir yazar filtresi ayarlanmadığında ve grup şu anda engelleme yapıyorsa, uzantı aynı zamanda ilgili gezinme girişlerini (Kısalar kenar çubuğu girişi, Topluluk/Yayınlar kanal sekmeleri) ve "En Son Yutub gönderileri" gibi eşleşen rafları da gizler.

Kısa-uzun tespiti, sayfa biçimleri tespit edilebildiğinde kısa video ağı, Vimeo, Tiviç klipleri/VOD'lar ve Dailymotion gibi diğer video sitelerini de kapsar.

### 5.3 `kısa video ağı` — kısa video ağı içeriğini engelle

Platform video düzenleyicisiyle aynı editör kartı, ancak kısa video ağı'a özel etiketler içeriyor:- İçerik türleri: kısa videolar, videolar, profil sayfaları.
- Yazarlar: kısa video ağı (`@handle`) veya profil URL'lerini yönetir.
- Feed gizleme, grup aktifken kısa video ağı sayfalarındaki eşleşen kartları gizler.

### 5.4 `Feysbuk` — Feysbuk içeriğini engelle

- İçerik türleri: Makaralar, videolar, gönderiler.
- Yazarlar: sayfa adı (`page.name`), profil URL'si veya `profile.php?id=...` formu (sayısal kimlik `id:<number>` olarak korunur).
- Feed gizleme, Feysbuk'ta eşleşen feed kartlarını gizler.

### 5.5 `fotoğraf ağı` — fotoğraf ağı içeriğini engelle

- İçerik türleri: Makaralar, videolar, gönderiler.
- Yazarlar: fotoğraf ağı tanıtıcıları veya profil URL'leri.
- `/reel/`, `/p/`, `/tv/`, `/explore/` gibi ayrılmış yollar yazar olarak değerlendirilmez.
- Feed gizleme, fotoğraf ağı'da eşleşen kartları gizler.

### 5.6 `Tiviç` — Tiviç içeriğini engelle

- İçerik türleri: klipler, akışlar/VOD'lar, kanal sayfaları.
- Yazarlar: kanal adları veya kanal URL'leri.
- `/directory`, `/videos`, `/settings` vb. gibi ayrılmış yollar kanal adı olarak değerlendirilmez.
- Besleme gizleme, Tiviç'te eşleşen kartları gizler.

### 5.7 `Redit` — Redit'i veya belirli alt dizileri engelleyin

- **Alt dizinler**: satır başına bir alt dizin. Boş liste, grubun tüm Redit'e geçerli olduğu anlamına gelir. Hem `productivity` hem de `r/productivity` kabul edilir.

### 5.8 `Custom` — olaya dayalı betik dili tarafından engellenir

Sayfa açma, URL değişikliği, sayfa kalp atışı, zamanlayıcı sonu ve kendi özel etkinlikleriniz gibi olaylar için **işleyicileri kaydeden** bir betik dili işlevi yazarsınız. İşlev, Çalıştır tıklaması başına bir kez çalışır; kayıtlı işleyiciler, siz tekrar Çalıştır'a basana, grubu devre dışı bırakana veya silene kadar tüm gezinmelerde etkin kalır.

`Custom` grupları şunları göstermez: engelleme davranışı, engellenen siteler, izin verilen dakikalar, sıfırlama aralığı, planlama günleri veya zaman pencereleri. **Engelleme Kuralları** düzenleyicisinin yanı sıra standart dondurma/erteleme kontrollerini de korurlar. Ayrıca, parametrelendirilmiş başlangıç ​​kurallarıyla önceden ayarlanmış bir tarayıcıyı açan bir **Şablonlar** düğmesi de vardır; bir ön ayarın uygulanması, onaylandıktan sonra geçerli kuralın yerine geçer.

Özel kurallar referansının ve yardımcı API'nin tamamı için **Bölüm 11**'e bakın.

---

## 6. Engelleme davranışı

Çoğu grup türü için üç moddan birini seçersiniz.

### 6.1 Hemen engelle

Kural, grup açık olduğunda, zamanlama buna izin verdiğinde ve (platform grupları için) sayfa eşleştiğinde etkin olur.

`Default` grupları için bu, Krom tarayıcısı'un yerel engellemesini kullanır. Platform grupları için sayfa içi yer paylaşımı/çıkış mantığını kullanır.

### 6.2 Birkaç dakika sonra bloke edin

Bu bir kullanım bütçesidir.

- **Bloktan önce izin verilen dakika** (ondalık): periyot başına kendinize kaç dakika izin verdiğiniz. Örnek: `15`, `0.5`, `90`.
- **Zamanlayıcı sıfırlama aralığı (saat)** (ondalık): bütçenin ne sıklıkta sıfırlandığı. Örnek: Günlük için `24`, saatlik için `1`, 15 dakikada bir `0.25`.

Zamanınız kaldığı sürece sayfa normal şekilde çalışır ve zamanlayıcı katmanını gösterir. Bütçe sıfıra ulaştığında sayfa dönemin geri kalanı boyunca engellenir ve yer paylaşımında `0:00` gösterilir, ardından sekmeden çıkmaya çalışır.

Uzantı grup başına, dönem başınadır:

- Her grubun kendi bütçesi vardır.
- Grupla eşleşen herhangi bir sayfada harcanan süre, o grubun bütçesine dahil edilir.
- Aynı gruptaki birden fazla sekme bütçeyi paylaşır. Zamanlayıcıları senkronize kalır; başka bir sekmeye geçmek aynı zamanda yenilemeyi de zorlar, böylece geçerli paylaşılan zamanı hemen gösterir.

Aynı sayfaya birden fazla süre sınırlı grup başvuruda bulunursa en katı olan kazanır.

### 6.3 Zamanlayıcı (geri sayım, ardından engelleme)

Bu mod bir geri sayım sayacını gösterir ve `0:00`'ya ulaştığında bloke eder.

- **Zamanlayıcı sıfırlama aralığı (saat)** (ondalık): hem zamanlayıcı uzunluğu hem de sıfırlama frekansı. Örnek: Günlük için `24`, saatlik için `1`, 15 dakikada bir `0.25`.

**Birkaç dakika sonra engelle**'den farklı olarak, bu modda ayrı bir "Engellemeden önce izin verilen dakikalar" alanı **yoktur**. Zamanlayıcı basitçe sıfırlama aralığında başlar, eşleşen sayfalar açıkken geri sayar ve ardından bir sonraki sıfırlamaya kadar bloke eder.Varsayılan grup geri sayımları ve Özel grup zamanlayıcıları (bkz. **Bölüm 11.3.1**) **yalnızca sekme görünür durumdayken ilerler**. Sekmeleri değiştirmek, pencereyi küçültmek veya ekranı kilitlemek geri sayımı otomatik olarak duraklatır.

---

## 7. Program

**Planlama** kartında bir grubun etkin olduğu zamanı kısıtlayabilirsiniz:

- **Engellenecek günler**: Grubun geçerli olacağı günleri seçin. İşaretlenmeyen günler, grubun o gün etkin olmadığı anlamına gelir.
- **Zaman pencereleri**: serbest biçimli liste, `HHMM-HHMM` biçiminde satır başına bir pencere, örneğin:

  ```
  0900-1000
  1200-1300
  ```

  Grup yalnızca bu pencerelerin içinde etkindir. Boş liste tüm gün demektir.

Bu, `Custom` dışındaki tüm grup türleri için geçerlidir. (Özel kurallar `ev.time.dayName` / `ev.time.hour` kullanılarak kendi zamanlamalarını uygulayabilir; bkz. **Bölüm 11.4**.)

---

## 8. Dondur (kurcalamaya karşı koruma)

Dondurmak, bir grubun anında devre dışı bırakılmasını zorlaştırır.

**Dondur** kartında şunları seçersiniz:

- **Dondurulmuş** — grubu düzenleyemez veya silemezsiniz ve etkinleştirme düğmesinin işaretini kaldıramazsınız. Herhangi bir şeyi değiştirmek için dondurmayı çözme ritüelini çalıştırmanız gerekir (aşağıya bakın).
- **Tam dondurulmuş** — Dondurulmuş ile aynıdır, ancak seçtiğiniz birkaç saat (ondalık sayı, 72'ye kadar) boyunca kilitli kalır. Bu zamanlayıcının süresi dolana kadar, buz çözme ritüeli bile kullanılamaz.

Dondurulmuş bir grubun kilidi açılabilir olduğunda **Dondurmayı Çöz** düğmesi görünür. Tıkladığınızda **20 adımlık ritüel** başlatılır:

- Modal bir öz disiplin mesajı gösteriyor.
- `Confirm`'ya 20 kez tıklamalısınız.
- Tıklamalar arasında 5 saniyelik zorunlu bir bekleme vardır.
- Herhangi bir noktada iptal ederseniz 1. adımdan yeniden başlamanız gerekir.
- 20 mesaj dönüşümlü olarak görüntülenir, böylece onları gerçekten okuyabilirsiniz.

Grup aynı zamanda "erteleme yok" olarak işaretlenmişse (sonraki bölüme bakın), dondurulmuş durumdayken de grubu erteleyemezsiniz.

Dondurma durumu, tam dondurma için kalan süre de dahil olmak üzere grup kartının meta satırında gösterilir.

---

## 9. Erteleme (geçici olarak devre dışı bırakma)

Erteleme, bir grubu çözmeden geçici olarak devre dışı bırakır. Gecikmeli etkinleştirmeyi, erteleme sonrası bekleme süresini, onay adımlarını ve toplam erteleme süresini destekler.

**Erteleme** kartında:

- **Bu grup için ertelemeye izin ver** — kapalıysa bu grup hiçbir şekilde ertelenemez (dondurulmuş hali dahil).
- **Erteleme süresi (dakika)** — ondalık sayı, ertelemenin ne kadar süreceği.
- **Etkinleştirme gecikmesi (dakika)** — ondalık `>= 0`. Ertelemeyi onayladıktan sonra grup, bu gecikme geçinceye kadar engellemeye devam eder; ancak o zaman erteleme aktif hale gelir.
- **Ertelemeden sonraki bekleme süresi (dakika)** — `0`'dan `5`'ya kadar ondalık sayı. Erteleme bittikten sonra, bekleme süresi bitene kadar bu grup için başka bir erteleme başlatamazsınız.
- **Onay süreleri** — `>= 0` tamsayı. Bu `0` ise erteleme hemen planlanır. Aksi takdirde, ertelemeyi başlatmak, tam olarak bu kadar adımdan oluşan bir onay ritüelini başlatır.

Her erteleme onay adımında, bir sonraki tıklamaya izin verilmeden önce zorunlu **5 saniyelik bekleme** vardır. Mod size bunu açıkça söyler ve düğmedeki canlı geri sayımı gösterir.

Grup dondurulursa erteleme ayarları, dondurma öncesinde seçilen değerlere kilitlenir. Ertelemeye izin verildiği sürece yine de erteleyebilirsiniz ancak kayıtlı gecikme / bekleme süresi / onay ayarlarını kullanmanız gerekir.

Erteleme kartı aynı zamanda söz konusu grup için **Toplam ertelenen süreyi** de gösterir. Bu toplam, söz konusu pencerede site başka bir nedenden dolayı erişilebilir hale gelse bile tam aktif erteleme süresini sayar.

Erteleme bittiğinde kural hemen geri gelir. Grup henüz dondurulmamışsa, erteleme sonunda uzantı otomatik olarak grubu tekrar dondurur.

Bir durum mesajı ertelemeyi doğrular. Erteleme sona erdiğinde grup otomatik olarak normale döner.

Ayrıca **Ertelemeyi Bitir** düğmesiyle de ertelemeyi erken sonlandırabilirsiniz.

Özel gruplar için **Ertelemeyi Başlat** tuşuna basılması aynı zamanda kurala bir `snoozePress` olayı gönderir (**Bölüm 11**'deki olaylar tablosuna bakın), böylece özel bir kural baskıyı kaydedebilir, gerekçeyi günlüğe kaydedebilir veya takip olaylarını başlatabilir. Kuralda **programatik erteleme API'si yoktur**; basına tepki verebilir, ancak iptal edemez veya uzatamaz.

---

## 10. Toplu işlemler- **Tümünü Sil** her grubu kaldırır.
  - Her zaman onay ister.
  - En az bir grup dondurulursa, buz çözmeyle aynı 20 adımlık ritüeli gerektirir.
  - Herhangi bir grup tamamen dondurulmuşsa ve hâlâ kilitliyse **Tümünü Sil** devre dışı bırakılır.

---

## 11. Özel gruplar — olaya dayalı referans (v1.1+)

V1.1'den başlayarak, özel kurallar **olay odaklıdır**. Kuralınız artık dönüş değeri sayfayı engelleyen kalp atışı başına bir işlev değil. Bunun yerine kural gövdesi, belirli olaylar (sayfa açılması, URL değişikliği, sayfa kalp atışı, özel olaylar,…) için **işleyicileri kaydeden** bir komut dosyasıdır. İşleyiciler, sayfa gezintilerinde ve sekme geçişlerinde kayıtlı kalır ve uzun ömürlü bir **ekran dışı sanal alanda** yaşar.

Kural gövdesi **Çalıştırma tıklaması başına bir kez** (veya grup etkinleştirildiğinde ve etkin bir kaynak zaten mevcut olduğunda bir kez) yürütülür. İşleyicileri yeniden yüklemek için düzenleyicide **Çalıştır**'ı tıklayın. Açılır pencerede, yeni kuralın orada da geçerli olması için zaten açık olan herhangi bir sayfayı yeniden yüklemenizi isteyen bir hatırlatıcı görüntülenir.

### 11.1 Kural imzası

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

İki argüman:

- `event` — bu grubun **olay kaydı**. İşleyicileri kaydetmek, geçersiz kılmak, listelemek, saymak veya kayıtlarını silmek ve `post(...)` özel olaylarını gerçekleştirmek için bunu kullanın.
- `helpers` — yardımcı paket (bkz. **11.3**).

Fonksiyonun bir değer döndürmesi **beklenmez**. Engelleme veya izin verme kararı daha sonra, bir etkinlik tetiklendiğinde ve kayıtlı işleyicilerinizden biri `ev.preventDefault()` ve/veya `ev.setResult(...)`'yu çağırdığında verilir.

### 11.2 Yaşam Döngüsü

- **Çalıştır** (düzenleyicideki grup başına düğme): motor önce daha önce bu grupla etiketlenmiş olan her işleyiciyi siler, ardından kural gövdesini ekran dışı sanal alanda yeniden çalıştırır. Kaynağı düzenledikten sonra yeniden kaydolmanın tek yolu budur.
- **Grubu devre dışı bırak**: Bu grupla etiketlenen her işleyici silinir. Grup kaynağı depoda tutulur ancak olaylara yanıt vermeyi durdurur.
- **Grubu yeniden etkinleştir**: motor, bu grup için etkin kaynağı otomatik olarak yeniden çalıştırır.
- **Grubu sil**: devre dışı bırakmayla aynı; grupla etiketlenen tüm işleyiciler silinir.
- **Aynı `(eventType, id)` ile yeniden kaydolma**: önceki kaydı sessizce geçersiz kılar.

Ekran dışı korumalı alan **tüm** özel gruplar tarafından paylaşılır. Farklı gruplardan işleyiciler burada bir arada bulunur ve her biri dahili olarak kendi grup kimliğiyle etiketlenir; böylece "Çalıştır", devre dışı bırak veya sil yalnızca doğru gruba dokunur.

Özel bir kural hatalı davranırsa (senkronize sonsuz döngü, kaçak günlük spam'i vb.) sanal alan bunu karantinaya alır: grup otomatik olarak devre dışı bırakılır ve hata kaydedilir, böylece Günlük panelinde görebilirsiniz. Karantinaya alınan bir kuralı yeniden etkinleştirmek için kaynağı düzeltin ve **Çalıştır**'ı tıklayın; motor, iptal nedenini temizler ve kuralı yeniden yükler.

### 11.2.1 Olay kaydı (`event`)

Genel yöntemler:

- `event.register(type, id, handler, options?)` — isteğe bağlı bir olay türü için bir işleyici kaydedin. `id` sizin kendi seçiminizdir. `options.priority` (varsayılan `0`) — önce daha yüksek çalıştırmalar. `options.intervalMs` — yalnızca `tickEvent` için; bu özel işleyiciyi genel onay işaretine göre kısın. Aynı `(type, id)` geçersiz kılmalarıyla yeniden kaydolma.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` — özel bir olayı tetikleyin. `scope: "global"` her gruba ulaşıyor; varsayılan `scope: "group"` yalnızca **aynı** gruptaki işleyicilere ulaşır.

Olay türü başına şeker (yerleşik tür başına bir yöntem kümesi):

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress` için aynı şekil.

### 11.2.2 Yerleşik olay türleri

| Tür | Ateşlendiğinde | `ev.data` yükü |
|---|---|---|
| `tickEvent` | Tarayıcının tamamında küresel olarak paylaşılan 1 saniyelik onay işareti. Sekme görünürlüğüne bakılmaksızın tetiklenir. Hiçbir sekmeye odaklanılmadığında bile çalışmaya devam etmesi gereken saat tarzı mantık için bunu kullanın. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | **aktif**, **görünür** sekmesinden ~250 ms kalp atışı. `getOrCreateTimer({ scope })`'da yerleşik otomatik işaretleme de dahil olmak üzere tüm sekme görünürlüğüne duyarlı mantığı çalıştırır. Arka plandaki sekmelerden veya ekran kilitliyken **çalışmaz**. | `{ elapsedMs }` |
| `openWebEvent` | Yeni bir sekme oluşturulur VEYA yeni bir gezinme, motorun o sekme için henüz görmediği bir URL'ye ulaşır. Çalıştır tıklamasından sonra zaten açık olan sekmeler yeniden etkinleşmez**. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Bir sekme kapatıldı. | `{ reason, nextUrl }` |
| `switchWebEvent` | Aynı sekme içindeki URL **değişiklikleri** (geri/ileri, SPA rotası değişikliği veya öncekinden farklı bir URL'ye ulaşan bir gezinme). Düz bir yeniden yüklemede **etkinleşmez** (aynı URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | URL değişikliği bir ana makine adı sınırını aşıyor (ör. `youtube.com` → `wikipedia.org`). `switchWebEvent` ile birlikte ateşlenir. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | Sayfa herhangi bir şekilde (yeniden) yüklenir: açma, değiştirme, SPA geçmişini güncelleme, **veya aynı URL'yi tutan düz bir yeniden yükleme**. Bu güvenilir "sayfa değişti, her şeyi yeniden değerlendirin" kancasıdır. `openWebEvent` / `switchWebEvent` / `switchDomainEvent` ile birlikte tetiklenir ve aynı URL'nin yeniden yüklenmesi için etkinleşen tek kişidir. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` burada `transition`, `"tabCreated"`, `"commit"` veya `"history"`'dur |
| `timerEnded` | Grup tarafından yönetilen bir zamanlayıcı `currentMs === 0`'ya ulaşıyor. Sadece sahibi gruba teslim edilir. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | Kullanıcı bu **özel** grubun açılır penceresinde **Ertelemeyi Başlat** seçeneğine bastı. Saf bildirim olayı — işleyici isteğe bağlı kod çalıştırabilir (günlüğe kaydetme, yönlendirme, diğer olayları tetikleme) ancak özel kurallarda **programatik erteleme API'si yoktur**. Burada üretilen kütükler aktif sekmede kızarmış ekmekler olarak görünür. Sadece preslenen gruba teslim edilir. | `{ triggeredAt }` |

`ev.url`'daki ve etkinlik verilerindeki URL'ler etkinlikler için **normalleştirilmiştir**: Krom tarayıcısı'un Yeni Sekme Sayfası (Google'ın "Google'da Ara veya URL'yi yaz" yüzeyini oluşturur), `about:blank` ve eşdeğer yeni sekme şemaları, boş `""` dizesi olarak gösterilir. Dolayısıyla `ev.url === ""` kapsamına alınan bir zamanlayıcı yalnızca siz yeni sekme sayfasındayken çalışır. Normal `google.com` URL'leri değişmedi.

### 11.2.3 Olay nesnesi (`ev`)

Her işleyici `(ev, helpers) => void` olarak çağrılır. `ev` şunları taşır:

- `ev.type` — gönderilen olay türü.
- `ev.groupId` — alıcı grubun kimliği.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` — etkinliğin bağlamı.
- `ev.time` — `{ now, month, dayOfMonth, dayName, hour, minute }` gönderim anında anlık görüntü. `dayName`, `"Sunday"`..`"Saturday"`'dur.
- `ev.data` — olaya özel yük (yukarıdaki tabloya bakın).

Yöntemler:

- `ev.preventDefault()` — gönderimi "engellendi" olarak işaretleyin. Ana bilgisayar içeriği komut dosyası, daha yüksek öncelikli bir işleyici daha sonra `setResult(1)`'yu ayarlamadığı sürece sayfadan çıkacaktır (veya `setRedirectLink`'yu izleyecektir).
- `ev.stopPropagation()` — bu gönderimi derhal durdurun. **Bu etkinlik için herhangi bir grupta başka işleyici** çağrılmaz.
- `ev.setResult(value)` — gönderim sonucunu ayarlayın. `value`, `[-255, 255]`'da bir **sayı** (`-1` bloğu, `0` nötr, `1` izin verir; diğer tamsayılar kendi hata ayıklama mantığınız için korunur) veya bir **dize** (yönlendirme URL'si olarak yorumlanır) olabilir. Tüm işleyicilerdeki son `setResult` çağrısı kazanır. Sayısal bir `1`, daha önceki herhangi bir `preventDefault`'yu geçersiz kılar.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` — gönderim engellenmiş olarak sona erdiğinde ana bilgisayarın gitmesi gereken URL. Bu, özel kurallardan yönlendirme yapmanın **tek** yoludur; düzenleyici artık Özel gruplar için "Engellendiğinde URL'yi yönlendir" alanını göstermiyor.
- `ev.post(type, data, { scope })` — bir işleyicinin içinden bir takip olayı başlatır.

Ayrıca, `ev` bir Proxy'dir: üzerinde ayarladığınız herhangi bir alan (örneğin `ev.foo = 42`) bir `custom` haritasında saklanır ve aynı işleyiciden veya aynı gönderimdeki sonraki işleyicilerden geri okunabilir.### 11.3 `helpers` nesnesi

Her işleyici çağrısı, kapsamı alıcı gruba ve etkinliğin URL'sine ayarlanmış yeni bir `helpers` paketi alır. Sabit alanlar:

- `helpers.now` — sevk sırasında milisaniyelik dönem.
- `helpers.currentUrl` — yeni sekme/boş normalleştirmeden sonraki etkinlik URL'si.
- `helpers.groupId` — grup kimliğini alıyor.

Kolaylık sağlayan kısayollar (aşağıdaki yardımcılar tarafından kullanılan aynı akümülatör uyumlu işlevlere yönlendirin, böylece çıktı yine de Günlük paneline ulaşır):

- `helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Erişimci yöntemleri:

- `helpers.getLogHelper()` — `log` / `warn` / `error`. Çıkış hızı sınırlıdır ve kaçak kuralların açılır pencereyi dondurmasını önlemek için gönderim başına sınırlanmıştır.
- `helpers.getDomainHelper()` (takma adı `helpers.getDomainUtility()`) — URL denetimi (bkz. **11.3.5**).
- `helpers.getTimerHelper()` — grup kapsamlı zamanlayıcılar (geri sayım / ileri sayım); durum, tarayıcı yeniden başlatıldığında devam eder.
- `helpers.getPersistenceHelper()` — Grubun kapsamına alınan JSON anahtar/değer deposu.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (ve `set` / `get` takma adları) artı verilen mesajı görüntüleyen bir `chrome-extension://...` URL'si döndüren `createMessageUrl(message)`.
- `helpers.getPlatformHelper()` — platform başına DOM amaçları (bkz. **11.3.6**).
- `helpers.getDOMHelper()` — genel DOM amaçları: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. İşlemler toplu olarak işlenir ve işleyici geri döndükten sonra uygulanır.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Efektler, olayın geldiği sekmeye uygulanır.
- `helpers.getStorageHelper()` — `getPersistenceHelper`'nun üst kümesi ve çapraz genişletme depolaması için eşzamansız `requestAsyncGet(key)` / `requestAsyncSet(key, value)` kancaları (sonuçlar özel bir takip olayı olarak gelir).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` etkinlikle birlikte gelen bir anlık görüntüye karşı.

Tüm yardımcı yöntemler güvenlidir: hatalı parametreler `null`, `false` veya atmak yerine boş bir değer döndürür.

#### 11.3.1 `getTimerHelper()`

Grup başına zamanlayıcılar. Her zamanlayıcı seçtiğiniz `id` dizesiyle tanımlanır; kimlik grubun kapsamına alınmıştır, böylece iki grup da `"yt-shorts"` kimliğini çarpışmadan kullanabilir. Durum, tarayıcı yeniden başlatıldığında devam ediyor.

Bir zamanlayıcının kalıcı durumu tam olarak şöyledir: `id`, `displayName`, `direction` (`"forward"` veya `"backward"`), `isPaused` ve `currentMs`. Saklanmış bir "başlangıç ​​süresi" yoktur — `isExpired` yalnızca `currentMs === 0`'dur. İleriye doğru zamanlayıcılar sonsuza kadar ilerler ve asla kendi başlarına sona ermez. Geriye doğru zamanlayıcılar `0`'da çalışmayı durdurur (negatif değer yok).

İki inşaat yöntemi vardır. Semantiği istediğinizle eşleşeni seçin:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — `currentMs` da dahil olmak üzere mevcut herhangi bir durumun üzerine yazarak, zamanlayıcıyı sağlanan başlangıç değerleriyle **her zaman (yeniden)oluşturur**. "Yeniden başlamak" demek istediğinizde bunu kullanın, ör. tek seferlik sıfırlama dalının içinde.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotent**. Bu `id`'ya sahip bir zamanlayıcı zaten mevcutsa `displayName` ve `direction` güncellenebilir ancak `currentMs` korunur. Aksi halde sağlanan başlangıç ​​değerleriyle oluşturulur. Yaygın "zamanlayıcımın var olduğundan emin ol, sonra geçmesine izin ver" modeli için istediğiniz şey budur.

Her iki yöntem de, motorun kuralın ömrü boyunca hatırladığı iki yüklem işlevini kabul eder (kalp atışları ve `webChangedEvent` yeniden değerlendirmeleri boyunca hayatta kalırlar, ancak depolamada **hiçbir zaman kalıcı olmazlar**):- `scope: (url) => boolean` — her `pageHeartbeatEvent`'daki geçerli görünür URL için `true` olduğunda, zamanlayıcı kalp atışı aralığına (~250 ms) göre otomatik olarak işaretler. Yardımcının kendisi asla engellemez; yalnızca `currentMs`'yu günceller. Zamanlayıcı başına kalp atışı başına en fazla bir otomatik tıklama.
- `domain: (url) => boolean` — mevcut görünür URL için `true` olduğunda, zamanlayıcı sayfa içi katmanda (sol üst) oluşturulur. `domain` atlandığında, motor görüntüleme için `scope`'ya geri döner, böylece ekstra kablolama olmadan orada bir "işaretleme/kısa/sayfalar" zamanlayıcısı da görünür. Farklı bir ekran kapısı istiyorsanız `domain`'yu açıkça belirtin (örneğin, yalnızca `/shorts/`'yu işaretleyin, ancak kalan süreyi `youtube.com`'nun tamamında gösterin).

> **Önemli — bir zamanlayıcı asla kendi başına bloke etmez.** Geriye doğru bir zamanlayıcı sıfıra ulaştığında yalnızca sıfırda durur ve `timerEnded`'yu bir kez ateşler. Sayfanın gerçekten engellenip engellenmeyeceği, `helpers.getTimerHelper().isExpired(id)`'yu kontrol ettikten sonra `ev.preventDefault()`'yu çağıran ayrı bir `openWebEvent` / `switchWebEvent` işleyicisine bağlıdır. Bu ayırma, "yalnızca uyarı" zamanlayıcıları, ileri sayım izleyicileri, yumuşak itelemeler veya sert bloklar oluşturmanıza olanak tanır; aynı ilkel, seçiminiz.

Diğer yöntemler:

- `delete(id)`, `pause(id)`, `resume(id)` — standart yaşam döngüsü. Duraklatma `currentMs`'yu dondurur.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — doğrudan değiştiriciler (çoğu kuralın bunlara ihtiyacı yoktur — bırakın kalp atışının zamanlayıcıyı sizin için işaretlemesine izin verin).
- `setDisplayName(id, name)` — yeniden etiketleyin.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` ve `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` veya `null`.
- `list()` — bu grubun sahip olduğu her zamanlayıcı, bir dizi durum nesnesi olarak.

#### 11.3.2 `getPersistenceHelper()`

Harita benzeri depolama alanı grubunuzun kapsamına alınmıştır. Değerler JSON ile serileştirilebilir olmalıdır.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Yumuşak sınırlar: grup başına yaklaşık 200 anahtar, değer başına 16 KB.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — açılır penceredeki **Günlük** paneline yazın (yardımcı paket, bunları hangi dağıtım tarafından üretilirse üretilsin yine de aynı akümülatör aracılığıyla yönlendirir). Her satırın önüne `[CustomBlocker:groupId]` eklenir.
- Yardımcının büyük harfleri vardır: kabaca **gönderim başına 200 günlük girişi** ve giriş başına maksimum dize uzunluğu. Fazla girişler çıkarılır ve `accumulator.logsDropped`'da sayılır. Açılır pencereyi `for (let i = 0; i < 100000; i++) helpers.log(i)` kaçaklarından koruyan şey budur.
- **Hata ayıklama modu** kapalıyken (varsayılan), motorun kendisinin yayınladığı izleme düzeyi girişleri (gönderme başlatma / işleyici zamanlaması) her yerde bastırılır; Günlük panelinde gösterilmez ve konsola yazdırılmaz. Kendi `log` / `warn` / `error` çağrılarınız her zaman iletilir.

#### 11.3.4 `getRedirectionHelper()`

Geçerli sayfanın engellenmesi durumunda içerik komut dosyasının kullanacağı yönlendirme URL'sini inceleyin/geçersiz kılın.

- `get()` — bu gönderim için geçerli etkili yönlendirme URL'sini döndürür. Başlangıçta bu, yerleşik grubun yapılandırılmış geri dönüş URL'sidir (varsa), aksi takdirde `""`.
- `set(url)` — bu gönderim için yönlendirme URL'sini geçersiz kılar. Başarılı olduğunda `true`'yu, dize dışı giriş için `false`'yu döndürür. `""`'nun iletilmesi, yönlendirme geçersiz kılmayı temizler ve normal varsayılan çıkış davranışına geri döner.
- `createMessageUrl(message)` — gezinildiğinde mesajı temiz bir sayfada ortalanmış olarak görüntüleyen bir `chrome-extension://<id>/message-page.html?msg=...` URL'si döndürür. Bir zamanlayıcı sona erdikten sonra kullanıcıları "İşe Git" / "Ara ver" ekranına yönlendirmek için kullanışlıdır. Örnek: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Diğer özel kural yan etkileri gibi bu durum da mevcut gönderimdeki tüm kurallarda paylaşılmaktadır. Kurallar aşağıdan yukarıya doğru çalıştığından, `set(...)` çağrılacak en üstteki kural kazanır.

#### 11.3.5 `getDomainHelper()` (takma adı `getDomainUtility()`)

URL inceleme yardımcıları. Gelen URL'ler zaten yeni sekmeyle normalleştirilmiş olduğundan `normalize()` yoktur.

Çekirdek:- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — her biri `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }` değerini döndürür.

URL filtreleme ve bölüm yardımcıları:

- `isEmptyStartPage(url)` — Yeni sekme sayfası ve eşdeğerleri için `true` (işleyicilere `""` olarak görünen URL'ler).
- `matchesAny(url, patterns)` — `patterns` bir normal ifade, bir dize normal ifadesi veya bunların bir dizisi olabilir.
- `pathStartsWith(url, path)` — sınıra duyarlı (`pathStartsWith("/r/", "/r")` doğrudur; `"/results/"` değildir).
- `queryHas(url, key, value?)`, `queryGet(url, key)` — sorgu dizisi denetimi.
- `isSearchPage(url)` — Google / Bing / DuckDuckGo / Yutub sonuçları / Redit / Tvitter / X aramalarını tanır.
- `isInfiniteFeedUrl(url)` — Yutub, kısa video ağı, fotoğraf ağı, Feysbuk, Redit, X'in algoritmik besleme yüzeylerini tanır.
- `sameSection(a, b)` — aynı ana bilgisayar adı VE aynı ilk yol bölümü.

#### 11.3.6 `getPlatformHelper()`

Platform başına DOM amaçları ve alt bölüm zamanlayıcılarının yanı sıra inceleme. Her `helpers.getPlatformHelper().<platform>()`, yöntem seti **platform tarafından kontrol edilen** bir nesneyi döndürür; belirli bir platformda anlamlı olmayan yöntemler basitçe mevcut değildir; dolayısıyla bunların çağrılması, sessizce işlem yapılmaması yerine `TypeError: ... is not a function`'nun fırlatılmasına neden olur. Örneğin, `twitch().hidePosts` mevcut değil (Tiviç'te gönderi yok) ve `tiktok().hideShortButton` mevcut değil (kısa video ağı'un tüm deneyimi zaten kısa biçimli videodur). Çalışma zamanında iç gözlem yapmak için `helpers.getPlatformHelper().hasMethod(platform, name)` veya `.listMethods(platform)` kullanın.

Platform başına yöntem matrisi:

| yöntem | youtube | tiktok | instagram | facebook | seğirme |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VOD'lar) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (sohbet) |
| `filterComments` | ✓ | ✓ | ✓ | ✓ |  |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |  |  |  | ✓ |
| `isCurrentChannelVerified` | ✓ |  |  |  |  |
| `isLiveNow` | ✓ | ✓ |  | ✓ | ✓ |
| `isItemLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isAlgorithmicRecommendation` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored` | ✓ | ✓ | ✓ | ✓ |  |
| `setShortsTimer` | ✓ |  |  |  |  |
| `setReelsTimer` |  |  | ✓ | ✓ |  |
| `setClipsTimer` |  |  |  |  | ✓ |
| `setStreamsTimer` |  |  |  |  | ✓ |
| `setVideosTimer` | ✓ | ✓ |  | ✓ | ✓ |
| `setPostsTimer` | ✓ |  | ✓ | ✓ |  |

Platformda yerel adlar (`hideReels`, `hideClips`, `hideStreams`) `hideShorts` / `hideVideos`'dan ayrı paketler DEĞİLDİR — depolama yuvası aynıdır; yalnızca kullanıcının görebileceği ad her platformun terminolojisine uygundur.

> **Yüklem ömrü ve tek yuva kuralı.** `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive`'nun her biri **bir** kalıcıya sahiptir `(group, platform, slot)` başına yüklem. Yüklem geçerli olayın kapsamı **değildir**; bir kez ayarladığınızda, eşleşen `show*()` çağrılıncaya veya grup kaldırılıncaya kadar her sayfa yüklemesinde ve her gönderimde etkin kalır. Aynı yöntemin yeni bir işlevle tekrar çağrılması önceki yöntemin **yerini alır**; motor hiçbir zaman birden fazla yüklemi tek bir grup içinde VEYA birleştirmez. Koşulları birleştirmek için birleştirmeyi kendiniz yapan bir yüklem yazın, ör. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. **Farklı** gruplarda, her grup kendi yüklemine katkıda bulunur ve herhangi bir grubun yüklemi eşleşirse bir öğe gizlenir.

İnceleme yöntemleri değerlerini, olayla birlikte verilen bir anlık görüntüden gönderim sırasında alır; onların kullanılabilirliği yukarıdaki matris tarafından kontrol edilir.

URL sınıflandırıcıları platformdan bağımsız olarak her zaman yeniden gösterilir: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.Alt bölüm zamanlayıcıları, zamanlayıcıyı kalıcı grup grubuna kaydeder ve kapsam belirlendiğinde yalnızca o alt bölümle eşleşen URL'leri işaretler. Zamanlayıcı yöntemleri `{ id, direction, currentMs, displayName }`'yu kabul eder ve platform başına aynı geçitlemeyi takip eder.

Yüklem yöntemleri için yüklem, normalleştirilmiş bir `item`: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }` ile eşleşen kart başına çağrılır. Herhangi bir alan `null` olabilir; "suçlu olduğu kanıtlanana kadar masum" — ihtiyacınız olan alan eksik olduğunda `false`'yu döndürün.

### 11.4 Örnekler

**Kolay** — Hafta içi sabahları Yutub Shorts sayfalarını engelleyin:

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

**Orta** — Yutub Shorts için 30 dakikalık günlük bütçe. Zamanlayıcı, bir Shorts URL'si görünürken `pageHeartbeatEvent`'larda otomatik olarak çalışır; zamanlayıcı sıfıra ulaştığında ayrı bir işleyici bloğu uygular.

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts",
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("Budget hit zero.");
  });
}
```

**Daha zor** — Yazar adı çok uzun olan tek tek Yutub Kısa Videolarını gizleyin ve "bu Kısa Video gizlidir" CSS'sini ekleyin:

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
  event.registerWebChangedEvent("hide-long-shorts", configure);
}
```

**En zor** — özel bir etkinliği bir işleyiciden diğerlerine yayınlayın:

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. Şablonlar

Her Özel grupta aranabilir bir ön ayarlı tarayıcı açan bir **Şablonlar** seçici bulunur. Kitaplık artık dokuz kategoriye ayrılmış **50'den fazla şablon** sunuyor; böylece kuralları sıfırdan yazmak yerine göz atabilirsiniz:

| Kategori | Örnekler |
|---|---|
| **Zamanlayıcılar** | Site süresi bütçesi (geri sayım + blok), site süresi izleyici (geri sayım), Yutub Shorts sınırı, kısa video ağı yayın sınırı, fotoğraf ağı Reels sınırı, Feysbuk Reels sınırı, Tiviç Clips sınırı, Evrensel dikkat dağıtma bütçesi, Günlük derin çalışma izleyicisi |
| **Program** | Hafta içi çalışma saatleri bloğu, yalnızca hafta sonu siteleri, yatmadan önce kapatma, yalnızca bir saate izin verilen, yalnızca öğle yemeğine ilişkin haberler, Pazartesi günü yeni başlangıç, her saatin ilk N dakikasına izin verilen, derin çalışma katı bloğu |
| **Yayın Akışı / Kısa Videolar** | Yutub Shorts URL'lerini engelleyin, Shorts kartlarını gizleyin, Shorts'ları anahtar kelimeye göre gizleyin, Yutub ana sayfa özet akışını / yorumları / trendleri gizleyin, kısa video ağı FYP'yi engelleyin, kısa video ağı kısa videolarını gizleyin, fotoğraf ağı Reels URL'lerini engelleyin, fotoğraf ağı Reels özet akışını gizleyin, Feysbuk özet akışını / Makaraları gizleyin, Redit / Tvitter / LinkedIn ana sayfasını gizleyin |
| **Yönlendir** | Dikkat dağıtıcı → odak sayfası, Kısalar → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, yeni sekme → görev listesi |
| **Odaklanma** | Yalnızca izin verilenler listesine odaklanan oturum, Pomodoro 25/5, toplantı sırasında bloke, bugün N ziyaretten sonra bloke, seri kaybının bloke edilmesi |
| **dürt** | Dikkat dağıtıcı her ziyareti kaydedin, her Shorts ziyaretinde uyarıda bulunun, bir siteye yapılan günlük ziyaretleri sayın |
| **İstikrar** | Aylık ziyaret sınırı, haftalık yasaklama geçişi, ziyaret edilen Diskord kanallarını takip etme |
| **DOM düzenlemeleri** | Yutub otomatik oynatma geçişini gizle, Tvitter / X'i gizle "Neler oluyor", genel "sitedeki seçicileri gizle" |
| **Hata ayıklama** | Demo geri sayımı (3 sn), her özel etkinliği günlüğe kaydedin |

Seçicinin üst kısmındaki filtre çipleri, listeyi kategoriye (`Timer`, `Schedule`, `Feed`, …) ve platforma (`Yutub`, `kısa video ağı`, `fotoğraf ağı`, …) göre daraltır. Bir şablon seçme:

1. Parametre girişlerini (URL, dakika, saat aralıkları vb.) küçük bir forma yükler.
2. **Ön ayarı uygula**, oluşturulan kaynağın önizlemesini görüntüler.
3. **Geçerli özel kural bu ön ayarla değiştirilsin mi?** seçeneğini onayladıktan sonra kaynak düzenleyiciye yazılır.
4. Daha sonra kural işleyicilerini ekran dışındaki sanal alana kaydetmek için **Çalıştır**'ı tıklayın.

Şablonlar `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`, …) altında tanımlanmıştır. Her dosya yükleme sırasında `CB_REGISTER_TEMPLATES([...])`'yu çağırır ve açılır pencere birleştirilmiş listeyi tüketir. Yeni bir şablon eklemek, uygun dosyaya bir giriş yazmak anlamına gelir; başka bir tesisata gerek yoktur.

---

## 13. Çok sayfalı davranış- Aynı gruptaki tüm açık sekmeler aynı zamanlayıcıyı paylaşır.
- Aynı gruptaki bir sekmeye geçtiğinizde, o sekmenin katmanı, mevcut paylaşılan zamanı gösterecek şekilde hemen yenilenir.
- Özel kural zamanlayıcıları yalnızca `pageHeartbeatEvent` tarafından yönlendirilen **aktif görünür** sekmesinde işaretlenir. Arka plan sekmeleri ve simge durumuna küçültülmüş pencereler bunları ilerletmez. Bu, varsayılan blok grubu geri sayımıyla eşleşir.
- Yeni bir kural eklendiğinde, açılan her sayfa saniyeden çok daha kısa bir sürede değişikliği algılayıp yeniden değerlendirir; **ancak** yeni kayıtlı işleyiciler zaten açık olan sekmeleri geriye dönük olarak "açmaz". Açılır pencerede bu nedenle her Çalıştırmadan sonra bir yeniden yükleme hatırlatıcısı görüntülenir.
- Bir kuralın süresi dolduğunda, bir sonraki yenilemede gizli yayın kartları ve gezinme düğmeleri geri yüklenir.

---

## 14. Ayarlar

Üst çubuktaki dişli simgesini kullanarak **Ayarlar** iletişim kutusunu açın.

- **Kalp atışı aralığı** — içerik komut dosyasının sekme süresini ne sıklıkta rapor ettiği ve `pageHeartbeatEvent`'yu yönlendirdiği. Varsayılan 250 ms. Daha düşük değerler daha duyarlıdır ancak daha fazla CPU kullanır.
- **İşaret aralığı** — küresel `tickEvent`'nun ne sıklıkta tetiklendiği. Varsayılan 1000 ms.
- **Hata ayıklama modu** — varsayılan olarak *kapalı*. *Açık* olduğunda motor, Günlük paneline (`[trace] dispatchEvent`, `[trace] N handler(s)`) ve `[CustomBlocker:trace]` satırlarına izleme düzeyi girişlerini tarayıcı konsoluna gönderir. Günlük kullanımda bırakın; Yanlış davranış kuralını teşhis ederken bunu açın. `pageHeartbeatEvent`, hata ayıklama modu açıkken bile izleme günlüğünün dışında bırakılır çünkü saniyede dört kez tetiklenir ve geri kalanını bastırır.

---

## 15. Uluslararasılaşma

Kullanıcı arayüzünün tamamı çevrilmiştir. Sağ üstteki **Dil** seçiciyi kullanın.

Desteklenen diller arasında İngilizce, Çince (Basitleştirilmiş), İspanyolca, Japonca, Korece ve ayrıca Hintçe, Arapça, Bengalce, Portekizce, Rusça, Pencapça, Almanca, Fransızca, Türkçe, Vietnamca, İtalyanca, Tayca, Felemenkçe, Lehçe, Endonezce, Urduca ve Farsça için kısmi kapsam bulunmaktadır. Kısmi kapsama sahip diller, eksik dizeler nedeniyle İngilizce'ye geri döner.

Kullanım kılavuzunun kendisi, seçtiğiniz dille eşleşen işaretleme dosyasını, yedek olarak İngilizce ile birlikte yükler.

---

## 16. Durum mesajları

Durum mesajları, yaklaşık iki saniye sonra kaybolan, ortalanmış bir tost olarak görünür:

- "Değişiklikler kaydedildi."
- "\"Grup adı\" oluşturuldu."
- "Özel kural yüklendi — N işleyici etkin. Bu kuralı önceden açtığınız sekmelere uygulamak için onları yeniden yükleyin."
- "İzin verilen dakikalar 0'dan büyük bir sayı olmalıdır" gibi doğrulama hataları.
- "Erteleme dakikaları 0'dan büyük bir sayı olmalıdır."
- "Dondurulmuş gruplar değiştirilemez."

Format gereksinimleri olan giriş alanları için mesaj, ilgili düğmenin yanında da görüntülenir (erteleme için).

---

## 17. Gizlilik ve depolama

- Her şey yerel olarak `chrome.storage.local`'da depolanır. Hiçbir yere veri gönderilmez.
- Saklanan öğeler şunları içerir: gruplarınız, kullanım zamanlayıcılarınız, son sıfırlama süreleri, erteleme kayıtları, özel zamanlayıcılar ve özel kalıcı değerler.
- Uzantı, sayfa türünü (yol / ana bilgisayar adı / video siteleri için bilinen DOM işaretçileri) algılamak ve kullanıcı tarafından yazılan yüklemleri değerlendirmek için gerekenin ötesinde sayfa içeriğini okumaz. Mesajlarınızı, yayınlarınızı, yorumlarınızı veya özel içeriğinizi okumaz.

---

## 18. İzinler

- `storage` — yukarıdaki veriler için.
- `declarativeNetRequest` — `Default` gruplarının yerel olarak engellenmesi için.
- `alarms` — kural geçişlerini verimli bir şekilde planlamak için.
- `tabs`, `webNavigation` — olayların gönderilebilmesi için sekme oluşturmayı, URL değişikliklerini ve sayfa kalp atışlarını algılamak için.
- `offscreen` — uzun ömürlü özel kurallı sanal alanı barındırmak için.
- `host_permissions: <all_urls>` — böylece içerik komut dosyası herhangi bir sayfada zamanlayıcı katmanını gösterebilir ve platform içeriğini algılayabilir.

---

## 19. Sorun Giderme- **Eklediğim bir grup hiçbir şey yapmıyor.** Grubun etkinleştirildiğinden, programın artık buna izin verdiğinden, herhangi bir ertelemenin etkin olmadığından ve (platform grupları için) sayfanın seçilen içerik türü ve yazar filtresiyle gerçekten eşleştiğinden emin olun.
- **Zamanlayıcı bir sekmede takılı kalmış veya yanlış.** Geçiş yapın ve geri dönün veya sekmeye odaklanın; bu, paylaşılan zamanlayıcının zorunlu olarak yenilenmesini tetikler.
- **Yayın kartları, gizlenmeleri gerektiğini düşündüğümde yeniden görünüyor.** Özet akışı gizleme yalnızca kural aktif olarak engelleme yaptığında çalışır. Bir `after-minutes` kuralınız varsa, süreniz sıfıra ulaştığında feed gizleme devreye girer.
- **Gizlenmesini beklediğim bir Yutub gezinme düğmesi hâlâ orada.** Gezinmeyi gizlemek için kuralın "yazara göre filtreleme" olarak ayarlanması ve içerik türünün Kısa Videolar veya Yutub gönderileri olması gerekir. Yazar filtrelerinde gizleme yalnızca kart başına yapılır.
- **Özel kural hiçbir şey yapmadı veya sessizce atıldı.** Ayarlar'ı açın → **Hata ayıklama modunu** etkinleştirin, ardından tekrar **Çalıştır**'ı tıklayın ve Günlük panelini izleyin. `[trace]` ön ekine sahip satırlar her gönderimi ve işleyiciyi gösterir. Kendi izleme noktalarınızı eklemek için `helpers.getLogHelper().log(...)` kullanın. Yanlış çalışan bir kural sürekli olarak otomatik karantinaya alınıyorsa kaynağı düzeltin ve Çalıştır'a tıklayın; Çalıştır, iptal nedenini temizler.
- **Yeni Özel kuralım zaten açık olan sekmeleri etkilemiyor.** Bunları yeniden yükleyin. *Gelecekteki* sayfa etkinliklerine özel kurallar eklenir; açılır pencerede her Çalıştırmadan sonra yeniden yükleme yapılması için bir hatırlatıcı gösterilir.
- **Geri sayım zamanlayıcım ilerlemiyor.** Özel kural zamanlayıcıları yalnızca `pageHeartbeatEvent` aracılığıyla **aktif görünür** sekmesini işaretler. Arka plan sekmeleri, simge durumuna küçültülmüş pencereler ve kilitli ekranlar, bunları tasarım gereği duraklatır; varsayılan blok grubu geri sayımıyla aynı davranış.
- **Bir grubu silemiyorum.** Muhtemelen donmuştur. Tamamen dondurulmuş gruplar, kilitlerinin süresi dolana kadar hiçbir şekilde silinemez; katı olmayan dondurulmuş gruplar, dondurmayı çözme ritüeli yoluyla silinebilir.
- **Açılır pencerede sürekli olarak "Çalışıyor..." ifadesi görünüyor.** Özel bir kural muhtemelen sıkı bir döngüye girmiştir. Motor, zor bir zaman aşımından sonra onu öldürür ve kuralı karantinaya alır. İptal nedeni için Günlük panelini açın; kuralı düzeltin ve Çalıştır'a tıklayın.

---

## 20. Sözlük

- **Blok grubu** — kendi türü, davranışı, programı ve dondurma/erteleme özelliği olan tek bir kural kümesi.
- **Anında engelleme** — Kural, etkin olduğu anda hemen engeller.
- **Dakika sonrası engelleme** — Kural, yalnızca dönemin zaman bütçesi tükendikten sonra engellemeye başlar.
- **Sıfırlama aralığı** — dakika sonrası bütçenin ne sıklıkta sıfırlandığı.
- **Zamanlama** — bir grubun etkin olduğu günler + zaman pencereleri.
- **Dondur / Kesin dondur** — kurcalamaya karşı koruma durumları.
- **Erteleme** — yapılandırılabilir bir onaylama ritüeli ile geçici olarak devre dışı bırakma.
- **Yazar filtresi** — platform grupları için kuralı belirli içerik oluşturucularla sınırlandırır.
- **İçerik türü** — Platform grupları için kuralı belirli içerik biçimleriyle (kısa, uzun, gönderi) sınırlandırır.
- **Yardımcılar** — özel bir kuralın işleyicisine aktarılan yardımcı programlar.
- **Platform** — `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`'dan biri. Her birinin kendi grup türü ve feed gizleme mantığı vardır.
- **Kalp atışı** — etkin görünür sekmeden gönderilen ~250 ms `pageHeartbeatEvent`.
- **İşaretleyin** — küresel olarak paylaşılan `tickEvent` (görünürlükten bağımsız).
- **Hata ayıklama modu** — Günlük panelinde ve tarayıcı konsolunda dahili izleme günlüğünü ortaya çıkaran bir ayar.
- **Karantina** — çalışma zamanı güvenlik sınırını aşan özel bir kuralın otomatik olarak devre dışı bırakılması (son tarih, günlük spam'i,...). Bir sonraki Çalıştırmada temizlendi.

---

## 21. Sınırlamalar- Feed'in gizlenmesi her platformun mevcut DOM'sine bağlıdır. Platformun düzeni değişirse gizleme seçicilerinin güncellenmesi gerekebilir.
- Yutub dışı siteler için platform bağlamı tespiti çoğunlukla URL tabanlı olduğundan, en güvenilir olanı standart içerik URL'leridir.
- Özel kurallı zamanlayıcılar kalp atışı çözünürlüğünde (~250 ms) çalışır. Saniyeden kısa zamanlama için onlara güvenmeyin.
- `hideShorts` / `hideVideos` / `hidePosts`'ya iletilen tahminler, besleme kartı başına eşzamanlı olarak değerlendirilir. Bir yüklemdeki ağır mantık, feed kaydırmayı yavaşlatabilir; onları ucuz tut.
- Grup başına aynı zamanlayıcıyı düzenleyen iki sekme aynı anda "son yazma kazanır" stratejisini kullanır. Tipik kullanım için bu iyidir; Kesin hesaplamaya bağlıysanız, ara sıra küçük sapmalar bekleyin.
- Tarayıcı, boştayken arka plan hizmet çalışanını askıya alabilir. Uzantı, bir sayfa veya alarma ihtiyaç duyduğu anda onu devam ettirir; site/zamanlı kullanım bütçeleri kalp atışı tekrarı aracılığıyla sayılmaya devam eder.

## v1.2 notu

Özel kural düzenleyici artık betik dili sözdizimini renklendirir; şablon tarayıcısı kod önizlemelerinde aynı renkleri kullanır. Toplu grup eylemi **Temizle** olarak adlandırılır.

