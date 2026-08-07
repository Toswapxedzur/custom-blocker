# Gizlilik Politikası — Özel Web Engelleyici

_Son güncelleme: 2026-08-04_

Bu sayfa, **Özel Web Engelleyici** tarayıcı uzantısının tam olarak hangi verileri topladığını, bunların nereye gittiğini ve her tarayıcı izninin neden istendiğini açıklar. Kısacası: kurallarınızı ve kişisel gezinme verilerinizi saklamıyoruz. İsteğe bağlı Vault Classifier toplama ve sınıflandırması sizin denetiminizde kalır ve kimliği doğrulanmış yerel köprüyü kullanır. Ayrı ve isteğe bağlı bir yerel yapay zekâ (MCP) entegrasyonu da varsayılan olarak kapalıdır ve verileri yalnızca sizin bizzat bağlayıp onayladığınız bir asistana açar.

## Özet

- **Yapılandırmanız tarayıcınızda kalır.** Engelleme grupları, zamanlamalar, özel kurallar, günlükler, sayaçlar ve tercihler yalnızca Chrome'un yerel uzantı depolamasında (`chrome.storage.local`) tutulur.
- **Vault Classifier yalnızca yereldir.** İsteğe bağlı Vault Classifier entegrasyonunu açıkça etkinleştirirseniz, YouTube kart/sayfa üzerindeki görünür kanıtlar (başlık, görünür açıklama, gösterilen etiketler ve herkese açık oluşturucu/video kimlikleri gibi) yalnızca kimliği doğrulanmış yerel Vault köprüsü aracılığıyla Mac'inizdeki Vault Classifier'a yönlendirilir. Bunlar web sitemize, bir model sağlayıcısına, YouTube Data API'sine veya başka herhangi bir sunucuya gönderilmez.
- **Toplama ayrı bir tercihtir (opt-in).** Vault Classifier, uzantıdan işlenmiş ve reklamsız YouTube meta verilerini yalnızca siz onun Sınıflandırma verileri çalışma alanında YouTube toplamayı açtıktan sonra ister. Kapalıyken uzantı, toplama için hiçbir başlık veya oluşturucu meta verisi göndermez. Açıkken saklanan yerel alanlar; görünür bir başlığı, oluşturucu adını/tanımlayıcısını, video türünü, süreyi, görünür abone/görüntülenme/yayınlanma metnini ve kanonik URL'yi içerebilir.
- **İsteğe bağlı yerel yapay zekâ (MCP) entegrasyonu.** Bunu açıp kendi yapay zekâ asistanınızı bağlarsanız, bu asistan — sizin açık talimatınızla — cihazınızdaki yerel bir Vault sunucusu aracılığıyla seçili verileri (yapılandırmanız, etkinliğiniz, kullanım süreniz, etkin/açık sekmelerin URL'leri, yapılandırdığınız sitelerdeki görünür sayfa içeriği ve her türlü Classifier kanıtı) okuyabilir. Varsayılan olarak kapalıdır, her bağlantı sizin tarafınızdan onaylanır ve parolalar ile API anahtarları bunun aracılığıyla asla okunamaz. Aşağıdaki "İsteğe bağlı yerel yapay zekâ (MCP) entegrasyonu" bölümüne bakın.
- **Analiz, reklam profili, telemetri veya çökme raporlaması yoktur.**
- Kendi yapılandırdığınız engelleme kurallarını uygulamak için kesinlikle gerekli olanın ötesinde gezinme etkinliğinizin **hiçbir izlemesi yapılmaz.**

## Yerelde neler saklanır

Uzantı, oturumlar arasında işini yapabilmek için aşağıdakileri tarayıcınızın yerel uzantı depolamasında saklar:

- Oluşturduğunuz engelleme grupları: adları, kural türleri, engellenen site listeleri, zamanlamalar, erteleme (snooze) ayarları, dondurma durumu ve yazdığınız her türlü özel kural JavaScript'i.
- Sınırları uygulamak için gereken grup başına çalışma zamanı durumu (ör. ertelenmiş bir ödenek bütçesinden bugün kaç dakika kaldığı, bir ertelemenin ne zaman biteceği, katı bir dondurma döneminin ne zaman sona ereceği).
- **Ayarlar**'da belirlediğiniz kendi tercihleriniz (tık hızı, otomatik kaydetme gecikmesi, varsayılan erteleme süresi, varsayılan yedek URL, hata ayıklama modu düğmesi, seçili arayüz dili).
- Uygulama içi **Günlük** panelinde gösterilen ve arayüzden temizleyebileceğiniz etkinlik günlüğü kayıtları.
- Vault Classifier'ı açıkça etkinleştirdiğinizde, yerel uygulaması; girdileri sınıflandırmak ve açıklamak için gereken görünür kanıtların, yerel puanların, kararların ve düzeltmelerin kullanıcı tarafından sınırlandırılmış bir yerel önbelleğini tutar. Bu önbellek Mac'inizde kalır ve uzantı ile sunucu arasındaki normal trafiğin parçası değildir.

Yapılandırmanız, çalışma zamanı durumu ve etkinlik günlüğü cihazınızda kalır ve hizmetimiz tarafından kaydedilmez. Tarayıcı sürümüne ve etkinleştirdiğiniz özelliklere bağlı olarak bunlar; uzantı, onun cihaz yerelindeki Safari eşlik uygulaması ya da açıkça bağlanmış bir yerel Vault köprüsü tarafından işlenebilir.

## Neler toplanmaz veya iletilmez

Aşağıdakiler uzantının kendi başına nasıl davrandığını anlatır. Tek istisna, kendiniz etkinleştirip bağlayabileceğiniz ve bir sonraki bölümde açıklanan isteğe bağlı yerel yapay zekâ (MCP) entegrasyonudur.

- Gezinme geçmişi uzantının kendisi tarafından kaydedilmez, özetlenmez veya iletilmez; yalnızca yapılandırdığınız kuralları uygulamak için kullanılır.
- Sayfa içeriği uzantının kendisi tarafından sızdırılmaz, ekran görüntüsü alınmaz veya günlüğe kaydedilmez.
- Vault Classifier kanıtları uzantı tarafından cihaz dışına iletilmez. Bunlar yalnızca bu entegrasyonu açıkça etkinleştirdiğinizde eşleştirilmiş yerel köprü ve uygulama tarafından işlenir.
- Form girişleri ve parolalar uzantı tarafından asla okunmaz; parolalar ve API anahtarları yerel yapay zekâ (MCP) entegrasyonu aracılığıyla da okunamaz.
- Normal kural uygulaması için hiçbir uzantı tanımlayıcısı, hesap tanımlayıcısı, cihaz tanımlayıcısı veya kural yapılandırmanız iletilmez.

## İsteğe bağlı yerel yapay zekâ (MCP) entegrasyonu

Uzantı, isteğe bağlı olarak, kendi cihazınızdaki Vault masaüstü uygulamalarının içinde çalışan yerel bir **Vault MCP sunucusundan** gelen istekleri yanıtlayabilir; böylece kendi yapay zekâ asistanınızı (bir "MCP istemcisi") bağlayıp Vault kurulumunuzu sizin adınıza okumasını veya üzerinde işlem yapmasını sağlayabilirsiniz. Bu entegrasyon **varsayılan olarak kapalıdır** ve siz bilerek açmadıkça hiçbir şeyi değiştirmez.

- **Onu siz başlatırsınız.** Entegrasyonu etkinleştirip bir MCP istemcisi bağlayana kadar hiçbir şey açığa çıkmaz ve her istemci bağlantısı sizin tarafınızdan onaylanır. Kapatmak erişimi anında iptal eder.
- **Sunucu yereldir.** Uzantının sağladığı veriler, aynı kimliği doğrulanmış cihaz içi köprü aracılığıyla Mac'inizdeki bir Vault MCP sunucusuna teslim edilir — web sitemize veya herhangi bir Vault sunucusuna değil. Uzantının kendisi verilerinizi üçüncü bir tarafa göndermez.
- **Sonrasında asistanınız karar verir.** Bağlı bir MCP istemcisi sizin isteğinizle veriyi aldıktan sonra, ona ne olacağı **o istemciye** ve onun kendi gizlilik koşullarına tabidir. Seçtiğiniz asistan uzaktaki bir hizmete dayanıyorsa, o asistan verilerinizi sizin talimatınızla iletebilir — herhangi bir yapay zekâ aracına bilgi yapıştırmanızla aynı şekilde. Güvendiğiniz bir istemci seçin.
- **Neler açığa çıkabilir.** Talimatınızla, bağlı bir asistan; engelleme gruplarınızı, zamanlamalarınızı, özel kurallarınızı, etkinlik günlüğünü, kullanım süresi sayaçlarını, etkin sekmenin veya açık sekmelerin URL'sini, yapılandırdığınız sitelerdeki görünür sayfa içeriğini ve her türlü Vault Classifier kanıtını ve kararını okuyabilir. Durumu değiştiren eylemler (grupları düzenlemek, bir erteleme başlatmak, kaydedilmiş bir kuralı çalıştırmak, bir sınıflandırmayı tetiklemek) tek tek onaylanır.
- **Sırlar sır olarak kalır.** Parolalar (ebeveyn denetimi parolası gibi) ve sağlayıcı API anahtarları bu entegrasyon aracılığıyla **yalnızca yazılabilir**: ayarlanabilirler ama hiçbir asistan tarafından geri okunamazlar.
- **Yalnızca Chromium.** Classifier köprüsü gibi bu entegrasyon da yalnızca cihaz yerelindeki ana bilgisayara sahip Chromium tarayıcılarında bulunur; Firefox ve Safari onu sunmaz.

## Her izin neden isteniyor

| İzin | Ne için kullanılır |
| --- | --- |
| `storage` | Engelleme gruplarınızı, ayarlarınızı ve çalışma zamanı durumunu yalnızca tarayıcınızda kaydetmek ve yüklemek. |
| `favicon` | Chromium'da kuralların yanında tarayıcının önbelleğe aldığı site simgelerini göstermek. Bu, gezinme geçmişini göndermez ve hizmetimize istek yapmaz. |
| `nativeMessaging` | Chromium'da, kimliği doğrulanmış Vault Classifier köprüsü için cihazdan yerel bir Native Messaging kanıtı istemek; Safari'de, özel kural sanal alanı isteklerini cihaz yerelindeki kapsayıcı uygulamaya iletmek. Bu bir bulut aktarımı değildir. |
| `alarms` | Bir erteleme, dondurma veya zamanlama penceresi sona erdiğinde zamana dayalı sınırları ve kural durumunu yenilemek için arka plandaki service worker'ı zamanlamaya göre uyandırmak. |
| `offscreen` | Özel kural JavaScript'ini ekran dışı bir belgede sanal alanda çalıştırmak; böylece uzantıdan kaçamaz veya sayfalarınıza doğrudan dokunamaz. |
| `tabs` | Araç çubuğu simgesine tıkladığınızda düzenleyiciyi tam bir sekme olarak açmak, grup kurallarını değerlendirmek için etkin sekmenin URL'sine bakmak ve düzenleyicide yaptığınız bir kural değişikliğinden sonra sekmeleri yeniden yüklemek. |
| `webNavigation` | SPA URL değişikliklerini (push-state gezinme) algılamak; böylece platforma özgü akış gizleyiciler ve olay güdümlü kurallar yalnızca tam sayfa yüklemelerine değil, sayfa içi gezinmeye de tepki verebilir. |
| `<all_urls>` ana bilgisayar erişimi | Engellemeyi seçtiğiniz sitelerde engelleme kurallarınızı ve platforma özgü akış gizleyicileri uygulamak. Uzantı, sayfaları yalnızca etkin olarak bir kural yapılandırdığınız URL'lerde ve yalnızca o kuralı uygulamak için okur/değiştirir; isteğe bağlı Vault Classifier bağdaştırıcısı YouTube ile sınırlıdır. |

## Özel kurallar

Özel JavaScript kuralları yazarsanız, bu kod:

- Ekran dışı bir belgede sanal alanda çalışır; ağa, sayfalarınıza veya diğer uzantılara doğrudan erişemez.
- İçerik betikleriyle yalnızca uzantının yardımcı API'si tarafından tanımlanan sabit bir mesaj köprüsü aracılığıyla iletişim kurar.
- Yerleşik CPU, günlük, post-message veya DOM değişikliği sınırlarını aşarsa otomatik olarak karantinaya alınır (bir günlük kaydıyla devre dışı bırakılır).

Özel kurallarınız ayarlarınızın geri kalanıyla birlikte yerelde saklanır ve asla cihaz dışına iletilmez.

## Web sitesi istatistikleri

Bu bölüm **web sitesiyle** ilgilidir. Web sitesi küçük bir **İstatistikler** paneli yayımlar ve bunu doldurmak için sunucu birkaç toplu sayım tutar:

- **İndirme sayıları** — her ürünün indirme düğmesine kaç kez tıklandığı (macOS, Windows, tarayıcı uzantısı, Safari).
- **Hesaplar** — kaç hesabın var olduğu.
- **Soru-cevap etkinliği** — forum gönderileri ve yorumlarının toplam sayısı.

Sunucu saatte bir kez her toplu sayımın güncel değerini kaydeder. Bu anlık görüntüler ziyaretçi başına olay, tıklama akışı veya oturum geçmişi içermez.

- **Tamamen anonim / kimliksizleştirilmiş.** Bunlar basit çalışan toplamlardır. Adınıza, hesabınıza, e-postanıza, IP adresinize, cihazınıza veya başka herhangi bir tanımlayıcıya **bağlı değildir** — bir sayımı bir kişiye atfetmenin bir yolu yoktur.
- **Asla ticari değil.** Bu veriler yalnızca herkese açık İstatistikler panelini göstermek için vardır. **Asla satılmaz, üçüncü taraflarla paylaşılmaz, reklam için veya başka herhangi bir ticari amaçla kullanılmaz.**

## Çocuklar

Uzantı, genel amaçlı bir üretkenlik aracıdır. Çocuklara yönelik değildir, hiç kimseden bilerek veri toplamaz ve reklam göstermez.

## Bu politikadaki değişiklikler

Gelecekteki bir sürümde veri uygulamaları değişirse, bu dosya güncellenir ve değişiklik o sürümün sürüm notlarında özetlenir.

## İletişim

Sorular, endişeler veya hata raporları: lütfen uzantının kaynak deposunda bir issue açın ya da Chrome Web Store sayfasında listelenen destek e-posta adresini kullanın.
