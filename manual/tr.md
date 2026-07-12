# Vault uzantısı işlevsel referansı

## Amaç ve durum

Bu, Vault tarayıcı uzantısının yetkili işlevsel özelliğidir. Ürün sözleşmesini belgeler: bir kullanıcının yapılandırabileceği veriler, yapılandırmanın ürettiği tam davranışlar, genel Özel kural dili ve buna uygulanan sınırlar.

Bu kasıtlı olarak bir hızlı başlangıç kılavuzu değildir. Web sitesi eğitimi öğrenme yoludur. Bu belge, Vault'un kullanıcıların görebileceği davranışını yapılandırması, test etmesi, bakımını yapması, denetlemesi veya yeniden üretmesi gereken kişiler içindir.

Bu belge ve ürün aynı fikirde olmadığında kod kanonik gerçektir. Bu belgedeki adlar, mümkün olduğu ölçüde ürünün kayıtlı/genel sözlüğünü kullanır. "Döndürür" gibi bir kelime, Özel bir kurala sunulan dönüş değeri anlamına gelir; tarayıcının veya sayfanın istenen eylemi reddetmesi durumunda tarayıcı düzeyinde bir sonuç vaat etmez.

## 1. Ürün sınırı

Vault, odak kontrolü sağlayan bir WebExtension'dır. Yapılandırma birimi bir **blok grubudur**. Bir grup şunları yapabilir:

- üst düzey bir web sitesinin, platform sayfasının, yaratıcının, topluluğun, sunucunun, kanalın veya hesabın engellenmesi gerektiğine karar vermek;
- yapılandırılmış platform yüzeylerini veya eşleşen besleme kartlarını gizleyin;
- eşleşen bir kapsamda harcanan süreyi ölçün;
- söz konusu grup türünün desteklediği durumlarda bir program, donma koruması veya geçici erteleme uygulayın;
- bir etkinlik API'si ile bir Özel JavaScript kuralı çalıştırın;
- sayfa içi zamanlayıcıyı, paneli, mesajı veya sayfa günlüğünü gösterin;
- bir tarayıcı sekmesini yeniden yönlendirmek, gezinmek, kapatmak veya yalnızca oturum kuralıyla oluşturulan site engelleme listesini sürdürmek;
- isteğe bağlı olarak yerel olarak bağlı bir Vault köprü kümesine katılın.

Vault yalnızca yüklü olduğu tarayıcı profilinin içinde ve yalnızca tarayıcının içerik komut dosyasının çalıştırılmasına izin verdiği yerde hareket eder. Şunları yapmaz:

- yerel bir uygulama veya tarayıcı uzantısı yükleyin;
- işletim sistemi uygulamalarını engelleyin;
- tarayıcı izin istemlerini, özel tarama kısıtlamalarını veya bir web sitesinin kendi güvenlik modelini atlayın;
- üçüncü taraf bir platform DOM'unu değiştirdiğinde seçici tabanlı gizlemeyi garanti eder;
- Kullanıcı ayrı olarak dışa aktarmadığı/yapılandırmadığı sürece Özel kural durumunu profiller arasında taşınabilir hale getirin;
- bir ağ güvenlik duvarı, proxy, hesap kontrolü veya ebeveyn izleme hizmeti sağlayın.

Aşağıdaki terminoloji baştan sona kullanılmaktadır:

| Dönem | Anlamı |
| --- | --- |
| Grup | Bağımsız olarak adlandırılmış bir yapılandırma nesnesi. Adlar, büyük/küçük harf göz ardı edilerek uzantı içinde benzersiz olmalıdır. |
| Site grubu | Ana eşleşme koşulu alan listesi olan normal bir grup. |
| Platform grubu | YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord veya Twitter/X için uzmanlaşmış normal bir grup. |
| Özel grup | Bir JavaScript kuralına ve bu kuralın etkinlik kayıtlarına sahip olan bir grup. Kuralı davranışına karar verir. |
| Maç | Sayfa, yayın öğesi veya platform yüzeyi bir grubun yapılandırılmış koşullarını karşılıyor. |
| Aktif | Grup etkin, kendi programına uygun ve şu anda ertelenmiş durumda değil. Özel gruplar normal zamanlama kullanıcı arayüzüne göre yönetilmez. |
| Blok | Normalde geri dönüş hedefine yeniden yönlendirme yaparak mevcut üst düzey sayfanın kullanılabilir kalmasını önleyin. |
| Gizle | Şu anda oluşturulan sayfadaki bir öğeyi/kartı kaldırın veya gizleyin. Gizlenmek bir ağ bloğu değildir. |
| Geri dönüş URL'si | Gruba özgü bir yönlendirme hedefi. Boşsa genel geri dönüş kullanılır. |
| İzin verme/istisna etkisi | Eşleşen içeriği düşük öncelikli gizleme kurallarından kurtaran bir platform kartı kararı. Bu, genel bir web sitesi izin verilenler listesi değildir. |

## 2. Grup modeli ve ortak yaşam döngüsü

Her saklanan grubun sabit bir kimliği, adı, türü, etkin bayrağı ve ortak politika alanları vardır. Yeni bir normal grup varsayılan olarak etkindir. Bir grup seçilebilir, editörün otomatik kaydetme davranışıyla kaydedilebilir, yeniden sıralanabilir, dışa aktarılabilir, içe aktarılabilir, dondurulabilir, dondurulabilir, ertelenebilir, devre dışı bırakılabilir veya silinebilir.

### 2.1 Sıralama ve örtüşme

Birden fazla grup aynı sayfada eşleşebilir. Apps Kasası, saklanan grupları görüntülenen listenin sonundan başına doğru değerlendirir. Çakışan kurallar tasarlarken listedeki daha düşük öğeleri daha sonraki/yüksek öncelikli eşleşmeler olarak değerlendirin.

Sıradan üst düzey site engellemesi için, geçerli herhangi bir engelleme grubu sayfayı kullanılamaz hale getirebilir. Besleme kartı filtrelemesi için platform kademesi, eşleşen her grubun sırasını ve etkisini kullanır: daha sonra eşleşen bir izin/istisna, bir öğeyi düşük öncelikli engelleme yüklemlerinden kurtarabilir. Bu özel durum davranışı, platform kartı filtreleme yüzeyiyle sınırlıdır; normal bir tam sayfa site engellemesini geri almaz.

### 2.2 Etkin durumu

Engelli gruplar tutulur ancak normal eşleştirmeye, zamanlayıcılara, programlara veya sıradan erteleme işlemlerine katılmazlar. Özel bir grubun devre dışı bırakılması aynı zamanda etkin kayıtların da kaldırılmasına neden olur. Yeniden etkinleştirme, kaydedilmemiş metni etkin bir Özel kurala dönüştürmez; kaydedilen kaynağı yüklemek için kuralı çalıştırın.

### 2.3 Ortak alanlar

| Alan | Anlamı ve kısıtlamaları |
| --- | --- |
| İsim | Bu uç nokta içinde boş değildir, kırpılmıştır ve benzersiz, büyük/küçük harfe duyarlı değildir. Köprü aynı zamanda bağlanabilir grupları ad ve türe göre de tanımlar, dolayısıyla kararlı adlar önemlidir. |
| Etkin | Normal eşleştirmeyi etkinleştirir veya devre dışı bırakır. |
| Davranış | Anında bloke etme, bir izinden sonra bloke etme veya zamanlayıcı/geri sayım. Özel gruplar bu normal davranış seçici yerine kendi kurallarını kullanır. |
| İzin verilen dakika | İzin sonrası blok davranışı tarafından kullanılan pozitif sayı. Yeni grupların süresi varsayılan olarak 15 dakikadır. |
| Aralık saatlerini sıfırla | Zamanlı normal gruplar tarafından kullanılan pozitif sayı. Yeni grupların varsayılan süresi 24 saattir. |
| Aktif günler | Pazartesiden pazara. Geçerli yerel hafta içi gün seçilmediğinde normal bir grup etkin değildir. |
| Zaman pencereleri | HHMM-HHMM olarak yazılan sıfır veya daha fazla yerel zaman penceresi, her satıra bir tane. |
| Dondurma modu | Yok, Dondurulmuş, Kesinlikle dondurulmuş veya Ebeveyn dondurulmuş. |
| Erteleme politikası | Normal gruplar için süre/gecikme/bekleme/onay kontrolleriyle grubun ertelemeye izin verip vermediği. |
| Geri dönüş URL'si | Grup bir sayfayı engellediğinde kullanılan hedef. |
| Sonrakine atla | Düzenleyicide sağlandığında, normal engelleme akışının engellenen hedefin üzerinde kalmak yerine onu geçmesini ister. |

### 2.4 Normal grup davranışları

Normal düzenleyici üç davranış sunar:

| Davranış | Fonksiyonel sonuç |
| --- | --- |
| Hemen engelle | Grup aktif hale gelip eşleştiğinde, normal sayfa bloğu kararı hemen verilir. |
| Birkaç dakika sonra engelle | Görünür sayfa süresinin eşleştirilmesi, yapılandırılmış ödeneğe tahakkuk eder. Kontenjan dolduğunda normal grup, kullanım süresi sıfırlanana veya grup aktif olmayan/ertelenene kadar bloke eder. |
| Zamanlayıcı (ileriye doğru sayın, blok yok) | Eşleşen görünür sayfa süresi kaydedilir ve görüntülenebilir. Bu mod hiçbir zaman yalnızca zamanlayıcısının bir değere ulaşması nedeniyle engelleme yapmaz. |

