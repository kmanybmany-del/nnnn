# دليل نظام جدولة المنشورات — مهووس

## نظام مهووس — جدولة المحتوى متعدد المنصات

---

## أولاً: تشخيص المشكلة الجذرية

### المشكلة الأساسية: صفوف مكررة لنفس المنشور

الملف الحالي يعاني من **مشكلة هيكلية** جوهرية:

| المشكلة | التأثير |
|---------|---------|
| كل منشور واحد موزع على **5 صفوف** (صف لكل منصة) | أدوات الجدولة تقرأ كل صف كمنشور مستقل → تكرار وتضارب |
| نفس التاريخ والوقت يظهر في عدة صفوف | الأداة تجدول المنشور 5 مرات بدلاً من مرة واحدة |
| الصفوف الأخرى لنفس التوقيت تكون فارغة | يُنشئ منشورات فارغة أو يرمي خطأ |

**مثال على المشكلة:**
```
الصف 1: 2026-01-05 | 16:00 | Facebook: "اسمع الكلام..." | Instagram: فارغ
الصف 2: 2026-01-05 | 16:00 | Facebook: فارغ | Instagram: "اسمع الكلام..."
الصف 3: 2026-01-05 | 16:00 | Facebook: فارغ | Threads: "اسمع الكلام..."
```

**الصحيح:**
```
الصف 1: 2026-01-05 | 16:00 | Facebook: "..." | Instagram: "..." | Threads: "..."
```

---

## ثانياً: الحل — هيكلان صحيحان

### الهيكل A — Multi-Platform (الموصى به)

**الوصف:** كل منشور = صف واحد يحتوي على جميع المنصات

| Date | Time | Platform_Facebook | Platform_Instagram | Platform_Threads | ... |
|------|------|-------------------|-------------------|------------------|-----|
| 2026-01-05 | 16:00 | "النص والصورة" | "النص والصورة" | "النص والصورة" | ... |
| 2026-01-06 | 14:00 | "النص والصورة" | "" | "النص والصورة" | ... |

**المميزات:**
- كل منصة تُعالَج في نفس الصف
- سهل الفهم والتدقيق
- مناسب لـ Make.com و Zapier

**الملف الجاهز:** `mahwous-schedule-multi-{date}.csv`

---

### الهيكل B — Single-Platform

**الوصف:** كل منصة = صف منفصل

| Date | Time | Platform | Post | Image | Video |
|------|------|----------|------|-------|-------|
| 2026-01-05 | 16:00 | Facebook | "النص" | رابط | "" |
| 2026-01-05 | 16:00 | Instagram | "النص" | رابط | "" |
| 2026-01-05 | 16:00 | Threads | "النص" | رابط | "" |

**المميزات:**
- كل منصة تُعالَج باستقلالية
- سهل الفلترة (فلتر على Platform)
- مناسب لأدوات الجدولة التي تستورد منصة واحدة في كل مرة

**الملف الجاهز:** `mahwous-schedule-single-{date}.csv`

---

## ثالثاً: طريقة تجميع البيانات الصحيحة

### عند إنشاء جدول المحتوى من الصفر:

**الخطوة 1 — حدد المنشور الأساسي:**
```
نص المنشور (Post Text)
رابط المنتج (Link) — اختياري
وسيلة الإعلام (Image URL أو Video URL)
```

**الخطوة 2 — حدد المنصات المستهدفة:**
- هل نفس النص لكل المنصات؟ → ضعه في عمود كل منصة
- هل النص مختلف لكل منصة؟ → أنشئ صف منفصل لكل منصة (هيكل B)

**الخطوة 3 — حدد التوقيت:**
- تاريخ النشر: `YYYY-MM-DD` (مثال: `2026-01-05`)
- وقت النشر: `HH:MM:SS` (مثال: `16:00:00`)
- **تنبيه:** إذا كانت منصتان بنفس الوقت في هيكل A → ضعهما في نفس الصف

**الخطوة 4 — تحقق من الوسائط:**
- الصورة: رابط مباشر ينتهي بـ `.png` أو `.jpg`
- الفيديو: رابط مباشر ينتهي بـ `.mp4`
- **لا تضع رابط صورة في عمود الفيديو والعكس**

