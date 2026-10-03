# Vault tarayıcı uzantısı kullanıcı kılavuzu

Vault, yüklü olduğu tarayıcı profilindeki web sitelerini ve desteklenen platform içeriklerini denetler. Düzenleyiciyi araç çubuğundaki uzantı düğmesinden açın. Bağlandığında Mac Vault veya Windows Vault yerel etiketleme ve Activity sağlar; uzantı tarayıcı hedeflerine yönelik engellemeyi uygular.

## Engelleme grupları

**Engelleme grubu** bir engelleme ilkesi uygular. **Classifier grubu** içeriğe etiket atar; tek başına hiçbir şeyi engellemez.

1. Bir engelleme grubu ekleyip ad verin.
2. **Uygulandığı yerler** altında hedefleri seçin.
3. Engellemenin ne zaman uygulanacağını seçin, ardından gerekirse zamanlama veya izin verilen süre belirleyin.
4. Grubu etkinleştirin. Hedefleri grubun ilkesini paylaşır.

Rutin düzenlemeler otomatik kaydedilir. Hata, düzenlemenin kabul edilmediği anlamına gelir; alanı düzeltip yeniden deneyin. Yapılandırmasını koruyarak ilkesini durdurmak için grubu devre dışı bırakın. **Grubu sil** grubu kaldırır. Grupları yeniden sıralamak için sürükleyin. Bir hedefe birden fazla grup uygulanabilir; birini ertelemek diğer grubun engelini kaldırmaz.

**Dışa aktar** grup yapılandırmasını kopyalar. **İçe aktar** onaydan sonra seçilen grubun yapılandırmasını değiştirir.

### İzin verilen süre ve zamanlama

**Hemen engelle**, etkin grup eşleştiğinde ve zamanlaması etkin olduğunda uygulanır. **İzin verilen süre dolduğunda engelle**, süre bitene kadar eşleşen kullanıma izin verir.

İzin verilen süreyi dakika, sıfırlama aralığını saat olarak belirleyin. Kayan sınır, önceki zaman aralığındaki kullanımı sayar. Gece yarısı sıfırlama, kayan sınır için de yerel gece yarısında yeni dönem başlatır.

Etkin hafta günlerini ve isteğe bağlı yerel saat aralıklarını satır başına bir tane olacak şekilde seçin; örneğin **09:00-12:00**. Aralık listesi boşsa seçilen gün boyunca uygulanır. Aralık aynı gün içinde başladığından daha geç bitmelidir; geceyi aşan zamanlamayı ayrı günlere bölün.

### Erteleme

Ertelemeyi her engelleme grubunda yapılandırın. **Engellemeyi duraklat**, grubun ilkesini belirlenen duraklama süresince askıya alır. **İzin verilen süreye ekle**, süre sınırlı gruba kullanılabilir dakika ekler. Ertelenmiş süre olarak yalnızca tüketilen ek süre sayılır. Kullanılmayan ek süre bir sonraki sıfırlamada sona erer; kayan sınırda bir aralık sonra, ayar açıksa daha önce gece yarısında biter.

**Etkinleştirme gecikmesi**, engelleme sürerken ertelemeyi geciktirir. **Bekleme süresi**, erteleme bittikten sonraki yeni isteğe kadar beklenecek süredir. **Gerekli onay sayısı**, onay adımlarını belirler. Erteleme, dondurulmuş grupta yalnızca dondurmadan önce izin verilmişse kullanılabilir.

### Dondurma ve PIN

**Dondur**, rutin düzenlemeleri engeller. Dondurmayı kaldırmak için beş saniye arayla on onay, ayarlanmış bekleme süresi ve altı haneli PIN gerekir. **Dondurmayı kaldırmadan önce bekle** 0–72 saat kabul eder; 0 ek bekleme koymaz.

Grup donmuşken bekleme uzatılabilir ve yoksa PIN eklenebilir. Grup çözülene kadar bu koşullar gevşetilemez. Silme işlemi de kalan bekleme süresine ve PIN'e tabidir.

### Bağlı gruplar

Diğer Vault programlarında açıkça seçilen grupları bağlamak için **Bağla** seçeneğini kullanın. Bağlı gruplar adlarını, desteklenen ilke ayarlarını, hedefleri, kullanımı ve dondurma koşullarını paylaşır. Her program desteklediği hedef türlerini düzenler ve uygular; diğer hedef kayıtları bağlı programlar için kullanılabilir kalır. Bağlantıyı kaldırmak grupları ve ayarlarını korur.

Bağlı bir üye çevrimdışıysa düzenleme kullanılamayabilir. Yeniden bağlanmak için masaüstü Vault uygulamasını ve bağlı tarayıcıyı açın. Yerel olarak kaydedilmiş ilke, üye çevrimdışıyken uygulanmaya devam edebilir.

## Yardım alma

Açıklamasını görmek için alanın yanındaki küçük **i** simgesine tıklayın. Kapatmak için dışına tıklayın veya Escape tuşuna basın. Listeler kaydırılabilir kutulardadır; daha fazla öğe için kutuyu kaydırın. Arama öğeleri silmeden görünür listeyi filtreler.

Özel kuralların ayrı bir [Kod kılavuzu](../code-manual/tr.md) vardır. Düzenleyiciyi, etkinleştirmeyi, günlükleri, dosya erişimini ve desteklenen API'yi açıklar.

## Web siteleri ve platform içeriği

Her satıra bir alan adı veya tam URL ekleyin. Alan adı alt alan adlarını da kapsar. Yol, eşleşmeyi o yol ve alt yollarıyla sınırlar. **Bu siteler dışındaki her şeyi engelle** listeyi izin listesine dönüştürür.