Zamanlanmış kullanım görünür sayfa süresini temel alır. Bir sayfa arka plan sekmesinde gizlenirken zaman şarj edilmesi amaçlanmamıştır. Sıfırlama aralığı, normal zamanlı grup için değişen bir politika aralığıdır. Normal zamanlayıcılar gruba göre bağımsızdır.

### 2.5 Programlar

Programlar normal gruplar için geçerlidir. Özel grubun normal bir zamanlama kullanıcı arayüzü yoktur ve JavaScript'in amaçları doğrultusunda etkin olduğu kabul edilir; kuralın kendisi istenen herhangi bir zaman koşulunu dayatmalıdır.

Aktif gün politikası yerel saat kullanılarak değerlendirilir:

1. Haftanın geçerli günü seçilmezse normal grup etkin değildir.
2. Geçerli bir zaman penceresi sağlanmadıysa aktif gün, tam gün anlamına gelir.
3. Geçerli pencereler sağlanmışsa, geçerli yerel saatin en az bir pencerede olması gerekir.

Her pencerenin tam biçimi HHMM-HHMM'dir; örneğin 0900-1200. Saatler 00'dan 23'e, dakikalar 00'dan 59'a kadar olmalı ve başlangıç, aynı günün bitişinden önce olmalıdır. Bir pencere başlangıcını içerir ve sonunu hariç tutar. 2300-0100 gibi gece yarısı pencereleri geçerli değildir. Boş satırlar dikkate alınmaz ve yinelenen pencereler daraltılır.

### 2.6 Erteleme

Normal bir grup için erteleme, en fazla üç aşamadan oluşan geçici bir eylemsizlik durumudur:

| Aşama | Sonuç |
| --- | --- |
| Beklemede | İstenen erteleme mevcut ancak etkinleştirme gecikmesi nedeniyle başlamadı. Grup halen aktiftir. |
| Aktif | Grup, erteleme süresi boyunca geçici olarak devre dışıdır. |
| Bekleme Süresi | Erteleme sona erdi, grup tekrar aktif hale geldi ve bekleme süresi sona erene kadar başka bir erteleme başlatılamaz. |

Normal grup yapılandırma alanları şunlardır:

| Alan | Kural |
| --- | --- |
| Ertelemeye izin ver | Kapalıysa normal erteleme başlatılamaz. |
| Erteleme süresi | Olumlu dakikalar. Yeni bir normal grup, başlangıçta 30 olan genel varsayılanı alır.
| Etkinleştirme gecikmesi | Sıfır veya daha fazla dakika. Boş sıfır anlamına gelir. |
| Bekleme Süresi | Sıfırdan beş dakikaya kadar. Boş sıfır anlamına gelir. |
| Onaylar | Negatif olmayan bir tam sayı. Ürün, isteği kabul etmeden önce çok sayıda onay etkileşimi gerektirir. |

Özel bir grup, Erteleme düğmesini yalnızca bir giriş olayı olarak ele alır. Apps Kasası bu grup için snoozePress adlı Özel olayı yayınlar; kural adına normal süre/gecikme/bekleme süresi geri dönüşünü uygulamaz. Özel bir kural, etkinliği, kendi kalıcılığını, bir paneli, bir zamanlayıcıyı kullanabilir veya hiçbir işlem yapmamayı kullanabilir.

### 2.7 Dondur

Dondurma, bir grubu sıradan yapılandırma değişikliklerinden ve normal erteleme değişikliklerinden korur. Seçicide bir dondurma modunun seçilmesi, grubu tek başına dondurmaz; dondurma eylemi seçilen modu uygular.

| Modu | Fonksiyonel sözleşme |
| --- | --- |
| Dondurulmuş | Grup, ürünün normal çözülme onay akışı tamamlanana kadar kilitlenir. |
| Kesinlikle dondurulmuş | Grup, tam dondurma süresi dolana kadar çözülemez. Süre sıfırdan büyük olmalı ve 72 saatten fazla olmamalıdır; yeni bir grup varsayılan olarak 24 saate ayarlanır. |
| Ebeveyn dondurulmuş | Dondurma/çözme yönetimi için bir koruyucu şifre gereklidir. Yapılandırma iletişim kutusunda altı haneli bir şifre kullanılır. |

Dondurulmuş gruplar sıradan alanlar aracılığıyla düzenlenemez. Çevrimdışı bir üyeye sahip köprü bağlantılı bir küme, Vault'un küme genelinde dondurulmuş durumu güvenli bir şekilde koordine edememesi nedeniyle dondurma kontrollerini de kilitleyebilir. Donma, normal kullanıcı arayüzü işlemlerine karşı korumadır; bir tarayıcı profilini değişmez bir güvenlik sınırına dönüştürmez.

### 2.8 İçe aktarma, dışa aktarma, temizleme ve sıfırlama

Dışa aktarma, seçilen grubun uyumlu bir temsilini üretir. İçe aktarma, uyumlu grup verilerini eklemeden önce doğrular ve normalleştirir. İçe aktarılan grup adlarının yine de benzersiz olması gerekir. Grubu sil, o grubu ve normal kullanım/erteleme durumunu kaldırır. Temizle, onaylandıktan sonra tüm grupları kaldırır.

Varsayılanlara sıfırlama **genel ayarlar** işlemidir. Uzantı çapındaki tercihleri ​​göz ardı eder; ithalat/ihracatın yerine geçmez ve yıkıcı olarak değerlendirilmelidir.

## 3. Grup türleri ve eşleştirme sözleşmesi

### 3.1 Varsayılan web sitesi grubu

Site grubu, satırlarla ayrılmış bir web sitesi listesine sahiptir. Girişler ana bilgisayar/etki alanı biçiminde normalleştirilir. Bir ana bilgisayar girişi, söz konusu ana bilgisayarla ve onun tüm alt alan adlarıyla eşleşir.

| Ayar | Sonuç |
| --- | --- |
| Bu siteler dışındaki her şeyi engelle | Liste bir engelleme listesidir. Eşleşen bir ana bilgisayar engellendi. |
| Bu siteler dışındaki her şeyi engelle | Liste bir izin verilenler listesidir. Listede bulunmayan her ana bilgisayar engellenir. Bu nedenle boş bir izin verilenler listesi, kasıtlı olarak tam web'in kapatılması anlamına gelir. |
| Ana sayfayı engelle | Grubun ilkesini, bu kontrolün mevcut olduğu yapılandırılmış tarayıcı başlangıç/ana sayfa yüzeyine uygular. |
| Geri dönüş URL'si | Bir blok için hedefi yeniden yönlendirin. Boş bir grup değeri genel varsayılana geri döner. |

Normal Site grubu etki alanı listesi, düzenleyici tarafından sunulan tek bildirime dayalı tam site listesidir. Platform grupları bunun yerine kendi platformlarıyla ve yapılandırılmış platform koşullarıyla eşleşir.

### 3.2 Video platformu grupları

YouTube, TikTok, Facebook, Instagram ve Twitch video platformu gruplarıdır. Her biri kendi platform ana bilgisayarıyla sınırlıdır. Bir grup içerik formunu, yazar/hesap kapsamını, platformun ana sayfa akışını ve isteğe bağlı gizleme öğesi kontrollerini hedefleyebilir.

Genel yazar modları şunlardır:

| Modu | Sonuç |
| --- | --- |
| Hepsi | Yazara göre kısıtlama yapmayın; diğer yapılandırılmış eksenler eşleşmeye karar verir. |
| Dahil Et | Yalnızca listelenen normalleştirilmiş yaratıcıları/hesapları eşleştirin. |
| Hariç Tut | Listelenen girişler dışında tespit edilen tüm yaratıcıları/hesapları eşleştirin. |
| Hiç kimse | Hiçbir yazarla eşleşme. Bu kasıtlı olarak eşleşmeyen bir yazar eksenidir. |
| Etiket şunları içerir | Apps Kasası bunları sınıflandırabildiğinde içerik oluşturucuları listelenen herhangi bir etiketle eşleştirin. Bilinmeyen/sınıflandırılmamış yaratıcılar başarısız bir şekilde açılıyor. |
| Etiket hariç tut | Apps Kasası bunları sınıflandırabildiğinde, yapılandırılmış etiketleri olmayan yaratıcıları eşleştirin. Bilinmeyen/sınıflandırılmamış yaratıcılar başarısız bir şekilde açılıyor. |

İçerik formu seçenekleri platforma özeldir:

| Platformu | İçerik formları |
| --- | --- |
| Youtube | Tüm sayfalar, Kısa videolar, uzun videolar, gönderiler. |
| TikTok | Tüm sayfalar, kısa videolar. |
| Facebook | Tüm sayfalar, Makaralar, videolar, gönderiler. |
| instagram | Tüm sayfalar, Makaralar, videolar, gönderiler. |
| Seğirme | Tüm sayfalar, klipler, akışlar/VOD'lar, kanal sayfaları. |

Apps Kasası yazar girişini normalleştirir. Editör, platformun sıradan tanıtıcı/kanal/sayfa formunu ve desteklenen profil URL'lerini kabul eder. Yanlış biçimlendirilmiş girişleri sessizce farklı bir hedefe dönüştürmek yerine reddedebilir veya geçersiz olarak gösterebilir.

Yüzey gizleme seçenekleri üst düzey engellemeden bağımsızdır. Yalnızca mevcut platformun kullanıcı arayüzünü etkilerler ve platform işaretlemesini değiştirdiğinde çalışmayı durdurabilirler.

