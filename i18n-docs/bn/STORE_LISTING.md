# Chrome ওয়েব স্টোর তালিকার উৎস

এটি বর্তমান ম্যানিফেস্ট V3 এক্সটেনশনের ইংরেজি উৎস। একটি নতুন স্টোর বিল্ড প্রকাশ করার আগে `manifest.json` এর বিরুদ্ধে এটি যাচাই করুন৷

## এক্সটেনশনের নাম

```text
Adamancia Vault
```

## সংক্ষিপ্ত বিবরণ

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## বিস্তারিত বর্ণনা

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## অনুমতির ব্যাখ্যা

| অনুমতি | বর্তমান উদ্দেশ্য |
| --- | --- |
| `storage` | গোষ্ঠী, সেটিংস এবং স্থানীয় সম্পাদকের অবস্থা সংরক্ষণ করুন। |
| `alarms` | ব্যাকগ্রাউন্ড চেক এবং সময়-ভিত্তিক গ্রুপ আপডেটের সময়সূচী করুন। |
| `offscreen` | নিয়ন্ত্রিত কাস্টম-রুল রানটাইম চালান যেখানে Chromium-এর একটি অফস্ক্রিন নথির প্রয়োজন হয়৷ |
| `tabs` | একটি গ্রুপ প্রয়োগ করতে এবং স্থিতি দেখানোর জন্য প্রয়োজনীয় সক্রিয় ট্যাব প্রসঙ্গ পড়ুন। |
| `webNavigation` | নেভিগেশন পরে প্রযোজ্য গ্রুপ পুনঃমূল্যায়ন. |
| `favicon` | যেখানে পাওয়া যায় সেখানে সম্পাদকে ওয়েবসাইট আইকন প্রদর্শন করুন। |
| `<all_urls>` | ব্যবহারকারীর দ্বারা তৈরি ওয়েবসাইট এবং প্ল্যাটফর্মের নিয়মগুলি ব্যবহারকারীরা নিয়ন্ত্রণ করতে বেছে নেওয়া পৃষ্ঠাগুলিতে প্রয়োগ করুন৷ |

## রিলিজ চেক

1. `./tests/run.sh` চালান।
2. শুধুমাত্র প্রকাশের প্রতিশ্রুতির জন্য ম্যানিফেস্ট সংস্করণ আপডেট করুন৷
3. ইংরেজি ম্যানুয়াল এবং অনুবাদ অডিট আউটপুট পর্যালোচনা করুন।
4. পর্যালোচনা করা কমিট থেকে আপলোড আর্টিফ্যাক্ট তৈরি করুন।
5. আপলোড আর্টিফ্যাক্টে সোর্স নোট, টেস্ট ফিক্সচার বা ব্যক্তিগত উন্নয়ন ফাইল অন্তর্ভুক্ত করবেন না।
