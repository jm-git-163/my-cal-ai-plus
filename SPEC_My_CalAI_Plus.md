# My Cal AI Plus

## OpenAI API 기반 AI Native Fitness Coach

### Cursor + React/Vite + Vercel 기술명세서 v1.0

---

# 1. 프로젝트 목표

## 프로젝트명

**My Cal AI Plus**

부제

> *Snap • Analyze • Coach • Improve*

My Cal AI Plus는 **OpenAI의 Vision, Image Generation, Data Analysis** 기능을 하나의 앱에 통합한 AI Native 건강관리 플랫폼이다.

Cal AI가 "사진으로 칼로리를 계산"하는 데 집중했다면,

My Cal AI Plus는

> **사진을 이해하고 → 영양을 분석하고 → 건강을 예측하고 → AI 코치가 행동을 제안하는 개인 AI 건강 비서**

를 목표로 한다.

---

# 2. 핵심 제안가치

## 기존 Fitness App

```
사진

↓

칼로리 확인

↓

기록
```

---

## My Cal AI Plus

```
사진

↓

AI Vision

↓

음식 인식

↓

영양 분석

↓

섭취량 추정

↓

데이터 분석

↓

AI 건강 코칭

↓

주간 리포트
```

즉,

**"기록"이 아니라 "AI 건강 의사결정 지원"**이 핵심 가치이다.

---

# 3. 시스템 아키텍처

```text
React (Vite)

↓

Camera / Upload

↓

Vercel Serverless API

↓

OpenAI Responses API

↓

GPT Vision

↓

Food Detection

↓

Nutrition Analysis

↓

Data Analysis

↓

Dashboard

↓

AI Coach
```

---

# 4. 기술 스택

## Frontend

* React 18
* Vite
* TypeScript
* React Router
* Zustand
* TailwindCSS
* shadcn/ui
* Recharts
* React Hook Form

---

## Backend

Vercel Serverless Functions

```
/api

vision.ts

nutrition.ts

coach.ts

analytics.ts

image.ts
```

---

## AI

OpenAI API

* GPT-5.5
* Vision
* Image Generation
* Structured Output
* Function Calling

---

## Database

MVP

```
IndexedDB

또는

Supabase (선택)
```

---

# 5. OpenAI 기능 활용

## ① Vision API

사용자

↓

음식 촬영

↓

GPT Vision

↓

응답

예)

```
Blueberry Pancake

Estimated Weight

220g

Confidence

96%

Calories

615 kcal

Protein

11g

Carbs

93g

Fat

21g
```

---

## ② Structured Output

JSON으로 반환

```json
{
  "food":"Blueberry Pancakes",
  "grams":220,
  "calories":615,
  "protein":11,
  "fat":21,
  "carbs":93,
  "confidence":0.96
}
```

바로 Dashboard에 저장 가능하다.

---

## ③ AI Nutrition Coach

LLM Prompt

```
최근 7일의

식단

운동

체중

목표를 분석하여

100자 내외로

개선점을 제안해라.
```

예)

> 단백질은 충분하지만 탄수화물 섭취가 다소 높습니다. 저녁 식사에서는 밥 양을 20% 줄이고 채소를 늘려보세요.

---

## ④ Data Analysis

OpenAI의 데이터 분석 기능을 활용하여

자동 생성

* 칼로리 추세
* 체중 변화
* 단백질 섭취량
* 운동량
* 감량 속도
* 목표 달성률

AI가

```
최근

14일 동안

체중은

-1.3kg

감량되었습니다.

예상 목표 달성일

8월 22일
```

같은 분석을 생성한다.

---

## ⑤ Image Generation

OpenAI Image Generation

활용

AI가 생성

* 오늘의 건강 카드
* 식단 리포트 이미지
* SNS 공유 카드
* Pixel Avatar
* Healthy Meal Illustration

예)

```
Congratulations!

7 Day Streak
```

자동 생성

---

# 6. CNN 기반 이미지 인식 설계 반영

첨부한 CNN 노트북에서는 다음 개념을 설명하고 있습니다.

* **Convolution(3×3 필터)**: 이미지의 특징(Edge, Texture)을 추출
* **Max Pooling(2×2)**: 중요한 특징은 유지하면서 데이터 크기를 축소
* **Feature Map**: 단순 픽셀 대신 의미 있는 특징을 학습
* **수직·수평 Edge Filter(Sobel 계열)**: 경계와 형태를 강조하여 객체를 구분

이를 My Cal AI Plus의 전처리 설계에 반영합니다.

### AI Vision 처리 파이프라인

