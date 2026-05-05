# Custom Web Blocker — คู่มือการใช้งาน

นี่คือคู่มืออ้างอิงฉบับเต็มของส่วนขยาย โดยเริ่มจากเวิร์กโฟลว์ที่ง่ายและใช้บ่อยที่สุด แล้วค่อยๆ ไปสู่หัวข้อขั้นสูง เช่น กฎบล็อก JavaScript แบบกำหนดเอง และ helper API

หากคุณเพิ่งเริ่มใช้งาน ให้อ่านแค่ **เริ่มต้นอย่างรวดเร็ว** และ **ภาพรวมกลุ่มบล็อก** ก่อน ส่วนที่อยู่ถัดลงมาทั้งหมดเป็นตัวเลือกเพิ่มเติมตามสิ่งที่คุณต้องการทำ

---

## 1. ส่วนขยายนี้ทำอะไรได้บ้าง

Custom Web Blocker ช่วยให้คุณบล็อกเว็บไซต์และสิ่งรบกวนออนไลน์ตามกฎที่คุณกำหนดเองได้ คุณสามารถ:

- บล็อกเว็บไซต์ทันทีด้วยระบบบล็อกเครือข่ายแบบ native ของเบราว์เซอร์ (เป็นการบล็อกแบบเดียวกับที่แสดง `ERR_BLOCKED_BY_CLIENT`)
- อนุญาตให้ตัวเองใช้เวลาในเว็บไซต์หนึ่งได้ตามจำนวนนาทีต่อวัน แล้วบล็อกเมื่อเกินเวลานั้น
- บล็อกเฉพาะประเภทคอนเทนต์บน YouTube, TikTok, Facebook, Instagram, Twitch และ Reddit (ไม่ต้องบล็อกทั้งเว็บไซต์)
- ซ่อนคอนเทนต์ที่ถูกบล็อกจากฟีดบนแพลตฟอร์มที่รองรับ แทนการบล็อกแค่หน้าเดี่ยวๆ
- ตั้งเวลาว่ากฎจะทำงานเมื่อไร โดยกำหนดวันในสัปดาห์และช่วงเวลา `HHMM-HHMM`
- แช่แข็งกฎเพื่อไม่ให้แก้ไขได้ง่ายๆ โดยแบบ strict freeze จะล็อกตามจำนวนชั่วโมงที่กำหนด และต้องผ่านพิธียืนยัน 20 ขั้นตอนเพื่อปลดล็อก
- พักกฎชั่วคราว (snooze) ได้ แต่ต้องเขียนเหตุผลให้ยาวพอตามเงื่อนไข
- เขียนกฎบล็อก JavaScript แบบกำหนดเอง พร้อม helper สำหรับตัวจับเวลา, ที่เก็บถาวร, การตรวจจับแพลตฟอร์ม, การจับคู่โดเมน และการ log
- ใช้งานส่วนขยายได้มากกว่า 20 ภาษา

ส่วนขยายนี้เป็น Chrome Manifest V3 โดยมีหน้า editor หนึ่งหน้า (popup), background service worker หนึ่งตัว และ content script หนึ่งตัวที่ทำงานในทุกหน้าเว็บ

---

## 2. ทัวร์หน้าจอ

เมื่อคุณคลิกไอคอนส่วนขยาย หน้า editor จะเปิดเป็นหน้าเว็บเต็ม (ไม่ใช่ popup เล็กๆ) โดยมีส่วนต่างๆ ดังนี้:

- **แถบบน**
  - ปุ่ม **Instruction Manual** (เอกสารนี้)
  - ตัวเลือก **Language**
- **แผงซ้าย — Block Groups**
  - รายการกลุ่มบล็อกของคุณ แต่ละการ์ดแสดงชื่อกลุ่ม บรรทัดสรุปสั้นๆ และช่องทำเครื่องหมายเปิด/ปิด
  - ปุ่ม **Add** ใช้สร้างกลุ่มใหม่ เมนูข้างๆ ใช้เลือกประเภท
  - **Delete All** ลบทุกกลุ่ม พร้อมการยืนยันเพิ่มเติมหากมีกลุ่มใดถูก freeze
  - คุณสามารถลากที่จับ `::` บนการ์ดขึ้นหรือลงเพื่อจัดลำดับกลุ่มใหม่
  - คุณสามารถลากเส้นแบ่งแนวตั้งเพื่อปรับขนาดแผงนี้
- **แผงขวา — Editor**
  - แก้ไขกลุ่มที่เลือกอยู่: ชื่อ, พฤติกรรมการบล็อก, blocklist, ตัวกรองเฉพาะประเภท, ตารางเวลา, freeze, snooze
  - การเปลี่ยนแปลงทั้งหมดจะบันทึกอัตโนมัติหลังจากคุณหยุดพิมพ์หรือหยุดโต้ตอบเพียงเสี้ยววินาที