---

## رابعاً: أخطاء سحب البيانات الشائعة وإصلاحها

### الخطأ 1: منشورات فارغة تُجدَّل

**السبب:** الأداة تقرأ الصفوف الفارغة (التي تحتوي على Date+Time فقط بدون محتوى).

**الإصلاح:**
```python
# في Python — احذف الصفوف التي لا تحتوي على أي محتوى
df = df.dropna(how='all', subset=[col for col in df.columns if 'Post' in col])
df = df[df.filter(like='Post').apply(lambda x: x.str.strip().ne(''), axis=1).any(axis=1)]
```

**في Make.com:**
- أضف Filter بعد قراءة CSV: `Post Text is not empty`

---

### الخطأ 2: نفس المنشور يُنشر عدة مرات

**السبب:** صفوف مكررة بنفس Date+Time (المشكلة الجذرية في الملف الحالي).

**الإصلاح في Python:**
```python
import pandas as pd

df = pd.read_csv('your_file.csv', encoding='utf-8-sig')

# دمج الصفوف المكررة بنفس Date+Time
def merge_group(group):
    merged = {}
    for col in group.columns:
        non_empty = group[col][group[col].notna() & (group[col].astype(str).str.strip() != '')].tolist()
        merged[col] = non_empty[0] if non_empty else ''
    return pd.Series(merged)

fixed_df = df.groupby(['Date', 'Time'], sort=False).apply(
    merge_group, include_groups=False
).reset_index()

fixed_df.to_csv('fixed_file.csv', index=False, encoding='utf-8-sig')
```

---

### الخطأ 3: أحرف عربية تظهر مشوهة (????)

**السبب:** الترميز غير صحيح عند فتح الملف.

**الإصلاح:**
- عند الحفظ: دائماً استخدم `encoding='utf-8-sig'` (UTF-8 with BOM)
- عند الفتح في Excel: استخدم "استيراد البيانات" → اختر UTF-8
- في Make.com: تأكد من إعداد Encoding = `UTF-8`

```python
# حفظ صحيح
df.to_csv('output.csv', index=False, encoding='utf-8-sig')

# قراءة صحيحة
df = pd.read_csv('input.csv', encoding='utf-8-sig')
```

---

### الخطأ 4: روابط الصور لا تعمل

**السبب:** الرابط منتهي الصلاحية أو غير مباشر.

**الإصلاح:**
- تأكد أن الرابط يفتح مباشرة في المتصفح بدون تسجيل دخول
- استخدم روابط CDN ثابتة (مثل `files.manuscdn.com`)
- اختبر كل رابط قبل الجدولة

**فحص الروابط بـ Python:**
```python
import requests

def check_url(url):
    try:
        r = requests.head(url, timeout=5)
        return r.status_code == 200
    except:
        return False

df['Image_Valid'] = df['Facebook Image'].apply(lambda x: check_url(x) if x else False)
```

---

### الخطأ 5: التوقيت خاطئ (فرق ساعات)

**السبب:** الأداة تستخدم UTC بينما الملف يحتوي توقيت الرياض (UTC+3).

**الإصلاح:**
- في Make.com: أضف 3 ساعات للتوقيت عند الإرسال
- أو حوّل التوقيت في الملف:

```python
import pandas as pd
from datetime import datetime, timedelta

# تحويل من توقيت الرياض (UTC+3) إلى UTC
df['DateTime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
df['DateTime_UTC'] = df['DateTime'] - timedelta(hours=3)
df['Date'] = df['DateTime_UTC'].dt.strftime('%Y-%m-%d')
df['Time'] = df['DateTime_UTC'].dt.strftime('%H:%M:%S')
```

---

### الخطأ 6: عمود Platform فارغ في هيكل Single Platform

**السبب:** عند التصدير من أداة الجدولة، لا تُدرج اسم المنصة تلقائياً.

