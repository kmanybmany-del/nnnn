# 🌹 Perfume Brand AI — Setup & Installation Guide

## نظرة عامة
تطبيق Next.js متقدم لتوليد حملات إعلانية عالية الجودة للعطور باستخدام الذكاء الاصطناعي.

## المتطلبات الأساسية
- **Node.js**: الإصدار 16 أو أحدث
- **npm** أو **pnpm**: لإدارة الحزم
- **مفاتيح API** (اختيارية للاختبار الكامل):
  - `REPLICATE_API_TOKEN`: من [replicate.com](https://replicate.com/account/api-tokens)
  - `ANTHROPIC_API_KEY`: من [console.anthropic.com](https://console.anthropic.com)

## خطوات التثبيت

### 1. تثبيت الحزم
```bash
npm install
```

### 2. إعداد متغيرات البيئة
أنشئ ملف `.env.local` في جذر المشروع:
```bash
cp .env.example .env.local
```

ثم أضف مفاتيح API الخاصة بك (اختياري):
```env
REPLICATE_API_TOKEN=r8_...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. تشغيل خادم التطوير
```bash
npm run dev
```

افتح المتصفح على: **http://localhost:3000**

### 4. بناء الإصدار الإنتاجي
```bash
npm run build
npm start
```

## الميزات الرئيسية

| الميزة | الوصف |
|--------|--------|
| **توليد الصور** | إنشاء 3 صور بتنسيقات مختلفة (عمودي، مربع، أفقي) |
| **تحليل المنتجات** | استخراج معلومات العطر من روابط الويب |
| **التعليقات العربية** | إنشاء نصوص إعلانية باللهجة السعودية |
| **LoRA Support** | دعم نماذج LoRA لثبات الوجه |
| **ControlNet** | تحكم متقدم على الصور المولدة |

## بنية المشروع

```
perfume-brand-ai/
├── app/
│   ├── page.tsx                 # الصفحة الرئيسية
│   ├── globals.css              # الأنماط العامة
│   └── api/                     # نقاط نهاية API
│       ├── generate/            # توليد الصور
│       ├── scrape/              # كشط المنتجات
│       ├── captions/            # توليد التعليقات
│       └── analyze-bottle/      # تحليل الزجاجة
├── components/                  # مكونات React
├── lib/                         # مكتبات مساعدة
│   ├── promptEngine.ts          # محرك الأوامر
│   ├── replicateClient.ts       # عميل Replicate
│   └── scraper.ts               # كاشط الويب
├── package.json                 # الحزم المطلوبة
└── tsconfig.json                # إعدادات TypeScript
```

## استكشاف الأخطاء

### المشكلة: "API key not found"
**الحل**: تأكد من إضافة مفاتيح API في ملف `.env.local`

### المشكلة: "Port 3000 already in use"
**الحل**: استخدم منفذ مختلف:
```bash
npm run dev -- -p 3001
```

### المشكلة: أخطاء في البناء
**الحل**: امسح مجلد `node_modules` وأعد التثبيت:
```bash
rm -rf node_modules package-lock.json
npm install
```

## الأوامر المتاحة

| الأمر | الوصف |
|-------|--------|
| `npm run dev` | تشغيل خادم التطوير |
| `npm run build` | بناء الإصدار الإنتاجي |
| `npm start` | تشغيل الإصدار الإنتاجي |
| `npm run lint` | فحص الكود |

## الدعم والمساعدة

للمزيد من المعلومات، راجع:
- [توثيق Next.js](https://nextjs.org/docs)
- [توثيق Replicate](https://replicate.com/docs)
- [توثيق Anthropic](https://docs.anthropic.com)

---

**آخر تحديث**: مارس 2026
