# क्रोम वेब स्टोर सूची स्रोत

यह वर्तमान मेनिफेस्ट V3 एक्सटेंशन का अंग्रेजी स्रोत है। नया स्टोर बिल्ड प्रकाशित करने से पहले इसे `manifest.json` के विरुद्ध सत्यापित करें।

## एक्सटेंशन का नाम

```text
Adamancia Vault
```

## संक्षिप्त विवरण

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## विस्तृत विवरण

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## अनुमति स्पष्टीकरण

| अनुमति | वर्तमान उद्देश्य |
| --- | --- |
| `storage` | समूह, सेटिंग्स और स्थानीय संपादक स्थिति सहेजें। |
| `alarms` | पृष्ठभूमि जांच और समय-आधारित समूह अपडेट शेड्यूल करें। |
| `offscreen` | नियंत्रित कस्टम-नियम रनटाइम चलाएँ जहाँ क्रोमियम को एक ऑफस्क्रीन दस्तावेज़ की आवश्यकता होती है। |
| `tabs` | समूह लागू करने और स्थिति दिखाने के लिए आवश्यक सक्रिय टैब संदर्भ पढ़ें। |
| `webNavigation` | नेविगेशन के बाद लागू समूहों का पुनर्मूल्यांकन करें। |
| `favicon` | जहां उपलब्ध हो वहां संपादक में वेबसाइट आइकन प्रदर्शित करें। |
| `<all_urls>` | उपयोगकर्ता द्वारा नियंत्रित किए जाने वाले पृष्ठों पर उपयोगकर्ता-निर्मित वेबसाइट और प्लेटफ़ॉर्म नियम लागू करें। |

## चेक जारी करें

1. `./tests/run.sh` चलाएँ।
2. केवल रिलीज़ कमिट के लिए मेनिफेस्ट संस्करण को अपडेट करें।
3. अंग्रेजी मैनुअल और अनुवाद ऑडिट आउटपुट की समीक्षा करें।
4. समीक्षा की गई कमिट से अपलोड आर्टिफैक्ट बनाएं।
5. अपलोड आर्टिफैक्ट में स्रोत नोट्स, परीक्षण फिक्स्चर, या निजी विकास फ़ाइलें शामिल न करें।
