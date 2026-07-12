# مصدر قائمة سوق Chrome الإلكتروني

هذا هو المصدر الإنجليزي لامتداد Manifest V3 الحالي. تحقق من ذلك مقابل `manifest.json` قبل نشر إنشاء متجر جديد.

## اسم الامتداد

```text
Adamancia Vault
```

## وصف مختصر

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## وصف تفصيلي

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## تفسيرات الإذن

| إذن | الغرض الحالي |
| --- | --- |
| `storage` | حفظ المجموعات والإعدادات وحالة المحرر المحلي. |
| `alarms` | جدولة عمليات التحقق من الخلفية وتحديثات المجموعة المستندة إلى الوقت. |
| `offscreen` | قم بتشغيل وقت تشغيل القاعدة المخصصة الذي يتم التحكم فيه حيث يتطلب Chromium مستندًا خارج الشاشة. |
| `tabs` | اقرأ سياق علامة التبويب النشطة اللازمة لتطبيق مجموعة وإظهار الحالة. |
| `webNavigation` | إعادة تقييم المجموعات المعمول بها بعد التنقل. |
| `favicon` | عرض أيقونات موقع الويب في المحرر حيثما كان ذلك متاحًا. |
| `<all_urls>` | تطبيق قواعد موقع الويب والمنصة التي أنشأها المستخدم على الصفحات التي يختار المستخدم التحكم فيها. |

## تحرير الشيكات

1. قم بتشغيل `./tests/run.sh`.
2. قم بتحديث إصدار البيان فقط لالتزام الإصدار.
3. قم بمراجعة دليل اللغة الإنجليزية ومخرجات تدقيق الترجمة.
4. أنشئ عنصر التحميل من الالتزام الذي تمت مراجعته.
5. لا تقم بتضمين ملاحظات المصدر أو تركيبات الاختبار أو ملفات التطوير الخاصة في عنصر التحميل.