- **Toast** (ป๊อปอัปกึ่งกลางหน้าจอที่ค่อยๆ จาง)
  - แสดงข้อความสถานะ เช่น "Saved changes" หรือข้อผิดพลาดของข้อมูลนำเข้า

ขณะหน้าเว็บกำลังถูกบล็อกหรือมีตัวจับเวลาทำงาน จะมี overlay ปรากฏที่มุมซ้ายบน แสดงข้อจำกัดด้านเวลาทั้งหมดที่กำลังมีผลในรูปแบบ `hh:mm:ss` (หรือ `mm:ss`) และถ้ามีหลายข้อจำกัดก็จะแสดงซ้อนกันหลายบรรทัด

---

## 3. เริ่มต้นอย่างรวดเร็ว

1. คลิกไอคอนส่วนขยาย หน้า editor จะเปิดเป็นหน้าเต็ม
2. ในแผง **Block Groups** ให้เลือกประเภทกลุ่มจากเมนู:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` หรือ `Custom`
3. คลิก **Add** จะมีกลุ่มใหม่ปรากฏและ editor จะเปิดกลุ่มนั้น
4. ตั้งชื่อกลุ่ม
5. กรอกฟิลด์ตามประเภท (สำหรับ `Default` คือรายการ **Blocked websites**)
6. ตรวจสอบว่าช่องทำเครื่องหมายของกลุ่มในแผงซ้ายเปิดอยู่
7. เข้าเว็บไซต์ที่อยู่ในรายการ การบล็อกควรมีผลทันที

นี่คือเส้นทางใช้งานหลักทั้งหมด ส่วนที่เหลือในคู่มือนี้คือทางเลือกเพิ่มเติมบนพื้นฐานนี้

---

## 4. ภาพรวมกลุ่มบล็อก

ทุกอย่างในส่วนขยายนี้ถูกจัดเป็น **กลุ่มบล็อก** โดยกลุ่มบล็อกคือชุดกฎหนึ่งชุด:

- มีชื่อ ประเภท และสถานะเปิด/ปิด
- มีพฤติกรรมการบล็อก (บล็อกทันที หรือบล็อกหลังผ่านไปตามจำนวนนาที)
- มีตารางเวลาแบบเลือกได้ (วัน + ช่วงเวลา) และมีตัวควบคุม freeze/snooze แบบเลือกได้
- ขึ้นอยู่กับประเภท อาจมีฟิลด์เพิ่มเติม เช่น รายชื่อเว็บไซต์, ตัวกรองผู้สร้าง YouTube, ชื่อ subreddit หรือฟังก์ชัน JavaScript

คุณสามารถมีกลุ่มได้ไม่จำกัด และอาจมีกลุ่มหลายกลุ่มใช้กับหน้าเดียวกันได้ ในกรณีนั้นกฎที่ **เข้มงวดที่สุด** จะชนะ:

- "บล็อกทันที" ชนะ "บล็อกหลังใช้เวลาไปแล้ว"
- กลุ่มที่เหลือเวลาน้อยกว่าจะชนะกลุ่มที่เหลือเวลามากกว่า

ดังนั้นการเพิ่มกลุ่มเพิ่มจะทำให้หน้าโดนบล็อกเร็วขึ้นได้เท่านั้น ไม่มีทางทำให้ช้าลง

คุณสามารถลากกลุ่มผ่านที่จับ `::` เพื่อเรียงลำดับใหม่ได้ ลำดับไม่กระทบว่ากฎไหนเข้มงวดที่สุด แต่มีผลต่อการแสดงรายการจากบนลงล่าง

---

## 5. ประเภทของกลุ่ม

### 5.1 `Default` — บล็อกเว็บไซต์ทั่วไป

ใช้สำหรับบล็อกโดเมนเฉพาะ (กรณีใช้งานทั่วไปที่สุด)

- **Blocked websites**: หนึ่งเว็บไซต์ต่อหนึ่งบรรทัด ทั้ง `facebook.com` และ `https://www.facebook.com/somepage` ใช้ได้ โดยส่วนขยายจะดึงและ normalize hostname ให้
- กฎเว็บไซต์จะมีผลกับ hostname นั้นและ subdomain ทั้งหมด
- กลุ่มประเภทนี้ใช้ระบบบล็อกเครือข่าย native ของ Chrome คล้าย `ERR_BLOCKED_BY_CLIENT` หมายความว่าการไปยัง URL ที่ถูกบล็อกจะถูกหยุดก่อนหน้าเว็บโหลด

### 5.2 `YouTube` — บล็อก YouTube และเว็บวิดีโอที่คล้ายกัน

เพิ่มส่วน **Filters** ใน editor:

- **Content type**:
  - `Apply to all YouTube pages` — นับทุกหน้า YouTube
  - `Apply to Shorts` — นับเฉพาะหน้า Shorts
  - `Apply to long videos` — เฉพาะ `/watch`, `/live/`, `/embed/` ฯลฯ
  - `Apply to YouTube posts` — โพสต์ชุมชน (`/post/...`, แท็บ community/posts ของช่อง)
