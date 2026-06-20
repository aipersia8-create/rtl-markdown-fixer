# RTL Markdown Fixer

ابزار چت‌محور برای تمیز کردن و نمایش درست متن فارسی راست‌به‌چپ در کنار Markdown، کد، لینک، ایمیل و فرمول‌های LaTeX.

این نسخه یک بک‌گراند سه‌بعدی متحرک با `Three.js` دارد: کارت‌های تایپوگرافی شامل حروف فارسی، نشانه‌های Markdown، قطعه‌های کد و نمادهای ریاضی در یک فضای کهکشانی می‌چرخند. کارت‌هایی که جلو می‌آیند روشن‌تر و واضح‌تر می‌شوند و کارت‌هایی که عقب می‌روند تیره‌تر دیده می‌شوند تا حس عمق سه‌بعدی مشخص باشد.

## Features

- اصلاح و نمایش متن فارسی RTL در قالب چت
- نمایش امن LTR برای کد، لینک، ایمیل، مسیر فایل و فرمول‌ها
- پشتیبانی از Markdown، GFM و LaTeX
- دکمه‌های کپی برای متن، Markdown و HTML
- تاریخچه‌ی محلی گفتگوها همراه با جستجو، تغییر نام، pin و حذف
- بک‌گراند سه‌بعدی متحرک با `Three.js`
- پشتیبانی از `prefers-reduced-motion`
- رابط تاریک، شیشه‌ای و واکنش‌گرا

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Three.js
- unified / remark / rehype
- KaTeX

## Local Setup

اول dependencyها را نصب کنید:

```bash
npm install
```

برای اجرای محیط توسعه:

```bash
npm run dev
```

بعد آدرس زیر را در مرورگر باز کنید:

```text
http://localhost:3000
```

اگر پورت 3000 پر بود، می‌توانید یک پورت دیگر بدهید:

```bash
npm run dev -- -p 3001
```

## Production Build

برای بررسی TypeScript:

```bash
npm run lint
```

برای ساخت نسخه‌ی production:

```bash
npm run build
```

برای اجرای build به صورت local:

```bash
npm run start
```

یا با پورت مشخص:

```bash
npm run start -- -p 3001
```

## Deploy on Vercel

این پروژه برای Vercel آماده است.

1. این repository را روی GitHub نگه دارید.
2. وارد Vercel شوید و `Add New Project` را بزنید.
3. همین GitHub repository را import کنید.
4. تنظیمات پیش‌فرض Next.js کافی است:
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`
   - Output Directory: پیش‌فرض Vercel
   - Environment Variables: لازم نیست
5. Deploy را اجرا کنید.

بعد از هر push جدید به GitHub، Vercel می‌تواند دوباره پروژه را build و deploy کند.

## Notes

- بک‌گراند فقط تزئینی است و با کلیک‌ها، فوکوس یا محتوای چت تداخل ندارد.
- اگر کاربر در سیستم خود reduced motion فعال کرده باشد، انیمیشن بک‌گراند کاهش پیدا می‌کند.
- تاریخچه‌ی گفتگوها در مرورگر و به صورت local ذخیره می‌شود.
