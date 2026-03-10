# 🌹 Perfume Brand AI — Project Overview

## نظرة عامة على المشروع

**Perfume Brand AI** هو تطبيق ويب متقدم مبني بـ Next.js يهدف إلى أتمتة عملية إنتاج حملات إعلانية عالية الجودة للعطور باستخدام الذكاء الاصطناعي التوليدي.

---

## الميزات الأساسية

### 1. توليد الصور (Image Generation)
- **التقنية**: Replicate AI + FLUX Dev + LoRA
- **الإخراج**: 3 صور بتنسيقات مختلفة:
  - Story Format (9:16 — 1080×1920): للقصص والـ Reels
  - Post Format (1:1 — 1024×1024): للمنشورات
  - Landscape Format (16:9 — 1920×1080): لليوتيوب

### 2. تحليل المنتجات (Product Analysis)
- استخراج معلومات العطر من روابط الويب
- التقنية: Cheerio + Anthropic Claude

### 3. التعليقات العربية (Arabic Captions)
- اللهجة: السعودية
- المنصات: Instagram, TikTok, YouTube

### 4. تحليل الزجاجة (Bottle Analysis)
- استخراج وصف دقيق للزجاجة
- التقنية: Claude Vision

### 5. دعم LoRA
- ثبات الوجه والشخصية عبر الصور
- اتساق بصري عالي

---

## بنية المشروع

```
perfume-brand-ai/
├── app/                          # تطبيق Next.js
│   ├── page.tsx                  # الصفحة الرئيسية
│   ├── globals.css               # الأنماط العامة
│   └── api/                      # نقاط نهاية API
│       ├── generate/             # توليد الصور
│       ├── scrape/               # كشط المنتجات
│       ├── captions/             # توليد التعليقات
│       └── analyze-bottle/       # تحليل الزجاجة
├── components/                   # مكونات React
├── lib/                          # مكتبات مساعدة
│   ├── promptEngine.ts           # محرك الأوامر
│   ├── replicateClient.ts        # عميل Replicate
│   └── scraper.ts                # كاشط الويب
└── package.json                  # الحزم المطلوبة
```

---

## التقنيات المستخدمة

| المكون | التقنية |
|--------|---------|
| Frontend | React 18 + Next.js 14 |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Image Generation | Replicate (FLUX Dev) |
| Text Analysis | Anthropic Claude |
| Web Scraping | Cheerio |

---

## الأوامر الأساسية

```bash
npm install          # تثبيت الحزم
npm run dev          # تشغيل خادم التطوير
npm run build        # بناء الإصدار الإنتاجي
npm start            # تشغيل الإصدار الإنتاجي
npm run lint         # فحص الكود
```

---

**آخر تحديث**: مارس 2026
