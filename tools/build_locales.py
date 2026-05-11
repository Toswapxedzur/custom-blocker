"""Generate `_locales/<chrome_locale>/messages.json` for Chrome Web Store
listing localization (extension name + short description).

The full in-app UI translations stay in `translation/<lang>.json` and are
loaded at runtime by `translations.js`. This script only emits the small
subset that `chrome.i18n` needs so the Web Store can show a localized name
and description on the listing page.

Mapping rules:
- App language code is mapped to a Chrome-supported locale (e.g. zh -> zh_CN,
  pt -> pt_BR). Languages Chrome's i18n does not natively support are
  skipped — the in-app picker still shows them.
- `appName` reuses the localized "app.title" already in
  `translation/<lang>.json`.
- `appDescription` is taken from APP_DESCRIPTIONS below (short, <132 chars,
  matches the manifest description tone). English is the source of truth;
  fall back to English when a translation is missing.

Run: `python3 tools/build_locales.py`
"""

from __future__ import annotations

import json
from pathlib import Path

# Chrome locale codes:
# https://developer.chrome.com/docs/extensions/reference/api/i18n#locales
APP_TO_CHROME_LOCALE = {
    "en": "en",
    "zh": "zh_CN",
    "es": "es",
    "hi": "hi",
    "ar": "ar",
    "bn": "bn",
    "pt": "pt_BR",
    "ru": "ru",
    "ja": "ja",
    # "pa": Punjabi — not in Chrome's i18n locale list; skipped.
    "de": "de",
    "fr": "fr",
    "ko": "ko",
    "tr": "tr",
    "vi": "vi",
    "it": "it",
    "th": "th",
    "nl": "nl",
    "pl": "pl",
    "id": "id",
}

# Short, store-ready descriptions per app language. Keep <= 132 characters.
# English is the source of truth; missing locales fall back to English.
APP_DESCRIPTIONS = {
    "en": "Block websites with native blocking, delayed usage limits, or event-driven custom rules. Stay focused on what matters.",
    "zh": "用原生拦截、延时额度或事件驱动的自定义规则屏蔽网站。专注于真正重要的事。",
    "es": "Bloquea sitios web con bloqueo nativo, limites de uso o reglas personalizadas basadas en eventos. Concentrate en lo importante.",
    "hi": "नेटिव ब्लॉकिंग, समय सीमा, या इवेंट-आधारित कस्टम नियमों से वेबसाइटें ब्लॉक करें। जो ज़रूरी है उस पर ध्यान दें।",
    "ar": "احجب المواقع باستخدام الحجب الأصلي أو حدود الاستخدام أو قواعد مخصصة قائمة على الأحداث. ركّز على ما يهم.",
    "bn": "নেটিভ ব্লকিং, সময়সীমা বা ইভেন্ট-ভিত্তিক কাস্টম নিয়ম দিয়ে ওয়েবসাইট ব্লক করুন। যা গুরুত্বপূর্ণ তাতে মনোযোগ দিন।",
    "pt": "Bloqueie sites com bloqueio nativo, limites de uso ou regras personalizadas baseadas em eventos. Mantenha o foco.",
    "ru": "Блокируйте сайты с помощью нативной блокировки, лимитов времени или пользовательских правил на основе событий.",
    "ja": "ネイティブブロック、利用時間制限、イベント駆動のカスタムルールでサイトをブロック。集中力を保ちましょう。",
    "de": "Blockiere Websites mit nativer Sperre, Nutzungslimits oder benutzerdefinierten ereignisbasierten Regeln. Bleib fokussiert.",
    "fr": "Bloquez des sites avec un blocage natif, des limites d'utilisation ou des regles personnalisees basees sur des evenements.",
    "ko": "네이티브 차단, 사용 시간 제한, 이벤트 기반 맞춤 규칙으로 웹사이트를 차단하세요. 중요한 일에 집중하세요.",
    "tr": "Yerel engelleme, kullanım süresi sınırları veya olay tabanlı özel kurallarla siteleri engelleyin. Odakta kalın.",
    "vi": "Chặn trang web bằng chặn gốc, giới hạn thời gian, hoặc quy tắc tùy chỉnh theo sự kiện. Giữ sự tập trung.",
    "it": "Blocca siti con blocco nativo, limiti di utilizzo o regole personalizzate basate su eventi. Resta concentrato.",
    "th": "บล็อกเว็บไซต์ด้วยการบล็อกเนทีฟ, จำกัดเวลาใช้งาน หรือกฎกำหนดเองตามเหตุการณ์ มีสมาธิกับสิ่งที่สำคัญ",
    "nl": "Blokkeer websites met native blokkering, gebruikslimieten of aangepaste gebeurtenisregels. Blijf gefocust.",
    "pl": "Blokuj witryny natywną blokadą, limitami czasu lub regułami opartymi na zdarzeniach. Zachowaj skupienie.",
    "id": "Blokir situs dengan pemblokiran native, batas waktu, atau aturan kustom berbasis event. Tetap fokus.",
}

REPO_ROOT = Path(__file__).resolve().parent.parent
TRANSLATION_DIR = REPO_ROOT / "translation"
LOCALES_DIR = REPO_ROOT / "_locales"


def load_translation(lang: str) -> dict:
    path = TRANSLATION_DIR / f"{lang}.json"
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    en_strings = load_translation("en")
    en_title = en_strings.get("app.title", "Custom Web Blocker")
    en_desc = APP_DESCRIPTIONS["en"]

    LOCALES_DIR.mkdir(exist_ok=True)
    written = []

    for app_lang, chrome_locale in APP_TO_CHROME_LOCALE.items():
        strings = load_translation(app_lang)
        title = strings.get("app.title") or en_title
        description = APP_DESCRIPTIONS.get(app_lang) or en_desc

        # Hard cap at 132 chars (Chrome Web Store description limit).
        if len(description) > 132:
            description = description[:129].rstrip() + "..."

        messages = {
            "appName": {
                "message": title,
                "description": "Extension name shown in Chrome and the Web Store.",
            },
            "appDescription": {
                "message": description,
                "description": "Short description shown on the Chrome Web Store listing.",
            },
        }
        out_dir = LOCALES_DIR / chrome_locale
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / "messages.json"
        with out_file.open("w", encoding="utf-8") as f:
            json.dump(messages, f, ensure_ascii=False, indent=2)
            f.write("\n")
        written.append(chrome_locale)

    print(f"Wrote {len(written)} locale(s): {', '.join(sorted(written))}")


if __name__ == "__main__":
    main()