- **Author filter**:
  - `Do not filter by author` — ไม่สนตัวตนผู้สร้าง
  - `Apply to certain authors` — เฉพาะผู้สร้างที่อยู่ในรายการเท่านั้นที่กระตุ้นกฎกลุ่มนี้
  - `Apply to all except certain authors` — ผู้สร้างที่อยู่ในรายการจะได้รับการยกเว้น
- **Authors**: หนึ่งผู้สร้างต่อหนึ่งบรรทัด รองรับ `@handle`, URL เต็ม, `/channel/UC...`, `/c/...`, `/user/...`
- **Hide blocked entries in the YouTube feed**: ขณะกลุ่มนี้กำลังบล็อก การ์ดที่ตรงเงื่อนไขในฟีด YouTube จะถูกซ่อน เมื่อกฎหยุดทำงานแล้วจะกลับมาในการรีเฟรชครั้งถัดไป

สำหรับ content type แบบ Shorts และ Posts เมื่อไม่ตั้ง author filter และกลุ่มกำลังบล็อกอยู่ ส่วนขยายจะซ่อนรายการนำทางที่เกี่ยวข้องด้วย (รายการ Shorts ใน sidebar, แท็บ Community/Posts ของช่อง) รวมถึง shelf ที่ตรงเงื่อนไขอย่าง "Latest YouTube posts"

การแยก short กับ long ยังครอบคลุมเว็บวิดีโออื่น เช่น TikTok, Vimeo, Twitch clips/VODs และ Dailymotion เมื่อสามารถตรวจจับรูปแบบหน้าได้

### 5.3 `TikTok` — บล็อกคอนเทนต์ TikTok

ใช้การ์ด editor แบบเดียวกับ platform-video editor แต่ใช้ป้ายกำกับเฉพาะ TikTok:

- ประเภทคอนเทนต์: short videos, videos, profile pages
- ผู้สร้าง: handle ของ TikTok (`@handle`) หรือ URL โปรไฟล์
- การซ่อนฟีดจะซ่อนการ์ดที่ตรงเงื่อนไขบนหน้า TikTok ขณะที่กลุ่มทำงาน

### 5.4 `Facebook` — บล็อกคอนเทนต์ Facebook

- ประเภทคอนเทนต์: Reels, videos, posts
- ผู้สร้าง: ชื่อเพจ (`page.name`), URL โปรไฟล์ หรือรูปแบบ `profile.php?id=...` (เลขไอดีจะถูกเก็บเป็น `id:<number>`)
- การซ่อนฟีดจะซ่อนการ์ดฟีดที่ตรงเงื่อนไขบน Facebook

### 5.5 `Instagram` — บล็อกคอนเทนต์ Instagram

- ประเภทคอนเทนต์: Reels, videos, posts
- ผู้สร้าง: handle ของ Instagram หรือ URL โปรไฟล์
- เส้นทางที่สงวนไว้ เช่น `/reel/`, `/p/`, `/tv/`, `/explore/` จะไม่ถูกตีความว่าเป็นผู้สร้าง
- การซ่อนฟีดจะซ่อนการ์ดที่ตรงเงื่อนไขบน Instagram

### 5.6 `Twitch` — บล็อกคอนเทนต์ Twitch

- ประเภทคอนเทนต์: clips, streams/VODs, channel pages
- ผู้สร้าง: ชื่อช่องหรือ URL ช่อง
- เส้นทางสงวน เช่น `/directory`, `/videos`, `/settings` ฯลฯ จะไม่ถูกตีความว่าเป็นชื่อช่อง
- การซ่อนฟีดจะซ่อนการ์ดที่ตรงเงื่อนไขบน Twitch

### 5.7 `Reddit` — บล็อก Reddit หรือเฉพาะ subreddit

- **Subreddits**: หนึ่ง subreddit ต่อหนึ่งบรรทัด หากเว้นว่าง หมายถึงใช้กับ Reddit ทั้งหมด รองรับทั้ง `productivity` และ `r/productivity`

### 5.8 `Custom` — บล็อกด้วยฟังก์ชัน JavaScript

คุณเขียนฟังก์ชัน JavaScript หนึ่งตัว ส่วนขยายจะเรียกทุกประมาณหนึ่งวินาที และใช้ค่าที่ส่งกลับเป็น blocklist ปัจจุบัน

กลุ่ม `Custom` จะไม่แสดง: พฤติกรรมการบล็อก, blocked sites, allowed minutes, reset interval, schedule days หรือ time windows โดยจะมีเพียงช่องใหญ่หนึ่งช่องคือฟังก์ชัน **Blocking Rules** พร้อมตัวควบคุม freeze/snooze มาตรฐาน

ดู **หัวข้อ 11** สำหรับเอกสารอ้างอิงเต็มของ custom rules และ helpers API

---

## 6. พฤติกรรมการบล็อก

สำหรับกลุ่มส่วนใหญ่ คุณเลือกได้ 2 โหมด:

### 6.1 บล็อกทันที