Aynı web sitesini birden fazla ekleyebilirsiniz. Her kaydın kendi filtresi ve sayfa kontrolleri vardır; örneğin bir YouTube kaydı Shorts'u, diğeri bir içerik üreticisini engelleyebilir. Eşleşen kayıtlar grup içinde birleşir ve grubun zamanlamasını, izin verilen süresini ve ertelemesini paylaşır.

Bir hedef eşleşen sayfayı kaplayabilir veya önce duraklatıp geri sayımdan sonra Devam et seçeneği sunabilir. Aynı grupta engelleme hedefi duraklatma hedefinden önceliklidir. **Engellendiğinde: yönlendir veya mesaj göster**, web adresi ya da kaplama mesajı kabul eder; sayfayı olduğu yerde kaplamak için boş bırakın. Duraklatma asla yönlendirmez.

Platform hedefleri video platformları için **İçerik üreticileri**, Twitter / X için **Hesaplar**, Reddit için **Topluluklar**, Discord için sunucu/kanal kimliklerini kullanır. Kontroller, Vault kaynağı ve içerik türünü tanıyabildiğinde uygulanır. İçerik kontrolleri reklamlar veya video kartları gibi desteklenen sayfa öğelerini gizler. Tarayıcı izinleri ve web sitesi değişiklikleri bu kontrolleri etkileyebilir.

### İçerik etiketi filtreleri

Classifier bağlantısı ve etiket düzeltme; Chrome ve Edge gibi desteklenen Chromium tarayıcılarında ve macOS'taki Safari Vault'ta kullanılabilir.

Etiketleri almak için Mac Vault veya Windows Vault'a bağlanıp Classifier'ı yapılandırın. Engelleme grubunun etiket filtresi kaplanacak veya gizlenecek içeriği seçer. Etiketlemeyi başlatmaz veya duraklatmaz; masaüstü uygulamasındaki Classifier ayarlarını ya da ilgili Classifier grubunun duraklatma kontrolünü kullanın.

Her web sitesi kaydında bir **Uygula** filtresi vardır: tüm içerikler, seçili içerik üreticileri, seçili içerik üreticileri dışındakiler, seçili etiketler veya seçili etiketler dışındaki her şey. Farklı bir filtre gerekiyorsa aynı web sitesi için başka bir kayıt ekleyin.

Belirli etiketleri veya belirli etiketler dışındaki her şeyi seçin. Bir kural etiketleri birleştirebilir (**Gaming + Drama**), güven düzeyi isteyebilir (**Gaming @3**) ya da istisna tanımlayabilir (**!Tutorial**). **İçeriği kapla** etiket düzeltmeyi kullanılabilir tutar. **İçeriği gizle** eşleşen öğeyi kaldırır.

**Güvenilir etiketi olmayan içeriği de engelle**, varsayılan güven eşiğinde etiketsiz tamamlanmış sonuçları, düşük güvenli sonuçlar dâhil, kapsar. Açıkça listelenen kurallar önce denetlenir. **Etiketsiz**, etiketleme bitmiş ve etiket bulunmamış demektir; **Etiketleniyor**, sonucun beklemede olduğunu belirtir. Bekleyen içerik seçeneği, etiketleme bitene kadar öğelerin kaplanmasını ayrı olarak denetler.

### Etiketleri düzeltme

Düzeltme seçicisini açmak için öğenin etiketlerinin yanındaki **+ tag** düğmesine tıklayın. Classifier'daki mevcut etiketleri arayıp eklemek için birini seçin. Seçili etiketin kaldırma kontrolüne tıklayın veya etiketi seçip silmek için Delete tuşuna bir kez basın. Düzeltmeler bağlı masaüstü uygulamasına gönderilir ve gelecekteki etiketlemede kullanılır. Arama kullanılamıyorsa **Etiketsiz** görünür ve otomatik yeniden denenebilir; bu görünüm Classifier'ınızda etiket oluşturmaz.

## Ayarlar ve bağlantı

**Hızlı ekleme + düğmesini göster** desteklenen sayfalara küçük bir düğme ekler. Listeden hedef grubu seçin; Vault yeniden açıldığında seçiminiz hatırlanır. Sayfayı web sitesi listesine eklemek için sayfadaki düğmeyi kullanın. İzin listesinde bu, sayfaya izin verir. Dondurulmuş gruplar hızlı ekleme kabul etmez.

Resmî sözlükler ve kişisel sözlüğü içe/dışa aktarma masaüstü uygulamasında **Ayarlar → Sınıflandırıcı → Resmî sözlükler** bölümünden yapılandırılır. Önbellekte olmayan içerik üreticileri veya isteğe bağlı katkılar sözlük hizmetiyle iletişim kurulmasına yol açabilir; web araştırmasının ayrı izni ve sağlayıcı ayarları vardır. Masaüstü kılavuzuna ve bilgilendirmelere bakın.

Classifier bağlantısı yerel masaüstü Vault hizmetini bildirir. Classifier gruplarını, model indirmelerini, Knowledge'ı, araştırma onayını ve API sağlayıcılarını bağlı masaüstü uygulamasında yapılandırın.

Etiketler yoksa masaüstü Vault uygulamasının açık olduğunu, bağlantının kurulduğunu, etiketlemenin etkin olduğunu, ilgili Classifier grubunun sürdürüldüğünü ve platform akışının kaydedildiğini denetleyin. Masaüstü uygulamasındaki model indirme durumuna bakın. Engelleme uygulanmıyorsa grubun etkinliğini, hedefleri, zamanlamayı, izin verilen süreyi ve erteleme durumunu kontrol edin.