| Platformu | Gönderilen gizleme öğesi seçenekleri |
| --- | --- |
| Youtube | Kısa gezinme/raflar/kartlar, ana sayfa akışında tanıtılan/reklam yüzeyleri ve yorumlar. Reklamlarla ilgili seçenek bir uyarı verir çünkü reklamları gizlemek platformun şartlarına aykırı olabilir. |
| TikTok | Navigasyonu keşfedin. |
| Facebook | Makaralarda gezinme ve makara yüzeyleri. |
| instagram | Makaralar ve Gezinme/yüzeyleri keşfedin. |
| Seğirme | Navigasyona göz atın. |

YouTube içerik oluşturucu etiketi eşleştirmesi, yerel/mevcut kanal sınıflandırmalarını kullanır. Eksik bir sınıflandırma, yalnızca bir etiket modunun seçilmesi nedeniyle blok haline gelmez.

### 3.3 Reddit

Reddit grubu yalnızca Reddit'te geçerlidir. Varlığı bir alt dizindir. Subreddit girişi sıradan topluluk formunu kabul eder ve eşleştirmeden önce onu normalleştirir.

Alt düzenleme modları şunlardır:

| Modu | Sonuç |
| --- | --- |
| Hepsi | Alt reddit listesi kısıtlaması olmadan Reddit'e başvurun. |
| Dahil Et | Listelenen alt dizinlere uygulayın. |
| Hariç Tut | Listelenen alt dizinler dışındakilerin tümüne uygulayın. |
| Hiç kimse | Hiçbir alt dizine başvur. |

Gönderilen yüzey gizleme seçeneği Popüler/Tüm gezinmeyi gizler. Besleme kartı davranışı, Reddit'in şu anda algılanabilen kart yapısına bağlıdır.

### 3.4 Anlaşmazlık

Discord grubu yalnızca Discord/Discordapp sayfalarında geçerlidir. Hedefi bir sunucu kimliği veya bir sunucu/kanal çiftidir. Hedef düzenleyici normalleştirilmiş Discord kanal yolu değerlerini kabul eder.

| Modu | Sonuç |
| --- | --- |
| Hepsi | Hedef listesi kısıtlaması olmadan Discord'a başvurun. |
| Dahil Et | Yalnızca listelenen sunucuya veya sunucu/kanal hedeflerine uygulayın. |
| Hariç Tut | Listelenen hedefler dışındakilerin tümüne uygulayın. |
| Hiç kimse | Hiçbir hedefe başvurma. |

Discord'un şu anda normal platform profilinde gönderilmiş bir gizleme öğesi seçeneği yoktur.

### 3.5 Twitter / X

Bir Twitter/X grubu X/Twitter'a başvurur. Tüm hesaplara uygulanabilir veya normalleştirilmiş tanıtıcı/profil bağlantısı girişiyle video platformları için açıklanan genel hesap modlarını kullanabilir.

Gönderilen gizleme öğesi seçenekleri Keşfet, Mesajlar, Grok, Trendler ve tanıtılan yayın öğeleridir. Tüm seçici tabanlı yüzey kontrollerinde olduğu gibi, X işaretleme değişikliği bunların çalışmasını etkileyebilir.

### 3.6 Özel grup bildirim alanları

Özel grup öncelikle JavaScript kaynağını çalıştırır. Normal davranış seçiciyi veya normal program kullanıcı arayüzünü kullanmaz. Yine de uyumlu veriler aracılığıyla içe aktarıldığında veya yapılandırıldığında bir etki alanı listesi taşıyabilir:

- boş olmayan bir Özel engelleme listesi, sıradan tam sayfa site kararına katılabilir;
- Özel bir izin verilenler listesi boş olsa bile katılarak tam web bildirim temelli bir kilitleme oluşturabilir;
- yapılandırılmamış bir Özel grup, yalnızca bir kuralı olduğu için sayfaları yanlışlıkla engellemez;
- Özel zamanlayıcılar asla kendi başlarına engellemez; Bir kural, bir zamanlayıcının süresi dolduğunda bloke edilip edilmeyeceğine açıkça karar verir.

## 4. Genel ayarlar

Genel ayarlar tek bir grup yerine uzantıya uygulanır.

| Ayar | Varsayılan | Davranış |
| --- | --- | --- |
| Onay oranı | 1000 ms | Paylaşılan Özel onay Etkinliğinin sıklığı. Geçerli aralık 250 ila 60.000 ms'dir. Daha düşük değerler olaya dayalı kuralların daha duyarlı olmasını sağlayabilir ancak daha fazla CPU kullanabilir. |
| Otomatik kaydetme geri dönüşü | 400 ms | Son editör değişikliğinden sonra normal ayarların devam etmesinden önceki gecikme. Maksimum 5.000 ms'dir. |
| Hata ayıklama modu | Kapalı | Ayrıntılı Özel kural izleme çıktısını ve sayfadaki hata ayıklama günlüğü katmanını etkinleştirir. Bir kuralın sıradan günlük çağrılarının açılır günlüğe ulaşıp ulaşmadığını kontrol etmez. |
| Web sayfalarında özel kural günlüklerini göster | Açık | Sıradan sayfa günlüğü tostlarını kontrol eder. Kural yazarları yine de yalnızca ekran veya yalnızca açılır pencere çıktısını açıkça talep edebilir. |
| Varsayılan erteleme süresi | 30 dakika | Yeni normal gruplar oluşturulurken kullanılan tohum. Mevcut grupların kendi süreleri korunur. |
| Varsayılan geri dönüş URL'si | hakkında:boş | Engelleyen bir grubun gruba özel bir yedek URL'si olmadığında kullanılır. |
| Yaratıcıların sınıflandırılmasına yardımcı olun | Kapalı | Açık katılım. Karşılaşılan YouTube kanal kimliklerini yalnızca yapılandırılmış sınıflandırma hizmetine gönderir; başlıkları veya izleme geçmişini göndermez. |
| Yerel Dosya Klasörü | Yok | Özel kurallar için isteğe bağlı klasör özelliği. Bölüm 9'a bakınız. |
| Web uygulaması köprüsü | Kapalı | Uyumlu bir yerel Vault hub'ına isteğe bağlı bağlantı. Bölüm 11'e bakınız. |

### 4.1 Düzenleyici arayüzü ve geri bildirim yüzeyleri

Uzantı düzenleyicisinin kalıcı bir grup listesi ve seçili grup düzenleyicisi vardır. Grup listesi grup tipi seçiciyi, Ekle, Temizle, seçme, etkinleştirme geçişini ve sürükleme sıralamasını sağlar. Bölücüsü yeniden boyutlandırılabilir. Seçilen grup düzenleyici, gruba özgü alanları ve grup Dışa/İçe Aktarma eylemlerini sağlar.

Düzenleyici, genel geri dönme döneminden sonra olağan alan değişikliklerini otomatik olarak kaydeder. Doğrulama hataları durum/kısmi geri bildirim olarak raporlanır; geçersiz normal değerler sessizce ilgisiz ayarlara dönüştürülmez. Dondurulmuş bir grup, olağan düzenleme kontrollerini devre dışı bırakır.

Uzantı ayrıca kullanıcının görebileceği şu geri bildirim yüzeylerine de sahiptir:

| Yüzey | İşlevsel amaç |
| --- | --- |
| Kullanım Kılavuzu | Bu referansı uzantıda açar. |
| Dil seçici | Uzantı arayüzü dilini seçer. |
| Ayarlar | Yukarıda açıklanan genel ayarları açar. |
| Durum/kıskançlık geri bildirimi | Raporlar kaydedilir, içe aktarılır, doğrulanır ve eylem sonuçları sağlanır. |
| Sayfa içi zamanlayıcı katmanı | Etkin normal zamanlayıcı/geri sayım öğelerini ve görüntüleme kapsamındaki Özel zamanlayıcıları gösterir. Birden fazla öğe bir arada bulunabilir. |
| Sayfa içi günlük yüzeyi | Genel ayarlar izin verdiğinde Özel günlük, uyarı ve hata çağrılarını alır. |
| Özel Günlük | Kuralla oluşturulan açılır pencerede görülebilen girişler için canlı etkinlik günlüğü. Temizlenebilir ve indirilebilir. |

Özel gruplar için Kurallar alanı kaynak metni saklar. Önce Çalıştır, kural sözdizimi ön kontrolünü gerçekleştirir ve yalnızca bu başarılı olduğunda kaynağı yükler. Editör ayrıca metin değiştikçe yerel kaynak astarlama işlemini de gerçekleştirir. Görünür **Let AI Code** kontrolü bir bilgi istemi alanı açar ve kullanıcının isteğini, geçerli kuralı ve geçerli Özel kural API'sine oluşturulmuş bir referansı içeren bir kod oluşturma paketini kopyalar. Bir AI hizmetiyle iletişim kurmaz veya kuralı otomatik olarak değiştirmez.

Şablonlar kontrolü şablon tarayıcısını açar. Bir şablon gönderildiğinde bir başlığa, açıklamaya, etiketlere, parametrelere ve oluşturulmuş bir önizlemeye sahiptir. Bunun uygulanması, onaylandıktan sonra geçerli Kurallar metninin yerine geçer. Şu anda gönderilen şablon kataloğu boş; tarayıcı gelecekteki seçilmiş şablonlar için kullanılabilir durumda kalır ve etkin kuralların kaynağı olarak değerlendirilmemelidir.

## 5. Özel kural dili

### 5.1 Kural kaynağı formları