กฎจะทำงานเมื่อกลุ่มเปิดอยู่ ตารางเวลาอนุญาต และ (สำหรับกลุ่มแพลตฟอร์ม) หน้าเว็บตรงเงื่อนไข

สำหรับกลุ่ม `Default` จะใช้การบล็อกแบบ native ของ Chrome ส่วนกลุ่มแพลตฟอร์มจะใช้ logic overlay/ออกจากหน้าในตัวหน้าเว็บ

### 6.2 บล็อกหลังผ่านไปตามจำนวนนาที

นี่คือระบบโควตาเวลาใช้งาน

- **Allowed minutes before block** (ทศนิยม): จำนวนเวลาต่อนาทีที่คุณอนุญาตตัวเองในแต่ละช่วง เช่น `15`, `0.5`, `90`
- **Timer reset interval (hours)** (ทศนิยม): ความถี่ที่โควตาจะรีเซ็ต เช่น `24` สำหรับรายวัน, `1` สำหรับรายชั่วโมง, `0.25` สำหรับทุก 15 นาที

ขณะยังเหลือเวลา หน้าเว็บจะทำงานปกติและแสดง timer overlay เมื่อโควตาเหลือศูนย์ หน้าเว็บจะถูกบล็อกตลอดช่วงเวลาที่เหลือ และ overlay จะแสดง `0:00` จากนั้นแท็บจะพยายามออกจากหน้านั้น

ระบบทำงานแยกตามกลุ่มและตามช่วงเวลา:

- แต่ละกลุ่มมีโควตาของตัวเอง
- เวลาที่ใช้บนหน้าใดก็ตามที่ตรงเงื่อนไขกลุ่ม จะถูกนับเข้ากลุ่มนั้น
- หลายแท็บในกลุ่มเดียวกันจะแชร์โควตาเดียวกัน ตัวจับเวลาจะซิงก์กัน และการสลับไปแท็บอื่นจะบังคับรีเฟรชเพื่อแสดงเวลาแชร์ล่าสุดทันที

หากมีหลายกลุ่มแบบจำกัดเวลาที่ใช้กับหน้าเดียวกัน กฎที่เข้มงวดที่สุดจะชนะ

---

## 7. ตารางเวลา

ในการ์ด **Schedule** คุณสามารถจำกัดเวลาที่กลุ่มจะทำงานได้:

- **Days to block**: เลือกวันที่กลุ่มจะมีผล วันที่ไม่เลือกหมายถึงกลุ่มไม่ทำงานในวันนั้น
- **Time windows**: รายการอิสระ หนึ่งช่วงต่อหนึ่งบรรทัด ในรูปแบบ `HHMM-HHMM` เช่น:

  ```
  0900-1000
  1200-1300
  ```

  กลุ่มจะทำงานเฉพาะในช่วงเวลานี้เท่านั้น หากเว้นว่างหมายถึงทั้งวัน

ใช้ได้กับทุกประเภทกลุ่ม ยกเว้น `Custom`

---

## 8. Freeze (ป้องกันการแก้แบบฉับพลัน)

การ freeze ทำให้ปิดกลุ่มด้วยอารมณ์ชั่ววูบได้ยากขึ้น

ในการ์ด **Freeze** คุณเลือกได้ว่า:

- **Frozen** — คุณจะไม่สามารถแก้ไขหรือลบกลุ่ม และไม่สามารถเอาเครื่องหมายเปิดใช้งานออกได้ หากต้องการเปลี่ยนอะไรต้องทำพิธีปลด freeze (ดูด้านล่าง)
- **Strict frozen** — เหมือน Frozen แต่จะล็อกตามจำนวนชั่วโมงที่คุณกำหนด (ทศนิยม สูงสุด 72) จนกว่าจะครบเวลานี้ แม้แต่พิธีปลด freeze ก็ยังใช้ไม่ได้

เมื่อกลุ่มที่ frozen สามารถปลดล็อกได้ ปุ่ม **Unfreeze** จะปรากฏ เมื่อคลิกจะเริ่ม **พิธี 20 ขั้นตอน**:

- โมดัลจะแสดงข้อความเตือนวินัยตนเอง
- คุณต้องคลิก `Confirm` 20 ครั้ง
- มีเวลารอ 5 วินาทีระหว่างการคลิกแต่ละครั้ง
- หากยกเลิกเมื่อใดก็ตาม ต้องเริ่มใหม่จากขั้นตอนที่ 1
- ข้อความ 20 ข้อจะวนสลับกันเพื่อให้คุณอ่านจริง

ถ้ากลุ่มถูกทำเครื่องหมายว่า "no snooze" ด้วย (ดูหัวข้อถัดไป) คุณจะ snooze กลุ่มนี้ไม่ได้ขณะ frozen

สถานะ freeze จะแสดงในบรรทัด meta ของการ์ดกลุ่ม รวมถึงเวลาที่เหลือสำหรับ strict freeze

---

## 9. Snooze (ปิดชั่วคราว)