```text
사진 업로드

↓

Image Resize

↓

Contrast Enhancement

↓

Edge Enhancement

(Convolution)

↓

Noise Reduction

↓

Feature Extraction

↓

GPT Vision

↓

Food Recognition
```

### CNN 기반 전처리 활용 사례

* 음식과 접시의 경계 강조
* 여러 음식이 있는 경우 영역 구분 보조
* 조명이 어두운 사진의 대비 향상
* 흐릿한 사진의 특징 강화
* Vision 모델 입력 품질 개선

> 실제 음식 인식은 OpenAI Vision이 수행하지만, CNN의 전처리 아이디어를 적용하면 입력 이미지 품질을 높여 더 안정적인 인식 결과를 얻을 수 있습니다.

---

# 7. 핵심 기능

## Dashboard

오늘의

* Calories
* Protein
* Carbs
* Fat
* Water
* Exercise

---

## AI Food Scan

사진

↓

Vision

↓

자동 분석

↓

저장

---

## Smart Meal History

AI가

자동 분류

* Breakfast
* Lunch
* Dinner
* Snack

---

## Workout Tracker

운동

↓

칼로리 계산

↓

저장

---

## AI Coach

매일

LLM 코칭

---

## Progress

그래프

* Weight
* Calories
* Protein
* Activity

---

## Analytics

AI 데이터 분석

자동 생성

---

## AI Report

PDF

자동 생성

---

# 8. 화면 구성

```
Dashboard

Food Scan

Meal History

Workout

Analytics

AI Coach

Settings
```

---

# 9. Cursor 프로젝트 구조

```
my-cal-ai-plus/

src/

components/

pages/

hooks/

store/

services/

api/

utils/

types/

assets/

api/

vision.ts

nutrition.ts

analytics.ts

coach.ts

image.ts

public/
```

---

# 10. API 설계

## POST /api/vision

입력

```
Image
```

출력

```
Food

Calories

Protein

Carbs

Fat

Confidence
```

---

## POST /api/coach

입력

```
최근 데이터
```

출력

```
AI 조언
```

---

## POST /api/image

입력

```
Prompt
```

출력

```
Healthy Card
```

---

## POST /api/analytics

입력

```
Meal History

Workout

Weight
```

출력

```
Weekly Insight
```

---

# 11. UI 디자인

디자인 컨셉

**Apple Health × Cal AI × ChatGPT**

스타일

* White Space
* Glass Morphism
* Soft Shadow
* Large Cards
* Rounded 24px
* Green Accent
* Orange Nutrition
* Blue Protein
* Purple Analytics

---

# 12. 향후 확장 기능

### Phase 2

* 음성 식단 기록
* 실시간 비디오 음식 인식
* Apple Health 연동
* Google Fit 연동
* Garmin 연동
* AI 식단 생성
* AI 장보기 추천
* 냉장고 재료 기반 레시피 생성
* 가족 건강 관리
* AI PT(운동 루틴 생성)

### Phase 3

* 음식 Segmentation(여러 음식 자동 분리)
* 개인 맞춤 RAG 기반 영양 지식
* MCP 기반 건강 데이터 통합
* 웨어러블 센서 분석
* AI Health Agent(장기 건강 목표 관리)

---

# 13. 구현 로드맵 (Cursor + Vercel)

### Sprint 1 (1주)

* React/Vite 프로젝트 생성
* OpenAI API 연동
* 사진 업로드
* Vision 기반 음식 인식
* 대시보드 UI

### Sprint 2 (2주)

* 영양소 자동 계산
* 운동 기록
* AI Coach
* 데이터 시각화

### Sprint 3 (3주)

* 데이터 분석 리포트
* AI 이미지 생성(공유 카드)
* PDF 리포트
* Vercel 배포 및 성능 최적화

## 차별화 포인트

Cal AI가 **Vision 중심의 칼로리 기록 앱**이라면, **My Cal AI Plus**는 OpenAI의 **Vision + Structured Output + Data Analysis + Image Generation**을 결합한 **AI Health Intelligence Platform**을 지향합니다. 여기에 첨부하신 CNN 학습 노트의 핵심 개념(Convolution을 통한 특징 강조, Max Pooling을 통한 특징 유지, Feature Extraction)을 이미지 전처리 단계에 반영하면 입력 품질을 높여 Vision 모델의 인식 안정성을 개선할 수 있으며, 단순한 "칼로리 계산"을 넘어 **AI가 건강 데이터를 지속적으로 분석하고 행동을 제안하는 AI Native 건강 코치**로 발전시킬 수 있습니다.