Özel grubun kaynağı JavaScript'tir. **Çalıştır**'da Apps Kasası, grubun önceki kayıtlarını ve önceki etkin kaynak tarafından oluşturulan durumu kaldırır, ardından yeni kaynağı yükler.

Kaynak şunlardan biri olabilir:

1. a function expression accepting events and helpers; or
2. Sağlanan olayları (veya eski olayı) ve yardımcı değişkenleri kullanan çıplak ifadeler.

```js
// Function-expression form
(events, helpers) => {
  events.on("openWebEvent", "welcome", (event, h) => {
    h.log("Opened", event.url);
  });
}
```

```js
// Bare-statement form
events.on("openWebEvent", "welcome", (event, h) => {
  h.log("Opened", event.url);
});
```

Çalıştır, JavaScript sözdizimi/ön kontrol kontrolünü gerçekleştirir ve yalnızca başarılı olduğunda geçerli kaynağı etkin hale getirir. Metni kaydetmek ve metni çalıştırmak kasıtlı olarak farklıdır: Bir kural, etkin olay kaynağı olmadan da kaydedilebilir.

Özel grup yeniden çalıştırıldığında, devre dışı bırakıldığında, silindiğinde veya açıkça durdurulduğunda etkin kaynak kaldırılır. Yeniden çalıştırma, kayıt başlamadan önce kuralın işleyicilerini, zamanlayıcılarını, panellerini, kalıcılık grubunu ve kural tarafından oluşturulan platform tahminlerini temizler. Korumalı alan kurtarma, etkin kaynağı yeniden yükleyebilir; kural yazarları bu nedenle kaydı bağımsız yapmalıdır.

### 5.2 Uygulama modeli ve güvenli varsayımlar

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Her işleyici şunları alır:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Azalan sayısal önceliğe göre çalıştırılan bir olay için işleyiciler; eşit öncelik, kayıt sırasını kullanır. Aynı olay türü ve kimliği tekrar kaydedilerek bir işleyici değiştirilebilir. Bir Özel grup için en fazla 1.000 kayıtlı işleyici vardır.

Vault, bir işleyicinin aktif çalışmasını yaklaşık bir saniyeyle sınırlandırıyor. Aynı grup için bir dakika içinde üç kez son tarih aşımı kuralı karantinaya alır: Vault, sorunlu bir işleyiciyi tekrar tekrar çalıştırmak yerine kuralı devre dışı bırakır. Olay başına meşgul beklemeler, sınırsız döngüler, eşzamanlı yoklama veya çok sayıda mutasyon/günlük kullanmayın.

Gönderim başına Apps Kasası en fazla şunları kabul eder:

| Ürün | Maksimum |
| --- | --- |
| Kural günlüğü girişleri | 200 |
| Yayınlanan etkinlikler | 64 |
| DOM işlemleri | 256 |
| Eylem/amaç | 256 |
| Grup başına paneller | 24 |
| Kontroller tek panelde | 32 |
| Seçim/radyo kontrolünde seçenekler | 64 |

Fazla günlük, yayınlanmış olay, DOM işlemi ve amaç girişleri bırakılabilir. Özel bir kural, teslim edilen fazla girişlere bağlı olmamalıdır.

### 5.3 Yerleşik olay türleri

Aşağıdaki olay türü dizeleri yerleşiktir. Bir kural, alt çizgiyle başlamadığı sürece kendi boş olmayan tür dizesini de kullanabilir.

| Etkinlik türü | Ne zaman gönderilecek | Önemli veriler |
| --- | --- | --- |
| onayOlay | Küresel onay oranı ayarında paylaşılan periyodik onay. | Mevcut olduğunda geçerli sayfa/sekme bağlamı. Bireysel bir işleyicinin hızını sınırlamak için intervalMs kayıt seçeneğini kullanın. |
| openWebEvent | Üst düzey bir sayfa kuralın kullanımına sunulur. | URL, ana bilgisayar adı, sekme/sayfa kimlikleri, zaman. |
| kapatWebEtkinliği | Üst düzey bir sayfa/sekme kapanır. | Mevcut olduğu yerde URL/ana bilgisayar adı bağlamı. |
| webDeğiştirilenEtkinlik | Aynı URL'nin yeniden yüklenmesi de dahil olmak üzere kararlı bir üst düzey gezinme. | veriler önceki URL/ana bilgisayar adını ve isFirstLoad, isReload ve SameDomain gibi gezinme işaretlerini taşır. |
| zamanlayıcıSonlandı | Özel zamanlayıcı, süresi dolmuş durumuna geçer. | veriler: timerId, displayName, yön, currentMs. Yalnızca zamanlayıcının sahibi olduğu gruba teslim edilir. |
| ertelemeBasın | Kullanıcı bu Özel grup için Ertelemeyi Başlat'a basar. | Kural yanıtın sahibidir; normal bir erteleme geri dönüşü gerçekleştirilmez. |
| panelEtkinliği | Oluşturulan bir Özel panelin bir etkileşimi vardır. | veri ve kolaylık alanları panel/kontrol/olay/değer bilgilerini içerir. |
| yerelDosyaOlay | İstenen bir yerel dosya eylemi tamamlanır. | veri ve kolaylık alanları requestId, yol, sonuç, bayt, girişler ve hatayı içerir. |
| sayfaKalp Atışı Etkinliği | Sekme görünür durumdayken yaklaşık her 250 ms'de bir görünür sayfa kalp atışı. | ElapsedMs görünür sayfada geçen süredir. Kapsamlı Özel zamanlayıcılar, kayıtlı bir işleyici olmasa bile bunu otomatik olarak kullanır. |

### 5.4 Olay kayıt defteri API'si

İşlev tarzı bir kaynağın ilk argümanı Olaylar kaydıdır. Çıplak ifade kaynağında hem olaylar hem de olay bu kayıt defterine başvurur.

| Yöntem | Sözleşme |
| --- | --- |
| events.on(type, id, handler, options) | Register a handler. Returns true when accepted, false for invalid/capped registrations. |
| events.register(type, id, handler, options) | Alias of on. |
| events.off(type, id) | Unregister a handler. Returns whether something was removed. |
| events.unregister(type, id) | Alias of off. |
| events.unregisterAll(type) | Remove all handlers owned by this group for that event type. Returns the number removed. |
| events.getEvent(type, id) | Return the registered function for this group/id, or null. |
| events.getEvents(type) | Return an object mapping this group's handler ids to functions. |
| events.countRegistered(type) | Return this group's number of registrations for type. |
| events.emit(type, data, options) | Queue a synthetic event. |
| events.post(type, data, options) | Alias of emit. |

İsteğe bağlı işleyici seçenekleri nesnesi şunları destekler:

| Seçenek | Anlamı |
| --- | --- |
| öncelik | Sayısal sıra. Daha yüksek değerler, daha düşük değerlerden önce çalışır. Varsayılan 0. |
| aralıkMs | Pozitif sayı. Yalnızca TickEvent için, işleyicinin önceki çağrısından bu yana bu kadar süre geçene kadar çağrıları bastırır. |

Sentetik olaylar varsayılan olarak grup kapsamına alınır: yalnızca yayınlayan gruba ait işleyiciler bunları alır. Etkinliği aynı türü kaydeden her kurala göndermek için { kapsam: "global" } kullanın. Etkinlik adında baştaki alt çizgiyi kullanmayın; rezerve edilmiştir.

### 5.5 Olay nesnesi

Her işleyici, ortak alanlara sahip değiştirilebilir bir olay nesnesi alır:

| Alan/yöntem | Sözleşme |
| --- | --- |
| yazın | Olay türü dizesi. |
| grup kimliği | Alıcı Özel grup kimliği. |
| tabID, sayfa kimliği | Mevcut olduğunda tarayıcı tanımlayıcıları; aksi takdirde boş. |
| url, ana bilgisayar adı | Geçerli üst düzey URL ve ana makine adı veya boş dizeler. |
| zaman | Gönderim zamanı nesnesinin kopyası veya null. |
| veriler | Etkinliğe özgü veri veya boş. |
| PreventDefault() | Gönderimi sayfa engelleme eylemi olarak işaretler. Sayfa, mevcut yönlendirme bağlantısına/sonucuna yönlendirilir; aksi halde Vault normal çıkış/geri dönüş yolunu kullanır. |
| Yayılımı durdur() | Geçerli olay gönderimi için sonraki işleyicileri durdurur. |
| setResult(değer) | Bir sayıyı veya dize sonucunu saklar. Boş olmayan bir dize, yönlendirme hedefi olarak değerlendirilir; sonuç 1, aksi halde biriktirilmiş bir PreventDefault sonucunu bastırır. |
| getResult() | Bu olay nesnesi tarafından belirlenen sonucu veya null değerini döndürür. |
| gönderi(tür, veri, seçenekler) | Events.post ile aynı kapsam kurallarına sahip sentetik bir olayı sıraya alın. |
| setRedirectLink(url) | Bu gönderimin yönlendirme URL'sini ayarlayın. Yalnızca dize olmayan bir giriş için false değerini döndürür. |
| getRedirectLink() | Bu gönderimin yönlendirme URL'sini veya boş bir dizeyi okuyun. |
| kapat(kimlik) | Bir sekmenin kapatılmasını isteyin. Sayı bir sekme kimliğidir, bir dize bir URL'yi tanımlar ve atlanan bir değer etkin sekmeyi hedefler. |
| blok(kimlik) | Yalnızca oturuma yönelik dinamik site engelleme modeli ekleyin. Dize kimliği olmadan etkinlik ana bilgisayar adını kullanın. |
| engellemeyi kaldır(kimlik) | Yalnızca oturuma yönelik dinamik site engelleme modelini kaldırın. Dize kimliği olmadan etkinlik ana bilgisayar adını kullanın. |
| aç() | Tarayıcı uzantısında işlem yok. Uygulamaları başlatamıyor. |

