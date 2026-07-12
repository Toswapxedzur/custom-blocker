# Gizlilik Politikası — Özel Web Engelleyici

_Son güncelleme: 2026-06-30_

Bu sayfada **Özel Web Engelleyici** tarayıcısının tam olarak hangi verileri açıkladığı açıklanmaktadır
uzantı toplanıyor, nereye gidiyor ve her tarayıcı izninin neden
talep edildi. Kısa versiyonu: tarayıcınızdan hiçbir şey çıkmıyor.

## Özet

- **Hiçbir sunucuya veri gönderilmez.** Uzantı sıfır ağ oluşturur
  herhangi bir üçüncü tarafa (veya bize) yapılan talepler. Analitiği yok, hayır
  telemetri, kilitlenme raporlayıcısı yok, uzaktan yapılandırma yok, otomatik yok
  standart Chrome Web Mağazası mekanizmasının ötesinde güncellemeler.
- **Tüm veriler tarayıcınızda kalır** ve Chrome'un yerel özelliği aracılığıyla kalıcı olur
  uzatma depolama (`chrome.storage.local`). sürece asla senkronize edilmez.
  Chrome'un kendisi yerel profilinizi senkronize eder.
- **Kişisel olarak tanımlanabilir hiçbir bilgi toplanmaz**
  istediğiniz zaman uzatabilirsiniz.
- Kesinlikle gerekli olanın ötesinde tarama etkinliği **takip edilmez**
  Kendi yapılandırdığınız engelleme kurallarını uygulamak için.

## Yerel olarak depolananlar

Uzantı, tarayıcınızın yerel uzantısında aşağıdakileri saklar
oturumlar arasında işini yapabilmesi için depolama:

- Oluşturduğunuz blok grupları: adları, kural türleri, listeleri
  engellenen siteler, programlar, erteleme ayarları, dondurma durumu ve
  yazdığınız özel kurallı JavaScript.
- Sınırları uygulamak için gereken grup başına çalışma zamanı durumu (ör. kaç tane)
  Erteleme gerçekleştiğinde, bugün bir dakikalık gecikmeli ödenek bütçesi kalıyor
  tam dondurma dönemi sona erdiğinde sona erer).
- **Ayarlar**'da belirlenen kendi tercihleriniz (onay oranı, otomatik kaydetme)
  geri dönme, varsayılan erteleme süresi, varsayılan geri dönüş URL'si, hata ayıklama modu
  geçiş yapın, seçilen kullanıcı arayüzü dili).
- Uygulama içi **Günlük** panelinde gösterilen etkinlik günlüğü girişleri;
  kullanıcı arayüzünden temizleyin.

Bu veriler yalnızca uzantının kendi komut dosyaları tarafından okunur ve yazılır.
cihazınızda ve yalnızca kendi tarayıcı profilinizin içinde.

## Neler TOPLANMAZ veya İLETİLMEZ

- Tarama geçmişi kaydedilmez, özetlenmez veya iletilmez.
- Sayfa içeriği dışarı aktarılmaz, ekran görüntüsü alınmaz veya günlüğe kaydedilmez.
- Form girişleri, şifreler ve kişisel bilgiler kesinlikle okunmaz.
- Sizinle, cihazınızla veya kullanımınızla ilgili hiçbir bilgi
  Uzantı yazarı veya herhangi bir üçüncü taraf.

## Her izin neden isteniyor?

| İzin | Ne için kullanılır |
| --- | --- |
| `storage` | Blok gruplarınızı, ayarlarınızı ve çalışma zamanı durumunuzu yalnızca tarayıcınıza kaydedin ve yükleyin. |
| `declarativeNetRequest` | Chrome'a, yapılandırdığınız kurallara göre hangi URL'lerin yerel olarak engelleneceğini söyleyin. Tarayıcı engellemeyi yönetir; uzantı yalnızca kural listesini kaydeder ve günceller. |
| `alarms` | Bir erteleme, dondurma veya zamanlama penceresi sona erdiğinde zamana dayalı sınırları yenilemek ve kural durumunu güncellemek için arka plan hizmet çalışanını programa göre uyandırın. |
| `offscreen` | Korumalı alana alınmış özel kurallı JavaScript'i ekran dışı bir belgede çalıştırın, böylece uzantıdan kaçamaz veya sayfalarınıza doğrudan dokunamaz. |
| `tabs` | Araç çubuğu simgesini tıklattığınızda düzenleyiciyi tam sekme olarak açın, grup kurallarını değerlendirmek için etkin sekmenin URL'sine bakın ve düzenleyicide yaptığınız bir kural değişikliğinden sonra sekmeleri yeniden yükleyin. |
| `webNavigation` | SPA URL değişikliklerini (push-state navigasyonu) tespit ederek platform başına feed gizleyenlerin ve olay odaklı kuralların yalnızca tam sayfa yüklemelerine değil, sayfa içi navigasyona da tepki vermesini sağlayın. |
| `<all_urls>` ana bilgisayar erişimi | Engelleme kurallarınızı ve platform başına yayın gizleyicilerinizi, engellemeyi seçtiğiniz sitelere uygulayın. Uzantı, yalnızca aktif olarak kural yapılandırdığınız URL'lerdeki sayfaları okur/değiştirir ve yalnızca bu kuralı uygulamak için kullanılır. |

