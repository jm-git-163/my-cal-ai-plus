# My Cal AI Plus

> Snap · Analyze · Coach · Improve

OpenAI Vision 기반 AI Native Fitness Coach — Sprint 1 MVP.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- Zustand + IndexedDB (`idb`)
- Vercel Serverless `/api/vision`
- Client-side CNN-style image preprocess (contrast, Sobel edge blend, noise reduction)

## Setup

```powershell
cd cal_ai_cnn
npm install
copy .env.example .env
# Edit .env and set OPENAI_API_KEY
```

## Local development

API routes run only via Vercel CLI:

```powershell
npx vercel dev
```

Open the URL shown in the terminal (usually `http://localhost:3000`).

## Build

```powershell
npm run build
```

## Deploy to Vercel

```powershell
npx vercel login
npx vercel
# Production:
npx vercel --prod
```

Set environment variables in the Vercel project dashboard (or CLI):

- `OPENAI_API_KEY` — required
- `OPENAI_MODEL` — optional (default `gpt-4o`)

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — daily macros |
| `/scan` | Food photo → preprocess → Vision → save |
| `/history` | Meal history (IndexedDB) |
| `/settings` | Name, goals, language (KO/EN), light/dark theme |

## i18n & theme

- Languages: Korean / English (header + Settings)
- Theme: Light / Dark (`class` strategy, persisted in IndexedDB)

## Spec

See [SPEC_My_CalAI_Plus.md](./SPEC_My_CalAI_Plus.md).
