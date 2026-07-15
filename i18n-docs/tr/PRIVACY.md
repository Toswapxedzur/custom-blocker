# Gizlilik Politikası — Özel Web Engelleyici

_Son güncelleme: 2026-07-13_

Bu sayfada **Özel Web Engelleyici** tarayıcısının tam olarak hangi verileri açıkladığı açıklanmaktadır
uzantı toplanıyor, nereye gidiyor ve her tarayıcı izninin neden
talep edildiğini açıklar. Kısaca: kurallarınızı veya kişisel gezinme verilerinizi
kaydetmeyiz. Etiket kuralları herkese açık YouTube kanal kimliklerini sorgulayabilir,
ancak bu sorgular saklanmaz veya sizinle ilişkilendirilmez.

## Özet

- **Yapılandırma tarayıcıda kalır.** Gruplar, programlar, kurallar, günlükler,
  sayaçlar ve tercihler yalnızca `chrome.storage.local` içinde tutulur.
- **Etiket sorgusu yalnızca herkese açık kanal kimliğini içerir.** URL, video
  başlığı, arama, zaman, hesap veya uzantı ayarı gönderilmez.
- **Sorgular kaydedilmez.** Uç nokta salt okunurdur, bilinmeyen kanalları eklemez
  ve isteği bir kişiyle ilişkilendirmez.
- **Analitik, telemetri, reklam veya çökme raporu yoktur.**
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
| `favicon` | Chromium'da kuralların yanında tarayıcının yerel önbelleğindeki site simgelerini gösterir. Tarama geçmişini göndermez ve hizmetimize istek yapmaz. |
| `nativeMessaging` | Yalnızca Safari'de özel kural sanal alanı isteklerini cihazdaki yerel uygulamaya iletir. Bulut aktarımı değildir. |
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

Bu bölüm **web sitesi ve içerik oluşturucu etiketi hizmeti** ile ilgilidir.
Uzantı herkese açık kanal kimliklerini salt okunur biçimde sorgulayabilir; bu
istekler kaydedilmez. **İstatistik** paneli yalnızca kişiyle bağlantısız sayımları tutar:

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
- **Elle katkı.** Oturum açmış kullanıcının bilinçli gönderiminde e-posta–kanal
  bağlantısı yalnızca 24 saatlik kota için tutulur ve saatlik temizlenir.
- **Herkese açık kuyruk.** Kanal kimliğini ve durumu gösterebilir; zamanı veya katkıda bulunanı göstermez.

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