## Özel kurallar

Özel JavaScript kuralları yazarsanız bu kod:

- Korumalı alana alınmış ekran dışı bir belgede çalışır; doğrudan ulaşamıyor
  ağınız, sayfalarınız veya diğer uzantılarınız.
- İçerik komut dosyalarıyla yalnızca sabit bir mesaj köprüsü aracılığıyla iletişim kurar
  Uzantının yardımcı API'si tarafından tanımlanır.
- Otomatik olarak karantinaya alınır (bir günlük girişi ile devre dışı bırakılır),
  yerleşik CPU, günlük, mesaj sonrası veya DOM mutasyon sınırlarını aşıyor.

Özel kurallarınız, diğer ayarlarınızla birlikte yerel olarak depolanır
ve asla cihazdan aktarılmaz.

## Web sitesi ve içerik oluşturucu etiketi hizmet istatistikleri

Bu bölüm **web sitesi ve isteğe bağlı yaratıcı etiketi hizmeti** ile ilgilidir.
bunlar uzantının kendisinden ayrıdır. Uzantı hala gönderiyor
yukarıda açıklandığı gibi hiçbir şey. Web sitesi küçük bir **İstatistik** yayınlıyor
Paneli doldurmak için sunucu birkaç toplu sayım tutar:

- **İndirme sayısı** — her bir ürünün indirme düğmesine kaç kez basıldığı
  tıklandı (macOS, Windows, tarayıcı uzantısı, Safari).
- **İçerik oluşturucular sınıflandırıldı** — kaç YouTube içerik oluşturucusunun etiketlendiği.
- **Hesaplar** — kaç tane hesabın mevcut olduğu.
- **Soru-Cevap etkinliği** — forum gönderilerinin ve yorumlarının toplam sayısı.

Saatte bir sunucu bu sayımların her birinin geçerli değerini kaydeder ve
başka bir şey değil. Etkinlik başına kayıt yok, tıklama akışı yok ve oturum yok
tarih.

- **Tamamen anonim / kimliği gizlenmiş.** Bunlar açık toplamlardır. onlar
  adınıza, hesabınıza, e-postanıza, IP adresinize, cihazınıza veya herhangi bir şeye **bağlı değildir**
  diğer tanımlayıcı - bir kişiye geri sayım atfetmenin bir yolu yoktur.
- **Asla ticari değildir.** Bu veriler yalnızca genel istatistikleri göstermek için mevcuttur.
  paneli. **Asla satılmaz, üçüncü şahıslarla paylaşılmaz, reklam amacıyla kullanılmaz,
  veya başka herhangi bir ticari amaç için kullanılır.**
- **İsteğe bağlı kanal kimliği katkıları.** Yalnızca ve yalnızca katılmayı tercih ederseniz,
  uzantı/web sitesi YouTube **kanal kimliklerini** paylaşabilir (asla video başlıklarını,
  yaratıcıları herkes için sınıflandırmaya yardımcı olmak için geçmişi veya kişisel herhangi bir şeyi izleyin.

## Çocuklar

Uzantı genel amaçlı bir üretkenlik aracıdır. öyle değil
çocuklara yöneliktir, bilerek kimseden veri toplamaz ve
hiçbir reklam göstermez.

## Bu politikada yapılan değişiklikler

Gelecekteki bir sürümde veri uygulamaları değişirse bu dosya
güncellenecek ve değişiklik sürüm notlarında özetlenecektir.
bu sürüm.

## İletişim

Sorular, endişeler veya hata raporları: lütfen şu adreste bir sorun açın:
uzantının kaynak deposunu kullanın veya listelenen destek e-postasını kullanın.
Chrome Web Mağazası girişi.
