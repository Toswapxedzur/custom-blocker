# แหล่งที่มาของรายการ Chrome เว็บสโตร์

นี่คือแหล่งที่มาภาษาอังกฤษสำหรับส่วนขยาย Manifest V3 ปัจจุบัน ตรวจสอบกับ `manifest.json` ก่อนที่จะเผยแพร่การสร้างร้านค้าใหม่

## ชื่อนามสกุล

```text
Adamancia Vault
```

## คำอธิบายสั้น ๆ

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## คำอธิบายโดยละเอียด

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## คำอธิบายการอนุญาต

| การอนุญาต | วัตถุประสงค์ปัจจุบัน |
| --- | --- |
| `storage` | บันทึกกลุ่ม การตั้งค่า และสถานะตัวแก้ไขในเครื่อง |
| `alarms` | กำหนดเวลาการตรวจสอบประวัติและการอัปเดตกลุ่มตามเวลา |
| `offscreen` | เรียกใช้รันไทม์กฎที่กำหนดเองที่มีการควบคุมโดยที่ Chromium ต้องใช้เอกสารนอกหน้าจอ |
| `tabs` | อ่านบริบทของแท็บที่ใช้งานอยู่ซึ่งจำเป็นต่อการใช้กลุ่มและแสดงสถานะ |
| `webNavigation` | ประเมินกลุ่มที่เกี่ยวข้องอีกครั้งหลังการนำทาง |
| `favicon` | แสดงไอคอนเว็บไซต์ในตัวแก้ไขหากมี |
| `<all_urls>` | ใช้กฎของเว็บไซต์และแพลตฟอร์มที่ผู้ใช้สร้างขึ้นกับเพจที่ผู้ใช้เลือกควบคุม |

## ปล่อยเช็ค

1. วิ่ง `./tests/run.sh`
2. อัปเดตเวอร์ชันรายการเฉพาะสำหรับการคอมมิตรีลีสเท่านั้น
3. ทบทวนคู่มือภาษาอังกฤษและผลการตรวจสอบการแปล
4. สร้างสิ่งประดิษฐ์การอัปโหลดจากการกระทำที่ได้รับการตรวจสอบแล้ว
5. อย่ารวมบันทึกต้นฉบับ โปรแกรมทดสอบ หรือไฟล์การพัฒนาส่วนตัวในอาร์ติแฟกต์การอัปโหลด