Bir işleyici olaya isteğe bağlı ekstra özellikler ekleyebilir. Bunları event.custom aracılığıyla veya olay nesnesi canlıyken doğrudan atanan adla okuyun. Kalıcı durum değildirler ve olaylar arası depolama değildirler.

PanelEvent için şu kolaylık alanları eklenir: panelId, controlId, eventName, değer, değerler, anahtar, kod ve keyInfo.

localFileEvent için şu kolaylık alanları eklenir: eventName, action, path, DirectoryPath, requestId, ok, text, value, entrys, asset, bytes ve error.

### 5.6 Yardımcı giriş noktaları

Helpers nesnesi şu doğrudan özelliklere sahiptir:

| Giriş noktası | Anlamı |
| --- | --- |
| helpers.now | Current dispatch timestamp in milliseconds. |
| helpers.currentUrl | Current unmodified URL string for this dispatch. |
| helpers.groupId | Owning Custom-group id. |
| helpers.log / warn / error | Direct aliases for the log helper. |
| helpers.logScreen / warnScreen / errorScreen | Direct aliases for screen-only logs. |
| helpers.logPopup / warnPopup / errorPopup | Direct aliases for popup-only logs. |
| helpers.getLogHelper() | Returns the log helper. |
| helpers.getDomainHelper(), getDomainUtility() | Return the domain helper. |
| helpers.getTimerHelper() | Returns the timer helper. |
| helpers.getPanelHelper() | Returns the panel helper. |
| helpers.getPersistenceHelper() | Returns the persistence helper. |
| helpers.getRedirectionHelper() | Returns the redirect helper. |
| helpers.getDOMHelper() | Returns the DOM helper. |
| helpers.getNavigationHelper() | Returns the navigation helper. |
| helpers.getStorageHelper() | Returns the persistence plus asynchronous storage helper. |
| helpers.getLocalFolderHelper() | Returns the optional local-folder helper. |
| helpers.getTabHelper() | Returns the tab-snapshot helper. |
| helpers.getWindowHelper() | Returns the browser-tab/window helper. |
| helpers.getPlatformHelper() | Returns the platform-helper collection. |
| helpers.platform() | Returns the platform-helper collection. |
| helpers.platform(name) | Returns the named raw platform API. Valid names: youtube, tiktok, facebook, instagram, twitch. |

## 6. Özel yardımcı referansı

### 6.1 Etki alanı yardımcısı

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Yöntem | Geri dönüş ve davranış |
| --- | --- |
| ana bilgisayar adıOf(url) | Başında www. bulunmayan normalleştirilmiş küçük harfli ana bilgisayar veya geçersiz bir URL için null. |
| pathnameOf(url) | URL yol adı veya URL ayrıştırılamadığında /. |
| eşleşmeler(ana bilgisayar adı, site) | Ana makine adı siteye eşit olduğunda veya onun alt etki alanı olduğunda doğrudur. |
| getPlatform(url) | youtube, tiktok, instagram, facebook, twitch veya null. |
| isYouTubeHost(ana bilgisayar), isTikTokHost(ana bilgisayar), isInstagramHost(ana bilgisayar), isFacebookHost(ana bilgisayar), isTwitchHost(ana bilgisayar), isRedditHost(ana bilgisayar), isDiscordHost(ana bilgisayar) | Ana sınıflandırıcılar. |
| youtube(), tiktok(), instagram(), facebook(), twitch() | Bu platformun URL sınıflandırıcı nesnesini döndürün. |
| isEmptyStartPage(url) | Tarayıcının desteklediği boş/yeni sekme/başlangıç ​​sayfası URL'leri için geçerlidir. |
| MatchAny(url, modeller) | Bir URL'yi bir RegExp, bir RegExp dizisi veya normal ifadeler olarak derlenen dizelerle eşleştirin. Geçersiz dize kalıpları dikkate alınmaz. |
| pathStartsWith(url, yol) | Kesin bir yol veya yolun soyundan gelenler için doğrudur. Eksik bir baştaki eğik çizgi sağlanır. |
| queryHas(url, anahtar, değer) | Bir sorgu anahtarı varsa doğrudur; değer sağlandığında dize değerine de eşit olmalıdır. |
| queryGet(url, anahtar) | Sorgu değeri veya null. |
| isSearchPage(url) | Desteklenen Google, Bing, DuckDuckGo, YouTube, Reddit ve X/Twitter arama URL'lerini algılar. |
| isInfiniteFeedUrl(url) | Desteklenen sonsuz besleme yüzeylerini algılar. |
| aynıBölüm(a, b) | Yalnızca her iki URL de bir ana bilgisayarı ve ilk yol adı segmentini paylaştığında doğrudur. |

Her platform URL sınıflandırıcı nesnesi isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url) ve extractVideoId(url)'yi ortaya çıkarır. Bir yöntem, URL geçerli olduğunda ancak bu tür içeriği tanımlamadığında false/null değerini döndürebilir.

### 6.2 Zamanlayıcı yardımcısı

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Oluşturma/alma seçenekleri:

| Seçenek | Anlamı |
| --- | --- |
| kimlik | Boş olmayan zamanlayıcı kimliği gerekli. |
| görünenAdı | İnsan tarafından okunabilen kaplama etiketi. |
| yön | sayım için ileri; diğer herhangi bir değer geri/geri sayım haline gelir. |
| akımMs | Başlangıç ​​milisaniyeleri sıfıra sabitlenir ve sınırlar mevcutsa sınırlanır. |
| minMs, maxMs | İsteğe bağlı pozitif minimum/maksimum sınırlar. |
| adımM'ler | Geçen işaretler için isteğe bağlı pozitif niceleme adımı. |
| kaplamaStil | Renk, arka plan, fontSize, fontWeight, border, borderRadius, padding, opacity ve icon için isteğe bağlı dizeler. Desteklenmeyen/geçersiz parçalar kaldırıldı. |
| kapsam(url) | Görünür sayfa süresinin nerede tahakkuk edeceğine karar veren yüklem. |
| etki alanı(url) | Zamanlayıcının kaplamada nerede görüneceğine karar veren yüklem; varsayılan kapsamdır. |
| tahakkuk ettiğinde(url) | İsteğe bağlı ekstra yüklem. Zaman yalnızca hem kapsam hem de tahakkuk zamanının doğru olması durumunda tahakkuk eder. |

| Yöntem | Davranış |
| --- | --- |
| oluştur(seçenekler) | Bir zamanlayıcı oluşturur/değiştirir ve durumunu sıfırlar. Kimlik veya null değerini döndürür. |
| getOrCreateTimer(seçenekler) | Yalnızca yoksa oluşturun. Mevcut durum değişmeden kalır. Kimlik veya null değerini döndürür. |
| sil(kimlik) | Zamanlayıcıyı ve kapsamını/görüntüleme yüklemlerini kaldırın. |
| duraklatma(id), devam ettirme(id) | Duraklatılmış durumu değiştirin. Yalnızca durum değişikliği mümkün olduğunda true değerini döndürün. |
| setDirection(kimlik, yön) | İleri veya geri ayarlayın. |
| setCurrentMs(id, ms) | Sınırları uygulayarak mutlak sayıyı ayarlayın. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Sınırları uygulayarak sayımı ayarlayın. |
| setBounds(id, minMs, maxMs) | Pozitif sınırlar belirleyin; Kaldırmak için bir sınır için null değerini iletin. |
| setStep(id, stepMs) | Pozitif bir onay nicelemesi ayarlayın. Temizlemek için null veya sıfırı iletin. |
| setOverlayStyle(id, stil) | İzin verilen kaplama stillerini değiştirin/temizleyin. |
| setDisplayName(kimlik, ad) | Kaplama etiketini ayarlayın. |
| getCurrentMs(id) | Sayı, yokluk zamanlayıcısı için sıfır. |
| Süresi Doldu(id) | Yalnızca bir zamanlayıcı mevcut olduğunda ve currentMs sıfır olduğunda doğrudur. |
| isPaused(id) | Boolean. |
| getDirection(id), getDisplayName(id) | Yön/ad veya null. |
| var(kimlik) | Boolean. |
| getState(id) | Serileştirilebilir zamanlayıcı anlık görüntüsü veya boş. |
| liste() | Serileştirilebilir zamanlayıcı anlık görüntüleri dizisi. |

Özel kaynak yüklü kaldığı sürece kapsam tahminleri hatırlanır. Vault, görünür pageHeartbeatEvent döngüleri sırasında eşleşen zamanlayıcıları, gönderim başına zamanlayıcı başına bir tıklama olacak şekilde ilerletir. Geriye doğru zamanlayıcı sıfırda durur ve sıfıra geçişte timerEnded mesajını yayar. Kural onu değiştirene/sıfırlayana kadar sıfır olarak kalır. Süresi dolmuş bir zamanlayıcının PreventDefault'u çağırması, bir yönlendirme ayarlaması veya başka bir eylem gerçekleştirmesi gerekip gerekmediğine karar vermek için zamanlayıcı sonlu bir işleyici kullanın.

