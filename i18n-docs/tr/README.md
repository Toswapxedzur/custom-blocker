# Kasa uzantısı

Vault uzantısı, Chromium tarayıcılarına yönelik bir Manifest V3 odaklama aracıdır. Mevcut düzenleyicisi, web sitesi blok gruplarını, desteklenen platform gruplarını, Özel JavaScript gruplarını, programları, dondurma ve erteleme kontrollerini ve isteğe bağlı web uygulaması köprü bağlantılarını yönetir.

Kaynak kodu ürün sözleşmesidir. [manual/en.md](manual/en.md) adresindeki İngilizce uygulama içi kılavuz, gönderilen kontrolleri açıklar; daha önce kopyalanan ve makineye çevrilen kılavuzların yerine geçer.

## Mevcut yetenekler

- Engellenenler listesi veya izin verilenler listesi davranışı, isteğe bağlı yönlendirme, anında engelleme, zaman tahsisi veya geri sayım içeren varsayılan web sitesi grupları.
- YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord ve Twitter / X için özel gruplar.
- Mevcut platform profilinin desteklediği platforma özel filtreler ve isteğe bağlı gizleme öğesi kontrolleri.
- Sözdizimi kontrolü, şablonlar, çalıştırma kontrolleri, kontrollü çalışma zamanı ve günlük akışı içeren özel JavaScript grupları.
- Grup başına programlar, dondurma modları, erteleme kontrolleri, içe/dışa aktarma ve otomatik kaydetme.
- Desteklenen Özel kural metni, CSV ve JSON işlemleri için isteğe bağlı yerel klasör erişimi.
- Açıkça bağlı gruplar için yerel Vault köprü hub'ına isteğe bağlı bağlantı.

## Yerel olarak çalıştır

1. `chrome://extensions`'yi bir Chromium tarayıcısında açın.
2. **Geliştirici modunu** etkinleştirin.
3. **Paketlenmemiş yükle** seçeneğini seçin ve bu depo klasörünü seçin.
4. Vault uzantısını açın ve bir grup oluşturun.

Manifest, mevcut ekran dışı ve kural API'leri için Chrome 116 veya sonraki bir sürümünü gerektirir.

## Geliştirme kontrolleri

Uzantı test paketini bu klasörden çalıştırın:

```bash
./tests/run.sh
```

Paket, yardımcı davranışı, platform profillerini, Markdown oluşturmayı ve çeviri kataloğu denetimini uygular.

## Yerelleştirilmiş kılavuzlar ve çeviriler

İngilizce belgeler kanonik kaynak olmaya devam ediyor. Uzantı, yerelleştirilmiş kılavuzlarını `manual/en.md` yanında gönderir ve diğer tutulan belgelerin yerelleştirilmiş kopyaları da `i18n-docs/<locale>/` altında yayınlanır.

`translation/*.json` içindeki kullanıcı arayüzü katalogları, desteklenen her yerel ayar için eksiksizdir. Katalogları ve yerelleştirilmiş belgeleri aşağıdakilerle doğrulayın:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Kapsam

Vault uzantısı yalnızca yüklü olduğu tarayıcı profilinde ve tarayıcının kendisine erişim izni verdiği sayfalarda çalışır. Kullanıcı açıkça bir köprüye bağlanmadığı ve eşleşen grupları bağlamadığı sürece yerel uygulamaları yüklemez, sistem izinlerini değiştirmez veya grupları senkronize etmez.