Snooze จะปิดกลุ่มชั่วคราวโดยไม่ต้องปลด freeze แต่ต้องมีเหตุผลเป็นลายลักษณ์อักษร

ในการ์ด **Snooze**:

- **Allow snooze for this group** — ถ้าปิด กลุ่มนี้จะ snooze ไม่ได้เลย (รวมถึงตอน frozen)
- **Snooze for (minutes)** — ทศนิยม ระยะเวลาที่ snooze
- **Reason** — ต้องมี **อย่างน้อย 100 ตัวอักษร และมากกว่า 20 คำ** ปุ่ม Start จะยังไม่เปิดจนกว่าจะครบทั้งสองเงื่อนไข หากไม่ผ่านกฎ จะมีคำเตือนแบบ inline ข้างปุ่ม

หากกลุ่ม frozen อยู่ ค่านาที snooze จะถูกล็อกตามค่าที่เลือกไว้ก่อน freeze คุณยัง snooze ได้ตราบใดที่อนุญาตให้ snooze และเหตุผลผ่านเงื่อนไข

จะมีข้อความสถานะยืนยันการ snooze เมื่อหมดเวลา snooze กลุ่มจะกลับสู่สถานะปกติโดยอัตโนมัติ

คุณสามารถจบ snooze ก่อนเวลาได้ด้วยปุ่ม **End Snooze**

---

## 10. การทำงานแบบกลุ่มใหญ่

- **Delete All** ลบทุกกลุ่ม
  - ต้องยืนยันเสมอ
  - หากมีอย่างน้อยหนึ่งกลุ่มที่ frozen จะต้องผ่านพิธี 20 ขั้นตอนเหมือนการ unfreeze
  - หากมีกลุ่มใด strict-frozen และยังล็อกอยู่ **Delete All** จะถูกปิดใช้งาน

---

## 11. กลุ่ม Custom (เอกสารอ้างอิงเต็ม)

กลุ่ม `Custom` จะรันฟังก์ชัน JavaScript ใน background service worker โดยฟังก์ชันจะถูกเรียกทุกประมาณหนึ่งวินาที และส่วนขยายจะใช้ค่าที่ส่งกลับเพื่อตัดสินใจว่าโดเมนใดควรถูกบล็อก ณ ขณะนั้น

### 11.1 ลายเซ็นฟังก์ชัน

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

พารามิเตอร์:

- `month` — `1` ถึง `12`
- `dayOfMonth` — `1` ถึง `31`
- `dayName` — เช่น `"Monday"`
- `hour` — `0` ถึง `23`
- `minute` — `0` ถึง `59`
- `blockedDomains` — รายการโดเมนที่กฎอื่นได้สร้างไว้แล้ว คุณสามารถเพิ่ม แทนที่ หรือไม่ใช้ก็ได้
- `helpers` — ชุดวัตถุ helper (ดูด้านล่าง)

ค่าที่คืนกลับ:

- อาร์เรย์ของสตริงโดเมนที่ควรถูกบล็อกตอนนี้ หรือ
- ไม่คืนค่าอะไรเลย (กรณีนี้ส่วนขยายจะใช้ค่าที่คุณ mutate ใน `blockedDomains`)

ฟังก์ชันจะถูกตรวจสอบตอนบันทึก หากมี syntax error จะขึ้นคำเตือนสถานะ และกฎจะไม่ถูกใช้งานจนกว่าคุณจะแก้ไข หากฟังก์ชัน throw ตอน runtime ส่วนขยายจะจับข้อผิดพลาด log ไปยัง background console และ fallback ไปยังผลลัพธ์ก่อนหน้า

### 11.2 การกำหนดรอบทำงานแบบปรับตัว

โดยปกติ custom rules จะรันทุกประมาณหนึ่งวินาที หากกฎของคุณใช้เวลานานเกินไป ส่วนขยายจะชะลอลูปให้อัตโนมัติ (สูงสุดประมาณทุก 5 วินาที) คุณไม่ต้องจัดการเอง

### 11.3 ออบเจ็กต์ `helpers`

ภายในฟังก์ชัน `helpers` จะมี sub-helper หลายตัว แต่ละตัวมีทั้งชื่อเต็มและชื่อย่อ และยังมี getter method แบบชัดเจน:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — epoch time ปัจจุบันในหน่วยมิลลิวินาที

เมธอด helper ทั้งหมดถูกออกแบบให้ปลอดภัย: พารามิเตอร์ที่ไม่ถูกต้องจะคืน `null`, `false` หรือค่าว่าง แทนการ throw

#### 11.3.1 `timerHelper`

จัดการตัวนับถอยหลังที่ผูกกับโดเมน ตัวจับเวลาจะคงอยู่ข้ามการรีสตาร์ตเบราว์เซอร์ และแต่ละตัวจับเวลาจะเป็นของกลุ่ม custom ที่สร้างมัน