### 6.3 Kalıcı ve eşzamansız depolama

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Yöntem | Davranış |
| --- | --- |
| get(anahtar, defaultValue) | Klonlanmış bir değeri veya defaultValue'yu okuyun. |
| ayarla(anahtar, değer) | JSON açısından güvenli bir klonu saklayın. Geçersiz anahtar/değer veya tuş başlığı tükenmesi durumunda false değerini döndürür. |
| sil(anahtar) | Mevcut anahtarı silin; var olup olmadığını döndürür. |
| var(anahtar) | Boolean. |
| tuşları() | Anahtar dizisi. |
| girişler() | Klonlanmış [anahtar, değer] çiftlerinin dizisi. |
| temizle() | Bu grup için tüm kural kalıcılığını silin. |
| boyut() | Anahtar sayısı. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Yöntem | Davranış |
| --- | --- |
| requestAsyncGet(anahtar) | Eşzamansız depolama okuması isteyin. Kuyruğa alındığında true değerini döndürür. Yanıt vermek için daha sonraki bir olayı/kendi durum akışınızı kullanın; senkronize bir alıcı değil. |
| requestAsyncSet(anahtar, değer) | Eşzamansız JSON açısından güvenli bir depo isteyin. Kuyruğa alındığında true değerini döndürür. |

Yeni bir etkin kaynak temiz bir Özel kural durumuyla başladığından, Çalıştırma sırasında kural kalıcılığı temizlenir.

### 6.4 Günlük kaydı yardımcısı

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Yöntem | Hedef |
| --- | --- |
| günlük, uyarı, hata | Açılan etkinlik günlüğü; genel sayfa günlüğü tostları etkinleştirildiğinde sayfa tostları. |
| logScreen, warnScreen, errorScreen | Yalnızca sayfa tost/hata ayıklama yüzeyi; açılır pencere günlüğünün dışında bırakıldı. |
| logPopup, warnPopup, errorPopup | Yalnızca açılır pencere etkinliği günlüğü; sayfa tostunun dışında tutuldu. |

Günlükler ayrıca bir CustomBlocker grup önekiyle tarayıcı konsoluna ulaşmaya çalışır. Bu bir kalıcılık API'si değil, teşhis çıktısıdır. Durum için kalıcılık yardımcısını kullanın.

### 6.5 Yönlendirme yardımcısı

Get it with helpers.getRedirectionHelper().

| Yöntem | Davranış |
| --- | --- |
| get(), getRedirectLink() | Geçerli gönderim yönlendirme URL'sini veya boş bir dizeyi döndürün. |
| set(url), setRedirectLink(url) | Geçerli gönderimin yönlendirme URL'sini ayarlayın. |
| createMessageUrl(mesaj) | Sağlanan mesajı görüntüleyen bir uzantı yerel mesaj sayfası URL'si oluşturun. |

Yalnızca yönlendirme ayarlamak gezinmeyi zorlamaz. İstenilen kural akışına göre bunu event.preventDefault() ile eşleştirin veya event.setResult() aracılığıyla boş olmayan bir dize ayarlayın.

### 6.6 DOM yardımcısı

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Yöntem | İstenen eylem |
| --- | --- |
| gizle(seçici), göster(seçici) | Eşleşen öğeleri gizleyin/gösterin. |
| addClass(seçici, sınıfAdı), RemoveClass(seçici, sınıfAdı) | CSS sınıfını değiştirin. |
| setText(seçici, metin) | Metin içeriğini değiştirin. |
| tıklayın(seçici) | Eşleşen öğeye tıklayın. |
| injectCss(css, kimlik) | Tanımlanmış bir CSS bloğu ekleyin. |
| RemoveInjectedCss(id) | Daha önce tanımlanmış bir enjekte edilmiş CSS bloğunu kaldırın. |
| kaydırma(seçici) | Eşleşen bir öğeyi görünüme kaydırın. |

DOM eylemleri, sınırsız sayfa komut dosyası oluşturma sağlamaz. Bunlar sınırlı bir eylem yüzeyidir ve kalp atışı/kene işleyicilerinden kullanıldığında bağımsız olmalıdırlar.

### 6.7 Gezinme, sekmeler ve tarayıcı penceresi yardımcısı

Get navigation with helpers.getNavigationHelper().

| Yöntem | İstenen eylem |
| --- | --- |
| geri() | Geçerli sekmede geriye gidin. |
| ileri() | Geçerli sekmede ileri git. |
| yeniden yükle() | Geçerli sekmeyi yeniden yükle. |
| git(url) | Geçerli sekmeyi URL'ye yönlendir. |
| closeTab() | Geçerli sekmeyi kapat. |

Get a snapshot helper with helpers.getTabHelper().

| Yöntem | Geri dönüş/eylem |
| --- | --- |
| liste() | Geçerli sekme anlık görüntüsünün kopyası. |
| getActiveTab() | Etkin sekme anlık görüntüsü veya boş. |
| getById(kimlik) | Eşleşen sekme anlık görüntüsü veya boş. |
| countAçık() | Anlık görüntüdeki sekme sayısı. |
| requestRefresh() | Daha sonraki kural çalışmaları için yeni bir sekme anlık görüntüsü isteyin. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Yöntem | Davranış |
| --- | --- |
| akım() | Geçerli etkin sekme nesnesi: kimlik, url, ana bilgisayar adı, başlık, isBrowser. |
| hepsi() | Kimliği, URL'si, ana bilgisayar adı, başlığı, etkin olan sekme nesneleri dizisi. |
| kapat(idOrUrl) | Atlandığında sayısal sekme kimliğine, tam URL dizesine veya etkin sekmeye göre kapatın. |
| closeTab() | Etkin sekmeyi kapatın. |
| blok(desen) | Normalleştirilmiş yalnızca oturuma yönelik bir alan adı bloğu ekleyin ve uygulayın. |
| engellemeyi kaldır(desen) | Normalleştirilmiş yalnızca oturuma yönelik etki alanı bloğunu kaldırın. |
| isBlocked(urlOrHostname) | Kuralla oluşturulan oturum engelleme listesini sorgulayın. |
| getBlocked() | Oturum tarafından oluşturulan mevcut kalıpları listeleyin. |

Kuralla oluşturulan blok kalıpları, http/https'yi, başta www.'yi ve bir ana bilgisayar modeline giden yolları normalleştirir. Ana makine ve alt alan adlarıyla tam olarak eşleşirler. Bu dinamik engelleme listesi, kayıtlı bir normal Site grubu değil, oturum belleğidir.

### 6.8 Yerel Dosya Klasörü yardımcısı

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Yöntem | Davranış |
| --- | --- |
| mevcut() | API yüzeyinin mevcut olduğunu bildirir; bir klasörün şu anda yetkili olduğunu kanıtlamaz. |
| requestRead(yol) | Metnin okunmasını isteyin. |
| requestWrite(yol, metin) | Metin yazma isteğinde bulunun. |
| requestAppend(yol, metin) | Metin ekleme isteği. |
| requestList(yol = "") | Bir dizin listesi isteyin. |
| requestExists(yol) | Varlık testi isteyin. |
| requestReadJson(yol) | JSON okumasını isteyin; yol .json ile bitmelidir. |
| requestWriteJson(yol, değer) | JSON yazma isteğinde bulunun; yol .json ile bitmeli ve değer JSON açısından güvenli olmalıdır. |

Yollar her zaman seçilen köke göredir. Mutlak olamazlar, sürücü nitelikli olamazlar, nokta öneki olamazlar veya içeremezler. veya .. segmentler. Dosya işlemleri için yalnızca .txt, .csv ve .json dosyaları kabul edilir. Klasör seçimi herhangi bir zamanda iptal edilebilir; başarısız bir istek, tamam false ve localFileEvent'te bir hata dizesi bildirir.

### 6.9 Platform yardımcısı

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Tüm ham platform API'leri şunları ortaya çıkarır:

| Yöntem | Davranış |
| --- | --- |
| gizle(yüklem, seçenekler) | Bu platformdaki her besleme kartı yuvası için aynı öğe başına yüklemi ayarlayın. |
| gizle(yuva, yüklem, seçenekler) | Her öğe için bir yüklem ayarlayın. Yüklem, o platform tarafından sağlanan platform öğesini/anlık görüntüsünü alır. |
| izin ver(yüklem, seçenekler), izin ver(yuva, yüklem, seçenekler) | Gizle ile aynıdır ancak bir izin/istisna kararı oluşturur. |
| göster(), göster(yuva) | Kurulu yüklem yuvalarının tümünü veya birini temizleyin. |
| yüzey(isim, "gizle" veya "göster") | Tüm platform bölgesini gizleyin/gösterin. home, homePage'in genel adıdır. |
| zamanlayıcı(yuva, seçenekler) | Bir platform alt bölüm zamanlayıcısını yapılandırın. Sağlandığında options.id değerini döndürür, aksi halde null. |
| yeniden tarama() | Harici kural durumu değişikliklerinden sonra zaten taranmış olan besleme kartlarını yeniden değerlendirin. |
| anlık görüntü() | Geçerli platformun anlık görüntüsünü döndürün veya null. |
| slots(), yüzeyler(), timerSlots() | Bu platform için desteklenen adları döndürün. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId | Bu platform için URL yardımcıları. |

Bir slot, bir grup/platform için bir yüklemeye sahiptir. Aynı yuva için daha sonraki bir gizle/izin ver çağrısı, önceki yüklemin yerini alır; örtülü bir VEYA değildir. İsteğe bağlı seçenekler nesnesi şunları tanır:

| Seçenek | Efekt |
| --- | --- |
| BlockPageOnVisit | Eşleşen bir kart/sayfa ziyaret edildiğinde, yalnızca kartı gizlemek yerine sayfa engelleme talebinde bulunun. |
| etkisi | engelle (varsayılan) veya izin ver. İzin verme yardımcı setleri otomatik olarak izin verir. |

Bir yüklem, panel onay kutusu, kota veya zaman eşiği gibi kartlar ilk kez değerlendirildikten sonra değişen duruma bağlı olduğunda yeniden taramayı çağırın.

Ham platform destek matrisi:

| Platformu | Tahmin yuvaları | Yüzey adları | Zamanlayıcı yuvaları |
| --- | --- | --- | --- |
| Youtube | kısalar, videolar, gönderiler, yorumlar, canlı | ana sayfa, shortButton, yorumlar, canlı | kısalar, videolar, gönderiler |
| TikTok | videolar, yorumlar, canlı | ana sayfa, yorumlar, canlı | videolar |
| instagram | şortlar, gönderiler, yorumlar | ana sayfa, yorumlar | şortlar, direkler |
| Facebook | kısalar, videolar, gönderiler, yorumlar, canlı | ana sayfa, yorumlar, canlı | kısalar, videolar, gönderiler |
| Seğirme | kısalar, yayınlar, videolar, canlı | ana sayfa, yorumlar, canlı | kısa videolar, yayınlar, videolar |

Ham Özel platform yardımcısı Reddit, Discord veya Twitter/X'i açığa çıkarmaz. Bu sitelerde özel çalışmalar için genel URL, DOM, zamanlayıcı, panel ve gezinme özelliklerini kullanın.

## 7. Özel paneller

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### 7.1 Panel API'si

| Yöntem | Davranış |
| --- | --- |
| oluştur(yapılandırma) | Bir panel oluşturun veya değiştirin. Normalleştirilmiş panel kimliğini veya boş değeri döndürür. |
| getOrCreatePanel(yapılandırma) | Yalnızca yokken oluşturun; kimliği veya null değerini döndürür. |
| güncelleme(kimlik, yama) | Doğrulamadan sonra belirtilen panel alanlarını değiştirin. |
| sil(kimlik) | Bir paneli ve kayıtlı satır içi işleyicilerini kaldırın. |
| göster(id), gizle(id) | Görünürlüğü değiştirin. |
| setValue(panelId, controlId, değer) | Doğrulamadan sonra yazılabilir bir kontrol değeri ayarlayın. |
| updateControl(panelId, controlId, yama) | Bir denetimin izin verilen alanlarını değiştirin. |
| devre dışı bırak(panelId, kontrolId), etkinleştir(panelId, kontrolId) | Kontrol kullanılabilirliğini açın/kapatın. |
| setOptions(panelId, controlId, seçenekler) | Seçim/radyo seçeneklerini değiştirin. |
| setText(panelId, kontrolId, metin) | Bir düğme etiketini, metni/bölüm metnini veya başka bir kontrol etiketini güncelleyin. |
| setTheme(panelId, tema) | Panel temasını değiştirin. |
| setTitle(panelId, başlık), setDescription(panelId, açıklama) | Metni güncelle. |
| getValue(panelId, controlId) | Klonlanmış veya tanımsız bir değer döndürün. |
| getValues(panelId) | Kontrol kimliği tarafından anahtarlanan tüm yazılabilir değerleri döndürür. |
| getState(id) | Serileştirilebilir bir panel anlık görüntüsünü veya null değerini döndürün. |
| liste() | Tüm panellerin serileştirilebilir anlık görüntülerini döndürün. |
| bildirim(yapılandırma) | İsteğe bağlı mesaj/metin içeren, sağ altta kompakt bir durum paneli oluşturun. |
| onayla(yapılandırma) | Oluşturulan onaylama ve iptal düğmeleriyle ortalanmış bir iletişim kutusu oluşturun. |
| kontrol listesi(yapılandırma) | Onay kutusu öğelerinden oluşan bir panel oluşturun. |
| form(yapılandırma) | Alanlardan bir form düzeni paneli oluşturun. |

### 7.2 Panel yapılandırması

| Alan | Kabul edilen değerler/davranış |
| --- | --- |
| kimlik | Gerekli. Harflere, rakamlara, alt çizgiye, kısa çizgiye göre normalleştirilmiş; maksimum 80 karakter. |
| başlık | Panel başlığı, maksimum 240 karakter. |
| açıklama veya gövde | Açıklama, maksimum 1.000 karakter. |
| pozisyon | sol üst, sağ üst, sol alt, sağ alt veya orta. Varsayılan sağ alt. |
| hizala | sol, orta veya sağ. Varsayılan sol. |
| düzen | dikey, kompakt, rahat, ferah, satır içi, satır, sarma, iki Sütun, ızgara, bölme, form, araç çubuğu veya yığın. Varsayılan dikey. |
| öncelik | -1000'den 1000'e sabitlenmiş sayısal görüntüleme sırası. Önce daha yüksek paneller görüntülenir. |
| genişlik | küçük, orta, büyük veya 180 - 520 piksel arası. |
| metinBoyutu/yazı tipiBoyutu | 10 ila 32 piksel veya 0,65 ila 2 rem/em. |
| ariaLabel/a11yLabel | Erişilebilir etiket. |
| rolü | bölge, iletişim kutusu, uyarı, durum, form veya grup. |
| otomatik Odaklama | Boolean. |
| tema/renkler | arka plan, ön plan, vurgu, kenarlık, sessiz, fontSize/textSize, titleSize. |
| kontroller | Üç seviyeye kadar iç içe geçmiş bölümlerle 32'ye kadar kontrolden oluşan dizi. |
| görünür | False paneli gizler. |
| kapsam(url), etki alanı(url) | Kullanılabilirliği/görüntüyü kontrol eden işlevler. etki alanı önceliklidir; etki alanı olmadan kapsam kontrolleri görüntülenir. |

Panel satır içi işleyici alanları panelde veya bireysel kontrolde görünebilir: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey ve onKeyDown. Her biri normal (olay, yardımcılar) parametrelerini alır. Satır içi işleyici, bu panel kontrol tanımlarıyla yeniden oluşturulduğunda/güncellendiğinde değiştirilir.

### 7.3 Kontroller

Kullanılabilir kontrol türleri şunlardır: metin, onay kutusu, seçim, textInput, textarea, düğme, bölüm, zamanlayıcı, numberInput, aralık, geçiş, radyo, tarih, saat, renk, pin ve html. Takma ad girişi, açılır liste, grup, sayı, kaydırıcı, anahtar, ham ve işaretleme, karşılık gelen türlerine göre normalleştirilir.

Tüm kontroller kimlik, tür, etiket, değer, devre dışı, öncelik ve ilgili düzen, hizalama, ariaLabel/a11yLabel, autoFocus, genişlik, yükseklik ve satırları kabul eder.

| Tür | Önemli alanlar ve değer sözleşmesi |
| --- | --- |
| metin | giriş olmayan metin olarak işlenen metin (veya etiket). |
| onay kutusu, geçiş | Boole değeri. |
| seç, radyo | dizeler veya { value, label } nesneleri olarak seçenekler; maksimum 64. Değer kısa bir dizedir. |
| textInput, textarea | Dize değeri, maksimum 2.000 karakter; isteğe bağlı yer tutucu. |
| düğmesi | etiket/metin; isteğe bağlı eylem gönderin, iptal edin veya kapatın. |
| bölüm | metin/açıklama, rol ve iç içe geçmiş kontroller. |
| zamanlayıcı | timerId veya timer anlık görüntüsü; ms, ss, dd:ss veya ss:dd:ss biçimini alın; showExpired varsayılanları doğru. |
| sayıGiriş, aralık | Sağlanan min/maks'a sabitlenmiş sayısal değer; isteğe bağlı olumlu adım. |
| tarih | Yalnızca YYYY-AA-GG değeri. |
| zaman | Yalnızca SS:DD veya SS:DD:SS değeri. |
| renk | Altı haneli #RRGGBB giriş değeri. |
| pim | Yalnızca rakamlar, uzunluk 3'ten 12'ye kadar, varsayılan olarak maskelenir, isteğe bağlı otomatik Gönderme. |
| HTML | Sterilize edilmiş işaretleme. Komut dosyası blokları, satır içi etkinlik özellikleri ve javascript: URL'ler kaldırılır. |

Oluşturulan her etkileşim panelEvent'i oluşturur. Etkinliğin değerler nesnesi, düğmeler, metin ve zamanlayıcı kontrolleri hariç, panelin yazılabilir kontrollerini içerir. Kapatma eylemi, işleyiciler olayı gözlemlemeden önce paneli gizler.

## 8. Özel kurallı eylem tarifleri

Aşağıdaki örnekler bir eğitim değil, genel kompozisyonun spesifikasyonlarıdır.

### 8.1 Açılış sayfasını yönlendirme

```js
(events, helpers) => {
  events.on("openWebEvent", "redirect-distracting-search", (event, h) => {
    const domain = h.getDomainHelper();
    if (!domain.isSearchPage(event.url)) return;
    event.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Return to your planned task."));
    event.preventDefault();
  });
}
```

### 8.2 Açık bloklu görünür zaman geri sayımı