**الإصلاح — تحويل من Multi إلى Single:**
```python
platforms = {
    'Facebook':  {'post': 'Facebook Post', 'image': 'Facebook Image', 'video': 'Facebook Video'},
    'Instagram': {'post': 'Instagram Post', 'image': 'Instagram Image', 'video': 'Instagram Video'},
    'Threads':   {'post': 'Threads Post', 'image': 'Threads Image', 'video': 'Threads Video'},
    'Twitter':   {'post': 'Twitter Post', 'image': 'Twitter Image', 'video': 'Twitter Video'},
    'LinkedIn':  {'post': 'LinkedIn Post', 'image': 'LinkedIn Image', 'video': 'LinkedIn Video'},
    'Pinterest': {'post': 'Pinterest Post', 'image': 'Pinterest Image', 'video': 'Pinterest Video'},
    'TikTok':    {'post': 'TikTok Post', 'image': 'TikTok Image', 'video': 'TikTok Video'},
    'Telegram':  {'post': 'Telegram Post', 'image': 'Telegram Image', 'video': 'Telegram Video'},
}

rows = []
for _, row in df.iterrows():
    for platform, cols in platforms.items():
        post = str(row.get(cols['post'], '')).strip()
        if post and post != 'nan':
            rows.append({
                'Date': row['Date'],
                'Time': row['Time'],
                'Platform': platform,
                'Post': post,
                'Image': str(row.get(cols['image'], '')).strip(),
                'Video': str(row.get(cols['video'], '')).strip(),
            })

single_df = pd.DataFrame(rows)
single_df.to_csv('single_platform.csv', index=False, encoding='utf-8-sig')
```

---

## خامساً: قواعد ذهبية لتجنب الأخطاء مستقبلاً

| القاعدة | التفاصيل |
|---------|---------|
| **قاعدة الصف الواحد** | كل منشور = صف واحد فقط. لا تكرار للتاريخ والوقت في هيكل Multi-Platform |
| **قاعدة الترميز** | دائماً `UTF-8 with BOM` (utf-8-sig) لدعم العربية |
| **قاعدة الروابط** | روابط مباشرة فقط، تنتهي بامتداد الملف (.png/.jpg/.mp4) |
| **قاعدة التوقيت** | حدد المنطقة الزمنية مسبقاً (الرياض = UTC+3) |
| **قاعدة الفحص** | افحص الملف بـ Python قبل الرفع للأداة |
| **قاعدة النسخ الاحتياطية** | احتفظ بنسخة أصلية + نسخة مصلحة |

---

## سادساً: سكريبت الإصلاح التلقائي الجاهز للاستخدام

احفظ هذا الملف باسم `fix_schedule.py` واستخدمه في أي وقت:

**طريقة الاستخدام:**
```bash
python3 scripts/fix_schedule.py input.csv output.csv --validate
```

**الخيارات:**
- `--validate`: فحص صحة جميع روابط الصور والفيديوهات

---

## سابعاً: استخدام التطبيق للتصدير

### في واجهة المستخدم:

1. **انتقل إلى قسم "الجدولة"**
2. **اختر صيغة التصدير:**
   - **Multi-Platform**: لـ Make.com و Zapier
   - **Single-Platform**: لأدوات الجدولة التقليدية
3. **اضغط "تحميل CSV"**
4. **استخدم الملف مباشرة في أداتك المفضلة**

### في الكود:

```typescript
import { downloadCSV } from '@/lib/csvExporter';
import { getScheduledItems } from '@/lib/smartScheduler';

// تحميل بصيغة Multi-Platform
const items = getScheduledItems();
downloadCSV(items, { format: 'multi-platform' });

// تحميل بصيغة Single-Platform
downloadCSV(items, { format: 'single-platform' });
```

---

## ملاحظات مهمة

- **النسخ الاحتياطية**: احتفظ دائماً بنسخة من الملف الأصلي قبل الإصلاح
- **الاختبار**: اختبر الملف المصلح في Make.com قبل الجدولة الفعلية
- **التوثيق**: وثّق أي تغييرات تجريها على الملف
- **التحديثات**: تحقق من هذا الدليل بانتظام للتحديثات الجديدة

---

*آخر تحديث: مارس 2026*