- `createTimer(domain, durationMs, displayName?)` — สร้างและคืน timer id ที่ไม่ซ้ำ หรือคืน `null` ถ้าไม่ถูกต้อง ตัวอย่าง: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")` ขณะผู้ใช้อยู่บนหน้าที่ตรงโดเมนนั้น overlay ในหน้าจะแสดง `Timer1: 30:00` และนับถอยหลัง
- `deleteTimer(id)` — ลบตัวจับเวลา คืน `true` หากสำเร็จ
- `pauseTimer(id)` — หยุดนับถอยหลังชั่วคราว
- `continueTimer(id)` / `resumeTimer(id)` — เริ่มนับต่อจากที่ pause
- `resetTimer(id, durationMs?)` — รีเซ็ตตัวจับเวลา หากไม่ส่ง `durationMs` จะใช้ค่าเดิม
- `addMs(id, ms)` — เพิ่มมิลลิวินาที (หรือลดได้ด้วยค่าติดลบ)
- `remainingMs(id)` — เวลาที่เหลือเป็นมิลลิวินาที
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — คืนค่า boolean
- `getDomain(id)` / `getDisplayName(id)` — อ่านข้อมูลตัวจับเวลา
- `findByDomain(domain)` — อาร์เรย์ timer id ของโดเมนนั้น
- `list()` — อาร์เรย์ของ `{ id, domain, displayName, durationMs, remainingMs, isPaused }` สำหรับทุกตัวจับเวลาที่กลุ่มนี้เป็นเจ้าของ

ระยะเวลาสูงสุดของตัวจับเวลาคือประมาณ 30 วัน

#### 11.3.2 `persistenceHelper`

พื้นที่เก็บแบบ map ที่ผูกกับกลุ่มของคุณ ค่าในนั้นต้อง serialize เป็น JSON ได้ เหมาะสำหรับจำสถานะข้ามการเรียกใช้

- `set(key, value)` — เก็บค่า JSON ใดก็ได้ คืน `true` เมื่อสำเร็จ
- `get(key, defaultValue?)` — คืนค่าที่เก็บไว้ หรือ `defaultValue` หากไม่พบ
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`

ข้อจำกัดแบบ soft limit: ประมาณ 200 key ต่อกลุ่ม, 16 KB ต่อค่า

#### 11.3.3 `domainHelper`

- `normalize(value)` — คืนโดเมน canonical เช่น `youtube.com` หรือ `null`
- `matches(hostname, site)` — คืน `true` ถ้า `hostname` เป็นของ `site` (รองรับ subdomain)

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — เขียนลง background console

หากต้องการดูข้อความเหล่านี้: `chrome://extensions` → เปิด Developer Mode → คลิกลิงก์ "service worker" ของส่วนขยาย

#### 11.3.5 `platformHelper`

ตรวจสอบแพลตฟอร์มโซเชียล/วิดีโอที่รองรับ

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`
- `normalizePlatform(value)` — คืนชื่อแพลตฟอร์มมาตรฐาน หรือ `null`
- `normalizeAuthor(author, platform)` — normalize ตัวระบุผู้สร้าง (handle, URL ฯลฯ) สำหรับแพลตฟอร์มนั้น หรือ `null`
- `detect(urlOrHost)` / `getContext(urlOrHost)` — คืน `{ platform, hostname, pathname, type, authors, url }` หรือ `null`
  - `type` คือ `"short" | "long" | "post" | "unknown"`
  - `authors` คือรายการผู้สร้างที่ normalize แล้วซึ่งตรวจพบจาก URL นั้น
- `getType(urlOrHost)` — ช็อตคัตของ `detect(...).type`
- `getPlatform(urlOrHost)` — ช็อตคัตของ `detect(...).platform`
- `getAuthors(urlOrHost)` — ช็อตคัตของ `detect(...).authors`
- `matchesAuthor(urlOrHost, platform, authors)` — คืน `true` หาก URL อยู่บนแพลตฟอร์มนั้นและตรงกับผู้สร้างอย่างน้อยหนึ่งรายในรายการที่ให้มา

### 11.4 ตัวอย่าง

ง่าย: บล็อกโซเชียลมีเดียในช่วงเช้าวันทำงาน

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

ระดับกลาง: ใช้ YouTube ได้ 30 นาทีต่อหนึ่ง browser session พร้อมตัวนับถอยหลังที่มองเห็นได้

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper } = helpers;
  let id = persistenceHelper.get("youtubeTimer");

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer("youtube.com", 30 * 60 * 1000, "YouTube");
    persistenceHelper.set("youtubeTimer", id);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, "youtube.com"];
  }

  return blockedDomains;
}
```