```js
(events, helpers) => {
  const timer = helpers.getTimerHelper();
  timer.create({
    id: "reading-budget",
    displayName: "Reading budget",
    direction: "backward",
    currentMs: 10 * 60 * 1000,
    scope: (url) => url.includes("example.com")
  });

  events.on("timerEnded", "stop-at-zero", (event) => {
    if (event.data?.timerId !== "reading-budget") return;
    event.setRedirectLink("about:blank");
    event.preventDefault();
  });
}
```

### 8.3 Panelden feed yüklemini değiştirme

```js
(events, helpers) => {
  const panel = helpers.getPanelHelper();
  const youtube = helpers.platform("youtube");

  panel.create({
    id: "feed-filter",
    title: "Feed filter",
    controls: [{
      id: "hide-sponsored",
      type: "toggle",
      label: "Hide sponsored items",
      value: true,
      onChange: (event, h) => {
        const api = h.platform("youtube");
        if (event.value) {
          api.hide("videos", (item) => item?.sponsored === true);
        } else {
          api.show("videos");
        }
        api.rescan();
      }
    }]
  });

  youtube.hide("shorts", () => true);
}
```

Aktif platform yüzeyi tarafından sağlanan platform anlık görüntüsü/öğe değerleri için yüklemlerin yazılması gerekir. Bir platform bir alanı güvenilir bir şekilde tanımlayamıyorsa, bir değerin doğru olduğunu varsaymak yerine yüklemin başarısız bir şekilde açılması gerekir.

## 9. Yerel klasör istek protokolü

Yerel Klasör işlemleri anında dosya G/Ç işlemi değildir. Tam işlevsel sıra şöyledir:

1. Kullanıcı Genel Ayarlar'da bir klasör seçer.
2. Kural bir isteği sıraya koyar ve bir istek kimliği alır.
3. Vault, yetkili klasör özelliğinden işlemi gerçekleştirmesini ister.
4. Vault, localFileEvent'i aynı Özel gruba gönderir.
5. İşleyici, event.requestId'yi orijinal istek kimliğiyle ilişkilendirir.

Başarılı okuma, metin dosyaları için metinle veya JSON için değerle tamamlanır. Liste girişleri döndürür. Mevcut getiriler mevcut. Yazma/ekleme uygun olduğu yerde bayt sağlar. Başarısızlık tamam yanlış ve hata sağlar. Kurallar hiçbir zaman seçilen klasörün yeniden yükleme, tarayıcı yeniden başlatma veya izin iptalinden sonra yetkili kaldığını varsaymamalıdır.

## 10. Özel kural güvenliği ve arıza semantiği

### 10.1 Derleme ve çalıştırma hataları

Sözdizimi raporlarının derleme hatasını kontrol edin. Çalıştır ayrıca kayıt sırasında bir çalışma zamanı hatasını da bildirebilir. İşlev benzeri bir kaynakta sözdizimi hatası varsa Vault sessizce bunu zararsız çıplak ifadeler olarak ele almaz.

Boş bir kaynağın sıfır işleyicisi vardır. Etkin olmayan bir Özel kural olarak geçerlidir ancak yapılandırılmış hiçbir Özel eylem gerçekleştirmez.

### 10.2 İşleyici hataları

Bir işleyiciden gelen istisna, genel olay gönderiminden izole edilir. Bu teşhis çıktısıdır; sonraki işleyicilerin sihirli bir şekilde başarılı olmasını sağlamaz. Dar işleyiciler kullanın ve işlem yapılabilir hataları günlüğe kaydedin.

### 10.3 Karantina

Apps Kasası, tekrarlanan son teslim tarihi aşımlarından veya kayıt sırasında bir aşımdan sonra Özel bir grubu karantinaya alabilir. Karantina, grubu devre dışı bırakır ve iptal nedenini kaydeder. Kaynağı düzeltin, kaydedin ve etkin kayıtları geri yüklemek için açıkça yeniden çalıştırın.

### 10.4 Tarayıcı/sayfa sınırları

Hiçbir Özel kural, kısıtlanmamış uzantı API'lerini almaz. Özellikle:

- DOM seçici değişen bir platformda hiçbir şey bulamaz;
- gezinme, sekme kapatma ve ekran eylemleri tarayıcı özelliklerine bağlı olmaya devam eder;
- bir uzantı yerel uygulamaları açamaz;
- yerel klasör işlemleri, kullanıcı tarafından verilen bir klasörü ve desteklenen dosya türlerini gerektirir;
- bir olay işleyicisi görünür zamanlı kalp atışları üretmeye devam eden görünmez bir sayfaya güvenemez;
- bir sayfa, kuraldan bağımsız olarak bir içerik komut dosyasını yeniden yükleyebilir, gezinebilir, atılabilir veya geçersiz kılabilir;
- kuralla oluşturulan dinamik site blokları, kalıcı Site grubu düzenlemeleri değil, oturum durumu eylemleridir.

## 11. Web uygulaması köprüsü

Köprü isteğe bağlıdır. Bir tarayıcı uzantısı istemcisini uyumlu bir yerel Vault hub'ına bağlar. Tarayıcı uzantısı bir istemcidir; yerel bir Vault uygulaması hub'ı sağlar. Sabit yerel uç nokta ws://127.0.0.1:8787'dir ve protokol uyumluluğu gereklidir.

Bağlantı durumları Kapalı, Bağlanıyor, Bağlantı Kesildi, Bağlandı ve Hata'dır. İstemci etkinleştirildiğinde, Vault ilk önce hızlı bir şekilde araştırma yapar ve ardından bağlanana veya kullanıcı onu kapatana kadar daha yavaş yeniden bağlanma denemelerine devam eder. Bağlantı tek başına tüm grupları birleştirmez.

### 11.1 Grupları bağlama

Gruplar yalnızca adları ve türleri eşleştiğinde ve bağlanmaya uygun olduklarında bağlanabilir. Kullanıcı, katılımcı programları açıkça seçer/bağlar. Bağlantılı bir grup bir küme oluşturur. Bağlantının kesilmesi yerel grup verilerini olduğu gibi bırakır; canlı senkronizasyonu durdurur.

Köprü, normal engelleme modu, izin verme/sıfırlama değerleri, erteleme ayarları, etkin günler/pencereler, durumu/seçim/süreyi dondurma, ana sayfa politikası, izin verilenler listesi ayarı, geri dönüş URL'si ve sonrakine atlama politikası dahil olmak üzere desteklenen bağlı gruplar için paylaşılan skaler politikayı senkronize eder. Ayrıca küme üyeleri için kullanımı ve erteleme durumunu da koordine eder.

Köprü, ürüne özgü her alanın, platform seçicinin, Özel kaynak metnin veya tarayıcıya özgü yeteneğin farklı bir programa aktarılabileceği sözünü vermez. Köprü bağlıyken bile bir grup yerel kalabilir ve bağlantısız kalabilir.

Dondurulmuş köprü kümeleri, koordineli mutasyon gerektiren donma durumu eylemleri için ilgili tüm üyelerin çevrimiçi olmasını gerektirir. Bağlantı, bir bulut yedekleme veya uzaktan kontrol kanalı değil, yerel aktarımdır.

## 12. Bakımcılar için doğrulama kontrol listesi

Bir sürümü veya çoğaltma davranışını denetlerken bu kontrol listesini kullanın:

1. Grubun boş olmayan benzersiz bir adı, doğru türü, etkin durumu ve amaçlanan liste/sıraya sahip olduğunu doğrulayın.
2. Normal gruplar için haftanın aktif gününü, geçerli yerel saat penceresini, aktif ertelemenin olmadığını ve dondurulmamış düzenleme durumunu onaylayın.
3. Bir Site grubu için tam ana makineyi, alt alan adını ve (izin verilenler listesi için) listenin dışındaki bir ana makineyi test edin.
4. Bir platform grubu için, sayfa düzeyinde eşleşmeyi, hedeflenen öğe/kart eşleşmesini, yazar modunu, içerik formu modunu ve etkin yüzey gizlemeyi ayrı ayrı test edin.
5. Zamanlanmış normal gruplar için görünür sayfa tahakkukunu, tahsisatın sona ermesini veya artan engellemeyen davranışı ve sıfırlama aralığını doğrulayın.
6. Özel kurallar için sözdizimi denetimi çalıştırın, Çalıştırın, işleyici sayısını/günlüklerini inceleyin, kayıtlı her yerleşik olayı test edin, ardından yeniden yüklemeyi/gezinmeyi test edin.
7. Her Özel zamanlayıcıyı kapsam sınırlarında ve sıfırda test edin; herhangi bir bloğun kuralda açık olduğunu doğrulayın.
8. Panelleri her bir kontrol değeri, devre dışı durumu, gönderme/iptal etme/kapatma eylemi ve panelEvent işleyicisi ile test edin.
9. Başarıdan önce yerel klasör hatasını test edin: seçili klasör yok, iptal edilen izin, geçersiz yol, desteklenmeyen uzantı, ardından yetkili okuma/yazma.
10. Senkronizasyona güvenmeden veya koordinasyonu dondurmadan önce köprü bağlantısının kapalı olduğunu, bağlantının açık olduğunu, bağlantılı/bağlantısız grubu ve çevrimdışı bir küme üyesini test edin.

## 13. Sürüm oluşturma kuralı

Bu İngilizce dosya, bakımı yapılan kaynak kılavuzdur. Yerelleştirilmiş kılavuzlar bunun çevirileridir ve işlevsel bir belge güncellemesinden sonra yeniden oluşturulması gerekebilir. Ürün kaynağı, uygulama düzeyindeki belirsizlik için kanonik gerçek olmaya devam ediyor.
