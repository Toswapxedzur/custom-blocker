# Chrome Web Mağazası giriş kaynağı

Bu, mevcut Manifest V3 uzantısının İngilizce kaynağıdır. Yeni bir mağaza yapısı yayınlamadan önce bunu `manifest.json` ile doğrulayın.

## Uzantı adı

```text
Adamancia Vault
```

## Kısa açıklama

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Ayrıntılı açıklama

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## İzin açıklamaları

| İzin | Mevcut amaç |
| --- | --- |
| `storage` | Grupları, ayarları ve yerel düzenleyici durumunu kaydedin. |
| `alarms` | Geçmiş kontrolleri ve zamana dayalı grup güncellemelerini planlayın. |
| `offscreen` | Chromium'un ekran dışı bir belge gerektirdiği durumlarda kontrollü Özel kural çalışma zamanını çalıştırın. |
| `tabs` | Bir grubu uygulamak ve durumu göstermek için gereken etkin sekme içeriğini okuyun. |
| `webNavigation` | Gezinmeden sonra uygulanabilir grupları yeniden değerlendirin. |
| `favicon` | Mümkün olan yerlerde web sitesi simgelerini düzenleyicide görüntüleyin. |
| `<all_urls>` | Kullanıcı tarafından oluşturulan web sitesi ve platform kurallarını, kullanıcının kontrol etmeyi seçtiği sayfalara uygulayın. |

## Kontrolleri serbest bırak

1. `./tests/run.sh` komutunu çalıştırın.
2. Bildirim sürümünü yalnızca sürüm taahhüdü için güncelleyin.
3. İngilizce kılavuzu ve çeviri denetim çıktısını inceleyin.
4. İncelenen kayıttan yükleme yapıtını oluşturun.
5. Yükleme yapısına kaynak notları, test fikstürleri veya özel geliştirme dosyaları eklemeyin.