ยากขึ้น: บล็อกเซสชัน TikTok เฉพาะเมื่อเป็น short videos และผู้สร้างอยู่ในรายชื่อ distractor ของคุณ ใช้ `platformHelper`

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { platformHelper, logHelper } = helpers;
  const distractors = ["someuser", "anotheruser"];
  const url = "https://www.tiktok.com" + (globalThis.location?.pathname ?? "");
  const ctx = platformHelper.detect(url);

  if (ctx?.platform === "tiktok" && ctx.type === "short") {
    if (platformHelper.matchesAuthor(url, "tiktok", distractors)) {
      logHelper.log("Blocking TikTok short by", ctx.authors);
      return [...blockedDomains, "tiktok.com"];
    }
  }

  return blockedDomains;
}
```

(`globalThis.location` เป็นเพียง placeholder ตัวอย่าง — โดยปกติคุณจะขับเคลื่อน `platformHelper` จาก logic ของคุณเอง ไม่ใช่จาก location ของ worker เพราะ background worker ไม่มี URL ของหน้าเว็บจริง)

ยากที่สุด: หมุนเวียน "site of the day" พร้อมเพดานรายวัน และเก็บสถานะข้ามการรีสตาร์ต

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper, domainHelper, logHelper } = helpers;
  const sites = ["reddit.com", "twitter.com", "news.ycombinator.com"];
  const today = `${month}-${dayOfMonth}`;
  const lastDay = persistenceHelper.get("lastDay");

  if (today !== lastDay) {
    for (const id of timerHelper.list().map((t) => t.id)) {
      timerHelper.deleteTimer(id);
    }
    persistenceHelper.set("lastDay", today);
  }

  const site = sites[(month + dayOfMonth) % sites.length];
  let id = persistenceHelper.get(`timer:${site}`);

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer(site, 20 * 60 * 1000, `${site} budget`);
    persistenceHelper.set(`timer:${site}`, id);
    logHelper.log("Started budget for", site);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, domainHelper.normalize(site)];
  }

  return blockedDomains;
}
```

---

## 12. พฤติกรรมหลายหน้า

- ทุกแท็บที่เปิดอยู่ในกลุ่มเดียวกันแชร์ตัวจับเวลาเดียวกัน
- เมื่อคุณสลับไปแท็บในกลุ่มเดียวกัน overlay จะรีเฟรชทันทีเพื่อแสดงเวลาแชร์ล่าสุด
- เมื่อเพิ่มกฎใหม่ ทุกหน้าที่เปิดอยู่จะตรวจพบการเปลี่ยนแปลงและรีเฟรชภายในเสี้ยววินาที โดยไม่ต้องรีโหลดแท็บเอง
- เมื่อกฎหมดอายุ การ์ดฟีดและปุ่มนำทางที่ถูกซ่อนไว้จะกลับมาในการรีเฟรชครั้งถัดไป

---

## 13. การแปลหลายภาษา

UI ทั้งหมดได้รับการแปลอย่างครบถ้วน ใช้ตัวเลือก **Language** ที่มุมขวาบน

ภาษาที่รองรับรวมถึง English, Chinese (Simplified), Spanish, Japanese, Korean และยังมีการรองรับบางส่วนสำหรับ Hindi, Arabic, Bengali, Portuguese, Russian, Punjabi, German, French, Turkish, Vietnamese, Italian, Thai, Dutch, Polish, Indonesian, Urdu และ Persian โดยภาษาที่รองรับบางส่วนจะ fallback ไปภาษาอังกฤษสำหรับข้อความที่ยังขาด

คู่มือการใช้งานเองจะโหลดไฟล์ markdown ที่ตรงกับภาษาที่เลือก โดยมีภาษาอังกฤษเป็น fallback

---

## 14. ข้อความสถานะ

ข้อความสถานะจะแสดงเป็น toast ตรงกลางหน้าจอ และจางหายไปภายในประมาณสองวินาที:

- "Saved changes."
- "Created \"Group name\"."
- ข้อผิดพลาดตรวจสอบค่า เช่น "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

สำหรับช่องที่มีข้อกำหนดรูปแบบ ข้อความจะปรากฏข้างปุ่มที่เกี่ยวข้องด้วย (สำหรับ snooze)

---

## 15. ความเป็นส่วนตัวและการจัดเก็บ

- ทุกอย่างเก็บไว้ในเครื่องที่ `chrome.storage.local` ไม่มีการส่งข้อมูลออกไปที่ไหน
- ข้อมูลที่เก็บ ได้แก่: กลุ่มของคุณ, ตัวจับเวลาการใช้งาน, เวลารีเซ็ตล่าสุด, บันทึก snooze, ตัวจับเวลา custom และค่าถาวร custom
- ส่วนขยายจะไม่อ่านเนื้อหาหน้าเกินกว่าที่จำเป็นสำหรับตรวจจับประเภทหน้า (path/hostname/DOM marker ที่รู้จักของเว็บวิดีโอ) และจะไม่อ่านข้อความ โพสต์ คอมเมนต์ หรือเนื้อหาส่วนตัวของคุณ

---

## 16. สิทธิ์ที่ใช้

- `storage` — สำหรับข้อมูลข้างต้น
- `declarativeNetRequest` — สำหรับการบล็อกแบบ native ของกลุ่ม `Default`
- `alarms` — เพื่อกำหนดเวลาการเปลี่ยนสถานะกฎอย่างมีประสิทธิภาพ
- `host_permissions: <all_urls>` — เพื่อให้ content script แสดง timer overlay และตรวจจับบริบทแพลตฟอร์มได้บนทุกหน้า

---

## 17. การแก้ปัญหา

- **กลุ่มที่ฉันเพิ่มไม่ทำงานเลย** ตรวจสอบว่ากลุ่มเปิดใช้งานอยู่ ตารางเวลาอนุญาตในเวลานี้ ไม่มี snooze ที่ทำงานอยู่ และ (สำหรับกลุ่มแพลตฟอร์ม) หน้าเว็บตรงกับ content type และ author filter ที่เลือกจริง
- **ตัวจับเวลาค้างหรือผิดบนบางแท็บ** สลับออกแล้วกลับมา หรือโฟกัสแท็บนั้นใหม่ — การกระทำนี้จะบังคับรีเฟรชจากตัวจับเวลาที่แชร์
- **การ์ดฟีดกลับมาอีกทั้งที่ควรถูกซ่อน** การซ่อนฟีดจะทำงานเฉพาะตอนที่กฎกำลังบล็อกจริงเท่านั้น หากเป็นกฎ `after-minutes` การซ่อนฟีดจะเริ่มเมื่อเวลาเหลือศูนย์
- **ปุ่มนำทาง YouTube ที่คิดว่าควรซ่อนยังอยู่** การซ่อนเมนูนำทางต้องตั้งกฎเป็น "do not filter by author" และ content type ต้องเป็น Shorts หรือ YouTube posts หากใช้ author filter จะซ่อนได้เฉพาะราย-card
- **Custom rule ไม่ทำอะไรหรือ error แบบเงียบ** เปิด `chrome://extensions`, เปิด Developer Mode, คลิกลิงก์ "service worker" ของส่วนขยาย แล้วดู console ใช้ `helpers.logHelper.log(...)` เพื่อติดตามกฎ
- **ลบกลุ่มไม่ได้** กลุ่มนั้นน่าจะถูก freeze กลุ่ม strict-frozen จะลบไม่ได้จนกว่า lock จะหมดเวลา ส่วนกลุ่ม frozen แบบไม่ strict ลบได้ผ่านพิธี unfreeze

---

## 18. คำศัพท์

- **Block group** — ชุดกฎหนึ่งชุดที่มีประเภท พฤติกรรม ตารางเวลา และ freeze/snooze ของตัวเอง
- **Instant block** — กฎจะบล็อกทันทีเมื่อกฎนั้น active
- **After-minutes block** — กฎจะเริ่มบล็อกเมื่อโควตาเวลาของช่วงนั้นหมดแล้ว
- **Reset interval** — ความถี่ที่โควตาแบบ after-minutes ถูกรีเซ็ต
- **Schedule** — วัน + ช่วงเวลาที่กลุ่มทำงาน
- **Freeze / Strict freeze** — สถานะป้องกันการแก้แบบฉับพลัน
- **Snooze** — ปิดชั่วคราวพร้อมเหตุผลเป็นลายลักษณ์อักษร
- **Author filter** — สำหรับกลุ่มแพลตฟอร์ม ใช้จำกัดกฎให้มีผลกับผู้สร้างบางราย
- **Content type** — สำหรับกลุ่มแพลตฟอร์ม ใช้จำกัดกฎให้มีผลกับรูปแบบคอนเทนต์บางประเภท (short, long, post)
- **Helpers** — ยูทิลิตี้ที่ส่งเข้าไปในฟังก์ชันของกฎ custom
- **Platform** — หนึ่งใน `youtube`, `tiktok`, `facebook`, `instagram`, `twitch` แต่ละแพลตฟอร์มมีประเภทกลุ่มและ logic การซ่อนฟีดของตัวเอง

---

## 19. ข้อจำกัด

- การซ่อนฟีดขึ้นกับ DOM ปัจจุบันของแต่ละแพลตฟอร์ม หากแพลตฟอร์มเปลี่ยน layout ตัว selector ที่ใช้ซ่อนอาจต้องอัปเดต
- การตรวจจับบริบทแพลตฟอร์มสำหรับเว็บที่ไม่ใช่ YouTube อิง URL เป็นหลัก จึงแม่นยำที่สุดบน URL คอนเทนต์แบบมาตรฐาน
- ลูปของ custom rule ทำงานใน background worker ไม่ใช่ในหน้าเว็บ ดังนั้นข้อมูลระดับ DOM จะใช้ไม่ได้ภายในฟังก์ชัน ให้ใช้ `platformHelper.detect(url)` โดยส่ง URL string แทน
- เบราว์เซอร์อาจพัก service worker เมื่อ idle ส่วนขยายจะปลุกขึ้นทันทีเมื่อมีหน้าเว็บหรือ alarm เรียกใช้ และตัวจับเวลาการใช้งานจะไม่สูญเสียความแม่นยำเพราะเหตุนี้

