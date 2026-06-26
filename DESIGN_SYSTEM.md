# PULSE — Дизайн-система

> Версия: 1.0 | Тема: Dark | Подход: Glassmorphism

---

## Оглавление

1. [Общая концепция](#1-общая-концепция)
2. [Цветовая палитра](#2-цветовая-палитра)
3. [Типографика](#3-типографика)
4. [Компоненты](#4-компоненты)
5. [Glass и Liquid Glass](#5-glass-и-liquid-glass)
6. [Sentiment-система](#6-sentiment-система)
7. [Анимации](#7-анимации)
8. [Layout](#8-layout)
9. [Feature Colors](#9-feature-colors)
10. [CSS Utilities](#10-css-utilities)
11. [Scrollbar и Selection](#11-scrollbar-и-selection)

---

## 1. Общая концепция

PULSE — это дизайн-система в dark-теме с философией **glassmorphism** (стеклянный морфизм). Основные принципы:

| Принцип | Описание |
|---------|----------|
| **Dark First** | Глубокий чёрный фон (#060606) как канвас. Контент выделяется через свет и цвет |
| **Glassmorphism** | Полупрозрачные поверхности с backdrop-blur создают иерархию глубины |
| **Liquid Glass** | Продвинутый вариант glass — с эффектом толстого стекла: внутренний блик, градиентная рамка, 3D-ощущение |
| **Цвет как смысл** | Каждый цвет несёт функцию: голубой — акцент/действие, зелёный — позитив, красный — негатив, янтарный — предупреждение |
| **Минимализм** | Чистые линии, отсутствие визуального шума, контент в приоритете |
| **Живые поверхности** | Hover-эффекты, свечение, анимации — карточки реагируют на взаимодействие |

### Визуальная иерархия

```
Layer 0: #060606 — фон страницы (самый глубокий)
Layer 1: #0E0E0E — поверхности, карточки
Layer 2: #161616 — hover-состояния
Layer 3: rgba(255,255,255,0.03) + blur — glass поверхности
Layer 4: rgba(255,255,255,0.01) + liquid effects — liquid glass
Layer 5: Градиентные блики, свечения, highlights — верхний декор
```

---

## 2. Цветовая палитра

### 2.1 CSS Custom Properties

```css
:root {
  --bg-primary: #060606;       /* Фон страницы */
  --bg-surface: #0E0E0E;       /* Карточки, секции */
  --bg-hover: #161616;         /* Hover-фоны, выделения */
  --text-primary: #FFFFFF;     /* Основной текст */
  --text-secondary: #9CA3AF;   /* Вторичный текст */
  --text-muted: #6B7280;       /* Затухший текст, мета-информация */
  --accent-primary: #00D4FF;   /* Акцент — голубой */
  --text-success: #34D399;     /* Позитив — зелёный */
  --text-warning: #F59E0B;     /* Предупреждение — янтарный */
  --text-error: #EF4444;       /* Ошибка — красный */
  --border-subtle: #222222;    /* Рамки по умолчанию */
  --border-active: #00D4FF;    /* Активная рамка */
  --radius: 0.5rem;            /* Скругление (8px) */
}
```

### 2.2 Полная таблица цветов

| Токен | Hex / Значение | RGB | Назначение |
|-------|---------------|-----|------------|
| **bg-primary** | `#060606` | 6, 6, 6 | Фон страницы, корневой canvas |
| **bg-surface** | `#0E0E0E` | 14, 14, 14 | Карточки, панели, модальные окна |
| **bg-hover** | `#161616` | 22, 22, 22 | Hover-фоны, активные состояния, фон тегов |
| **text-primary** | `#FFFFFF` | 255, 255, 255 | Заголовки, основной текст |
| **text-secondary** | `#9CA3AF` | 156, 163, 175 | Описания, вторичный контент |
| **text-muted** | `#6B7280` | 107, 114, 128 | Время, источник, meta |
| **accent-primary** | `#00D4FF` | 0, 212, 255 | Акцентный цвет: кнопки, ссылки, badges |
| **text-success** | `#34D399` | 52, 211, 153 | Позитивный sentiment, успешные операции |
| **text-warning** | `#F59E0B` | 245, 158, 11 | Предупреждения, email-индикатор |
| **text-error** | `#EF4444` | 239, 68, 68 | Ошибки, негативный sentiment |
| **border-subtle** | `#222222` | 34, 34, 34 | Тонкие рамки, разделители |
| **border-active** | `#00D4FF` | 0, 212, 255 | Активные рамки, фокус |

### 2.3 Полупрозрачные варианты (частое использование)

| Значение | Прозрачность | Применение |
|----------|-------------|------------|
| `rgba(0, 212, 255, 0.08)` | 8% | Фон source-count badge |
| `rgba(0, 212, 255, 0.12)` | 12% | Слабые акцентные фоны |
| `rgba(0, 212, 255, 0.15)` | 15% | Glow эффекты |
| `rgba(0, 212, 255, 0.25)` | 25% | Selection background |
| `rgba(0, 212, 255, 0.30)` | 30% | Tag loading border |
| `rgba(0, 212, 255, 0.50)` | 50% | Tag glow pulse |
| `rgba(255, 255, 255, 0.03)` | 3% | Glass background |
| `rgba(255, 255, 255, 0.06)` | 6% | Разделители карточек |
| `rgba(255, 255, 255, 0.08)` | 8% | Liquid glass border |
| `rgba(255, 255, 255, 0.10)` | 10% | Liquid glass inset shadow |
| `rgba(255, 255, 255, 0.25)` | 25% | Liquid glass ::before opacity |

---

## 3. Типографика

### 3.1 Шрифт

```css
html {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Стек:** Inter → system-ui → -apple-system → BlinkMacSystemFont → Segoe UI → Roboto → sans-serif

### 3.2 Размерная сетка

| Элемент | Размер | Вес | Межбуквенное | Line-height | Дополнительно |
|---------|--------|-----|-------------|-------------|---------------|
| **Логотип PULSE** | `text-xl` (20px) | 700 (bold) | -0.025em (tracking-tight) | — | Белый, капс |
| **Заголовки каруселей** | `text-2xl` (24px) | 600 (semibold) | — | — | — |
| **Nav-ссылки** | `text-sm` (14px) | 400 | — | — | text-secondary → hover text-primary |
| **Кнопка "Начать"** | `text-sm` (14px) | 500 (medium) | — | — | — |
| **Заголовок карточки** | `text-[13px]` (13px) | 600 (semibold) | — | 1.4 | line-clamp-3 |
| **Tag label (uppercase)** | `text-[10px]` (10px) | 700 (bold) | uppercase, tracking-wider | — | Цвет: #00D4FF |
| **Sentiment badge** | `text-[10px]` (10px) | 600 (semibold) | — | — | — |
| **Meta (время, источник)** | `text-[10px]` (10px) | 400 | — | — | Цвет: text-muted |
| **Tag impact pills** | `text-[9px]` (9px) | 500 (medium) | — | — | С цветным dot 6×6px |
| **Остаток тегов (+N)** | `text-[9px]` (9px) | 400 | — | — | Цвет: text-muted |
| **PulseLine текст** | `text-xs` (12px) | 400 | — | — | Цвет: text-muted, text-center |

### 3.3 Gradient Text

```css
.gradient-text {
  background: linear-gradient(135deg, #ffffff 0%, #a5f3fc 50%, #00D4FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## 4. Компоненты

### 4.1 NewsCard — Карточка новости

Основной компонент дизайн-системы. Два варианта: **Landscape** (16:9) и **Portrait** (узкая).

#### Структура карточки

```
┌─────────────────────────────────────┐
│  ═══════ highlight line ═══════    │  ← 1px gradient top
│  [TAG_LABEL] [SENTIMENT]        5м  │
│  ───────────────────────────────    │  ← divider
│  Заголовок новости, максимум        │
│  три строки текста в карточке...    │
│                                     │
│  [●тег1] [●тег2]    Источник · 5м │
│  ═══════ glow line ═══════════     │  ← 2px gradient bottom
└─────────────────────────────────────┘
```

#### Общие стили (оба варианта)

```css
/* Базовая карточка */
.news-card {
  border-radius: 12px;                    /* rounded-xl */
  overflow: hidden;
  cursor: pointer;
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  transition: all 300ms;
}

/* Hover — масштаб и подъём */
.news-card:hover {
  transform: scale(1.02) translateY(-2px);
}
```

#### Top Highlight Line

```css
/* 1px градиентная линия сверху — цвет зависит от sentiment */
.top-highlight {
  position: absolute;
  top: 0;
  left: 16px;       /* left-4 = 1rem = 16px */
  right: 16px;
  height: 1px;
  opacity: 0.60;
  background: linear-gradient(90deg, transparent, {sentiment-color}, transparent);
}
```

#### Bottom Glow Line

```css
/* 2px градиентная линия снизу */
.bottom-glow {
  position: absolute;
  bottom: 0;
  left: 8px;        /* left-2 = 0.5rem = 8px */
  right: 8px;
  height: 2px;
  border-radius: 9999px;
  opacity: 0.40;
  background: linear-gradient(90deg, transparent, {sentiment-color}, transparent);
  transition: opacity 150ms;
}

/* Hover — glow усиливается */
.news-card:hover .bottom-glow {
  opacity: 0.70;
}
```

#### Divider (внутри карточки)

```css
.divider {
  height: 1px;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.06);
}
```

#### Sentiment Badge

```css
.sentiment-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;        /* py-0.5 px-2 */
  border-radius: 9999px;   /* rounded-full */
  backdrop-filter: blur(4px);
  font-size: 10px;
  font-weight: 600;
}
```

#### Tag Impact Pill

```css
.tag-impact-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;        /* py-0.5 px-1.5 */
  border-radius: 4px;      /* rounded */
  font-size: 9px;
  font-weight: 500;
  /* Фон: {color}15 — 8% hex opacity */
  /* Бордер: {color}30 — 19% hex opacity */
}

/* Цветной dot внутри pill */
.tag-impact-dot {
  width: 6px;       /* w-1.5 = 0.375rem = 6px */
  height: 6px;
  border-radius: 50%;
}
```

#### Source Count Badge

```css
.source-count-badge {
  padding: 2px 6px;        /* py-0.5 px-1.5 */
  border-radius: 9999px;   /* rounded-full */
  font-size: 9px;
  background-color: rgba(0, 212, 255, 0.08);
  color: #00D4FF;
  backdrop-filter: blur(4px);
}
```

### 4.2 Tag — Тег фильтра

```css
.tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;            /* h-9 = 2.25rem = 36px */
  padding-left: 14px;      /* pl-3.5 */
  padding-right: 8px;      /* pr-2 */
  border-radius: 9999px;   /* rounded-pill */
  font-size: 14px;         /* text-sm */
  font-weight: 500;
  color: var(--text-primary);
  background-color: #161616;
  border: 1px solid {type-color}40;  /* 25% opacity */
}

/* Цветной dot */
.tag-dot {
  width: 8px;       /* w-2 = 0.5rem = 8px */
  height: 8px;
  border-radius: 50%;
  background-color: {type-color};
  flex-shrink: 0;
}

/* Кнопка удаления */
.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;      /* w-5 = 1.25rem = 20px */
  height: 20px;
  border-radius: 50%;
  color: var(--text-muted);
  transition: color 150ms, background-color 150ms;
}
.tag-remove:hover {
  color: var(--text-error);
  background-color: var(--bg-hover);
}
```

#### Цвета по типу тега

| Тип | Цвет | Hex |
|-----|------|-----|
| **company** (компания) | Голубой | `#00D4FF` |
| **sector** (сектор) | Фиолетовый | `#A78BFA` |
| **person** (персона) | Жёлтый | `#FBBF24` |
| **trend** (тренд) | Зелёный | `#34D399` |

### 4.3 Navbar

#### Desktop (≥768 px)

```css
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: 64px;            /* h-16 = 4rem = 64px */
  padding: 0 24px;         /* px-6 */
  background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.navbar-links {
  display: flex;           /* hidden md:flex на мобильном */
  align-items: center;
  gap: 32px;               /* gap-8 */
}

.navbar-link {
  font-size: 14px;         /* text-sm */
  color: var(--text-secondary);
  transition: color 200ms;
}
.navbar-link:hover {
  color: var(--text-primary);
}
```

#### Mobile (<768 px)

- Центральные ссылки скрыты (`hidden md:flex`)
- Показывается иконка гамбургера (`Menu` / `X`)
- Overlay меню раскрывается на всю высоту под шапкой:

```css
.mobile-menu {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  top: calc(4rem + env(safe-area-inset-top));
  z-index: 40;
  background-color: rgba(6, 6, 6, 0.97);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px;
}

.mobile-menu-link {
  display: block;
  font-size: 16px;         /* text-base */
  color: var(--text-secondary);
  padding: 12px 16px;      /* px-4 py-3 */
  border-radius: 12px;     /* rounded-xl */
  transition: color 150ms, background-color 150ms;
}
.mobile-menu-link:hover {
  color: var(--text-primary);
  background-color: rgba(255, 255, 255, 0.05);
}
```

### 4.4 PulseLine (индикатор загрузки)

```css
.pulse-line {
  position: relative;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  height: 1px;
  overflow: hidden;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 212, 255, 0.15) 30%,
    rgba(0, 212, 255, 0.15) 70%,
    transparent 100%
  );
}

/* Анимированная точка */
.pulse-dot {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;       /* w-2 = 0.5rem = 8px */
  height: 8px;
  border-radius: 50%;
  background: #00D4FF;
  box-shadow:
    0 0 6px rgba(0, 212, 255, 0.6),
    0 0 20px rgba(0, 212, 255, 0.3);
  animation: pulseTravel 3s linear infinite;
}
```

---

## 5. Glass и Liquid Glass

### 5.1 Glass (`.glass`)

Базовый стеклянный эффект — полупрозрачная поверхность с сильным blur.

```css
.glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

| Параметр | Значение | Описание |
|----------|----------|----------|
| Background | `rgba(255,255,255,0.03)` | Едва заметный белый |
| Backdrop-blur | `16px` | Сильное размытие |
| Saturate | `180%` | Повышенная насыщенность контента за стеклом |
| Border | `1px solid rgba(255,255,255,0.08)` | Почти невидимая рамка |

**Применение:** Панели, модальные окна, всплывающие подсказки.

### 5.2 Liquid Glass (`.liquid-glass`)

Продвинутый стеклянный эффект с трёхмерным ощущением — имитация толстого оптического стекла.

```css
.liquid-glass {
  background: rgba(255, 255, 255, 0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(6px) saturate(140%);
  -webkit-backdrop-filter: blur(6px) saturate(140%);
  border: none;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.1),
    0 8px 32px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
}
```

| Параметр | Значение | Описание |
|----------|----------|----------|
| Background | `rgba(255,255,255,0.01)` | Почти полностью прозрачный |
| Background-blend | `luminosity` | Сохраняет яркость фона |
| Backdrop-blur | `6px` | Лёгкое размытие (меньше, чем glass) |
| Saturate | `140%` | Умеренная насыщенность |
| Inset shadow | `0 1px 1px rgba(255,255,255,0.1)` | Внутренний блик сверху |
| Drop shadow | `0 8px 32px rgba(0,0,0,0.15)` | Мягкая тень |

#### Псевдоэлемент `::before` — градиентная рамка

```css
.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.4px;           /* Толщина рамки */
  background: linear-gradient(
    180deg,
    rgba(255,255,255,0.5) 0%,
    rgba(255,255,255,0.15) 20%,
    rgba(255,255,255,0) 40%,
    rgba(255,255,255,0) 60%,
    rgba(255,255,255,0.15) 80%,
    rgba(255,255,255,0.5) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0.25;
}
```

#### Псевдоэлемент `::after` — бликовый оверлей

```css
.liquid-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(ellipse 90% 40% at 50% 0%, rgba(255,255,255,0.18) 0%, transparent 55%),
    radial-gradient(ellipse 60% 35% at 65% 10%, rgba(255,255,255,0.08) 0%, transparent 50%);
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

### 5.3 Сравнение Glass vs Liquid Glass

| Характеристика | `.glass` | `.liquid-glass` |
|----------------|----------|-----------------|
| **Blur** | 16px (сильный) | 6px (лёгкий) |
| **Saturate** | 180% | 140% |
| **Background opacity** | 0.03 (3%) | 0.01 (1%) |
| **Border** | 1px solid, rgba 8% | Градиентная рамка через ::before |
| **Блик** | Нет | Radial gradient overlay через ::after |
| **3D-эффект** | Минимальный | Выраженный (толстое стекло) |
| **Use case** | Панели, модалки | Карточки новостей, премиум-элементы |

---

## 6. Sentiment-система

Каждая новость имеет sentiment: **positive**, **negative** или **neutral**. Карточка адаптирует визуал под sentiment.

### 6.1 Positive (Позитив) — Зелёный

| Свойство | Значение |
|----------|----------|
| Основной цвет | `#34D399` |
| Glass background | `linear-gradient(180deg, rgba(52,211,153,0.06) 0%, rgba(52,211,153,0.02) 100%)` |
| Border default | `rgba(52, 211, 153, 0.15)` |
| Border hover | `rgba(52, 211, 153, 0.35)` |
| Glow shadow | `0 4px 20px -4px rgba(52,211,153,0.15), inset 0 -1px 0 0 rgba(52,211,153,0.1)` |
| Glow hover | `0 8px 30px -4px rgba(52,211,153,0.25), inset 0 -1px 0 0 rgba(52,211,153,0.2)` |
| Badge background | `rgba(52, 211, 153, 0.12)` |
| Иконка | TrendingUp (lucide-react) |
| Label | "Позитив" |

### 6.2 Negative (Негатив) — Красный

| Свойство | Значение |
|----------|----------|
| Основной цвет | `#EF4444` |
| Glass background | `linear-gradient(180deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 100%)` |
| Border default | `rgba(239, 68, 68, 0.15)` |
| Border hover | `rgba(239, 68, 68, 0.35)` |
| Glow shadow | `0 4px 20px -4px rgba(239,68,68,0.15), inset 0 -1px 0 0 rgba(239,68,68,0.1)` |
| Glow hover | `0 8px 30px -4px rgba(239,68,68,0.25), inset 0 -1px 0 0 rgba(239,68,68,0.2)` |
| Badge background | `rgba(239, 68, 68, 0.12)` |
| Иконка | TrendingDown (lucide-react) |
| Label | "Негатив" |

### 6.3 Neutral (Нейтрально) — Серый

| Свойство | Значение |
|----------|----------|
| Основной цвет | `#9CA3AF` |
| Glass background | `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)` |
| Border default | `rgba(255, 255, 255, 0.08)` |
| Border hover | `rgba(255, 255, 255, 0.20)` |
| Glow shadow | `0 2px 12px -4px rgba(0, 0, 0, 0.3)` |
| Glow hover | `0 4px 20px -4px rgba(0, 0, 0, 0.4)` |
| Badge background | `rgba(156, 163, 175, 0.10)` |
| Иконка | Minus (lucide-react) |
| Label | "Нейтрально" |
| **Особенность** | Bottom glow line отсутствует |

### 6.4 Визуальное сравнение

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ ═══════════ │  │ ═══════════ │  │ ═══════════ │
│  ПОЗИТИВ    │  │   НЕГАТИВ   │  │  НЕЙТРАЛЬНО │
│   🟢        │  │    🔴       │  │    ⚪        │
│  зелёный    │  │   красный   │  │   серый      │
│  glow       │  │   glow      │  │  без glow    │
└─────────────┘  └─────────────┘  └─────────────┘
```

### 6.5 VoteToast — фидбек после голосования в индексе настроения

`VoteToast` появляется внутри карточки `SentimentChartCard` в абсолютном оверлее поверх графика.

```tsx
{toast && (
  <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
    <VoteToast
      variant={toast.variant}
      message={toast.message}
      icon={toast.icon}
      withConfetti={toast.withConfetti}
      onDone={() => setToast(null)}
    />
  </div>
)}
```

| Параметр | Значение | Пояснение |
|----------|----------|-----------|
| **Позиционирование** | `absolute inset-0` | Оверлей растянут на всю карточку |
| **Z-index** | `z-50` | Toast поверх графика, S0- и S2-оверлеев |
| **Pointer events** | `pointer-events-none` | Клики проходят сквозь обёртку, не блокируют график |
| **Выравнивание** | `items-center justify-center` | Toast центрирован внутри карточки |
| **Варианты** | `sync` / `balance` / `contrarian` | Цвет рамки и иконка зависят от результата голосования |
| **Confetti** | только `sync` | 3D CSS-confetti + shockwave + ambient floaters через `createPortal` |
| **Reduced motion** | поддержка | При `prefers-reduced-motion` confetti отключается, анимации сокращаются |

#### Варианты Toast

| Вариант | Сообщение | Иконка | Цвет рамки | Эффекты |
|---------|-----------|--------|------------|---------|
| **sync** | «Вы в синхроне с настроением сообщества» | 🔥 | Брендовый синий `rgba(0,212,255,0.4)` | glowPulse + confetti |
| **balance** | «Вы держите баланс» | ⚖️ | Белый/серый `rgba(255,255,255,0.15)` | Без confetti |
| **contrarian** | «Ваше мнение отличается — вы мыслите вне рамок» | 🧠 | Фиолетовый `rgba(168,85,247,0.4)` | Без confetti |

#### Контейнер `.toast-container`

```css
.toast-container {
  display: flex;
  justify-content: center;
  z-index: 1000;
  pointer-events: none;
  perspective: 1000px;
}
```

Контейнер не имеет `position: relative` и `margin-top`, поэтому не влияет на поток и не расширяет карточку.

#### Адаптивность (мобильные)

На экранах `< 768px` размер Toast уменьшен примерно на 25%:

```css
@media (max-width: 768px) {
  .toast {
    padding: 0.75rem 1.3125rem;
    border-radius: 0.9375rem;
    font-size: 0.75rem;
    gap: 0.5625rem;
  }

  .toast-icon {
    font-size: 1rem;
  }
}
```

---

## 7. Анимации

### 7.1 Таблица всех анимаций

| Название | Длительность | Easing / Timing | Описание |
|----------|-------------|-----------------|----------|
| **newsSlideIn** | 500ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Новая карточка появляется: opacity 0→1, translateY(-12px→0), scale(0.96→1.01→1) |
| **newsGlow** | 800ms | `ease-out`, delay 200ms | Пульсирующее свечение (box-shadow) при появлении новой карточки |
| **carousel-item** (transform) | 400ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Плавное смещение карточек в карусели |
| **carousel-item** (opacity) | 350ms | `ease` | Плавное изменение прозрачности |
| **tagGlowPulse** | 1500ms | `ease-in-out`, infinite | Пульсация glow и border при загрузке тега |
| **tagShimmer** | 2000ms | `ease-in-out`, infinite | Shimmer-эффект (блик движется слева направо) |
| **tagExistGlow** | 500ms | `ease-in-out` | Одноразовое свечение при обнаружении существующего тега (янтарный) |
| **pulseTravel** | 3000ms | `linear`, infinite | Бегущая точка на PulseLine |
| **Framer Motion card** | 350ms | `[0.16, 1, 0.3, 1]` | Появление карточки через Framer Motion: opacity 0→1, y(12→0) |
| **Framer Motion stagger** | — | delay: `index * 0.06` | Последовательное появление карточек |
| **Tag enter** | spring | stiffness: 400, damping: 25 | Пружинная анимация появления тега |
| **Tag exit** | spring | stiffness: 400, damping: 25 | Уход тега: scale(0.8), opacity(0), x(-20) |

### 7.2 Ключевые кадры

#### newsSlideIn

```css
@keyframes newsSlideIn {
  0% {
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
  }
  60% {
    opacity: 1;
    transform: translateY(2px) scale(1.01);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

#### newsGlow

```css
@keyframes newsGlow {
  0% {
    box-shadow: 0 0 0 0 rgba(0, 212, 255, 0);
  }
  50% {
    box-shadow: 0 0 12px 2px rgba(0, 212, 255, 0.15);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(0, 212, 255, 0);
  }
}
```

#### tagGlowPulse

```css
@keyframes tagGlowPulse {
  0%, 100% {
    box-shadow: 0 0 4px rgba(0, 212, 255, 0.2), inset 0 0 4px rgba(0, 212, 255, 0.05);
    border-color: rgba(0, 212, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 16px rgba(0, 212, 255, 0.5), inset 0 0 8px rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.8);
  }
}
```

#### tagShimmer

```css
@keyframes tagShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Применяется через ::after с background-size: 200% 100% */
```

#### tagExistGlow

```css
@keyframes tagExistGlow {
  0% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
  50% { box-shadow: 0 0 12px rgba(245, 158, 11, 0.4); }
  100% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
}
```

#### pulseTravel

```css
@keyframes pulseTravel {
  0% { left: 0%; opacity: 0.3; }
  50% { opacity: 1; }
  100% { left: 100%; opacity: 0.3; }
}
```

---

### 7.3 Анимации VoteToast

| Название | Длительность | Easing / Timing | Описание |
|----------|-------------|-----------------|----------|
| **toastEnter** | 0.7s | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Toast появляется из-под графика: `translateY(30px) scale(0.85) rotateX(10deg)` → `translateY(0) scale(1) rotateX(0deg)` |
| **toastExit** | 0.6s | `ease-out` | Toast тихо растворяется на месте: `opacity` уменьшается, `transform` зафиксирован |
| **shineSweep** | 1.2s | `ease-out`, delay 0.3s | Блик пробегает по поверхности toast |
| **glowPulse** | 2s | `ease-in-out`, infinite | Брендовое синее glow (`#00D4FF`) у `sync`-варианта начинает пульсировать после появления |
| **shockwaveExpand** | 1.5s | `cubic-bezier(0.16, 1, 0.3, 1)` | 3 расширяющихся брендовых синих колец (`#00D4FF`) из центра toast |
| **particlePop** | 1.8–2.8s | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | 3D-траектория частицы синхрона через `translate3d` |
| **particleRotate** | 1.8–2.8s | `linear` | Вращение формы частицы по 3 осям |
| **ambientFloat** | 2–4s | `ease-out` | Лёгкие частицы поднимаются вверх и растворяются |

#### toastEnter

```css
@keyframes toastEnter {
  0%   { opacity: 0; transform: translateY(30px) scale(0.85) rotateX(10deg); }
  60%  { opacity: 1; transform: translateY(-4px) scale(1.03) rotateX(-2deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0deg); }
}
```

#### toastExit

```css
@keyframes toastExit {
  0%   { opacity: 1; transform: translateY(0) scale(1) rotateX(0deg); }
  100% { opacity: 0; transform: translateY(0) scale(1) rotateX(0deg); }
}
```

#### shineSweep

```css
.toast-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
  transform: skewX(-20deg);
  animation: shineSweep 1.2s ease-out 0.3s forwards;
}

@keyframes shineSweep {
  0%   { left: -100%; }
  100% { left: 200%; }
}
```

#### glowPulse

```css
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 8px rgba(0,212,255,0.8), 0 0 24px rgba(0,212,255,0.5), 0 0 48px rgba(0,212,255,0.15); }
  50%      { box-shadow: 0 0 16px rgba(0,212,255,1), 0 0 40px rgba(0,212,255,0.6), 0 0 80px rgba(0,212,255,0.25); }
}
```

#### particlePop

```css
@keyframes particlePop {
  0%   { opacity: 1; transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(0.3) rotateX(0) rotateY(0) rotateZ(0); }
  15%  { opacity: 1; transform: translate(-50%, -50%) translate3d(var(--tx), var(--ty), var(--tz)) scale(1.3) rotateX(var(--rx)) rotateY(var(--ry)) rotateZ(var(--rz)); }
  100% { opacity: 0; transform: translate(-50%, -50%) translate3d(var(--tx2), var(--ty2), var(--tz2)) scale(0.2) rotateX(var(--rx2)) rotateY(var(--ry2)) rotateZ(var(--rz2)); }
}
```

#### particleRotate

```css
@keyframes particleRotate {
  0%   { transform: rotateX(0) rotateY(0) rotateZ(0); }
  100% { transform: rotateX(360deg) rotateY(720deg) rotateZ(180deg); }
}
```

#### ambientFloat

```css
@keyframes ambientFloat {
  0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
  20%  { opacity: 0.8; }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0); }
}
```

#### shockwaveExpand

```css
.shockwave {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(0, 212, 255, 0.6);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.3), inset 0 0 20px rgba(0, 212, 255, 0.1);
  opacity: 0;
  animation: shockwaveExpand 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.shockwave:nth-child(2) { animation-delay: 0.15s; border-color: rgba(0, 212, 255, 0.4); }
.shockwave:nth-child(3) { animation-delay: 0.3s; border-color: rgba(0, 212, 255, 0.2); }

@keyframes shockwaveExpand {
  0%   { width: 20px; height: 20px; opacity: 0.8; border-width: 3px; }
  100% { width: 400px; height: 400px; opacity: 0; border-width: 0px; }
}
```

---

## 8. Layout

### 8.1 Размеры карточек

| Вариант | Ширина | Высота | Соотношение | Использование |
|---------|--------|--------|-------------|---------------|
| **Landscape** | `425px` | `225px` | ~16:9 (1.89:1) | Карусель 1 (UnreadNewsCarousel) — горизонтальный скролл |
| **Portrait** | `275px` | auto | Вертикальная | Карусели 2, 3 (AllNewsCarousel, GlobalNewsCarousel) — горизонтальный скролл |

### 8.2 Tailwind Config

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Примечание:** Все стили реализованы через utility-классы Tailwind и CSS Custom Properties. Секция `extend` пустая — кастомизация идёт через CSS-переменные.

### 8.3 Container

```
Max-width: 1400px (max-w-[1400px])
Center: mx-auto
Navbar padding: px-6 (24px) / md:px-12 (48px)
```

---

## 9. Feature Colors

### 9.1 Telegram

```css
.telegram {
  color: #0088CC;
  background: linear-gradient(135deg, #0088CC, #0055AA);
}
```

### 9.2 Email

```css
.email {
  color: #F59E0B;
  background: linear-gradient(135deg, #F59E0B, #D97706);
}
```

### 9.3 YuKassa

```css
.yukassa {
  background: linear-gradient(135deg, #00D4FF, #0099CC);
  color: #060606;  /* Тёмный текст на светлом градиенте */
}
```

### 9.4 Premium

```css
.premium {
  background: linear-gradient(135deg, #F59E0B, #D97706);
  /* Золотой градиент для премиум-элементов */
}
```

### 9.5 Таблица цветов фич

| Фича | Основной цвет | Градиент | Цвет текста |
|------|--------------|----------|-------------|
| **Telegram** | `#0088CC` | `#0088CC → #0055AA` | Белый |
| **Email** | `#F59E0B` | `#F59E0B → #D97706` | Белый |
| **YuKassa** | `#00D4FF` | `#00D4FF → #0099CC` | `#060606` (тёмный) |
| **Premium** | `#F59E0B` | `#F59E0B → #D97706` | Белый |
| **CTA (Начать)** | `#00D4FF` | `#00D4FF → #0099CC` | `#060606` (тёмный) |

---

## 10. CSS Utilities

### 10.1 Полный список utility-классов

```css
/* Скругление — полная pill-форма */
.rounded-pill {
  border-radius: 9999px;
}

/* Градиентный текст (белый → голубой) */
.gradient-text {
  background: linear-gradient(135deg, #ffffff 0%, #a5f3fc 50%, #00D4FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Базовый glass-эффект */
.glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Продвинутый liquid glass */
.liquid-glass {
  background: rgba(255, 255, 255, 0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(6px) saturate(140%);
  -webkit-backdrop-filter: blur(6px) saturate(140%);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 8px 32px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
}

/* Loading-состояние тега */
.tag-loading {
  animation: tagGlowPulse 1.5s ease-in-out infinite;
  position: relative;
  overflow: hidden;
}

/* Shimmer-оверлей для loading */
.tag-loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(0, 212, 255, 0.08) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: tagShimmer 2s ease-in-out infinite;
  pointer-events: none;
}

/* Одноразовое свечение существующего тега */
.tag-existing-glow {
  animation: tagExistGlow 0.5s ease-in-out;
}

/* Скрытие скроллбара */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Цветовые utility для CSS-переменных */
.text-accent-primary   { color: var(--accent-primary); }
.text-text-primary     { color: var(--text-primary); }
.text-text-secondary   { color: var(--text-secondary); }
.text-text-muted       { color: var(--text-muted); }
.text-text-success     { color: var(--text-success); }
.text-text-warning     { color: var(--text-warning); }
.text-text-error       { color: var(--text-error); }
.bg-bg-primary         { background-color: var(--bg-primary); }
.bg-bg-surface         { background-color: var(--bg-surface); }
.bg-bg-hover           { background-color: var(--bg-hover); }
.border-border-subtle  { border-color: var(--border-subtle); }
.border-border-active  { border-color: var(--border-active); }
```

---

## 11. Scrollbar и Selection

### 11.1 Кастомный скроллбар

```css
/* Ширина */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

/* Track — прозрачный */
::-webkit-scrollbar-track {
  background: transparent;
}

/* Thumb — тёмно-серый */
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

/* Thumb hover — чуть светлее */
::-webkit-scrollbar-thumb:hover {
  background: #444;
}
```

| Параметр | Значение |
|----------|----------|
| Ширина | 6px |
| Track | transparent |
| Thumb | `#333` |
| Thumb border-radius | 3px |
| Thumb hover | `#444` |

### 11.2 Selection

```css
::selection {
  background: rgba(0, 212, 255, 0.25);
  color: #fff;
}
```

| Параметр | Значение |
|----------|----------|
| Background | `rgba(0, 212, 255, 0.25)` (голубой, 25% opacity) |
| Text color | `#FFFFFF` |

---

## Приложение: Easing-функция

Проект использует одну основную easing-функцию:

```
cubic-bezier(0.16, 1, 0.3, 1)
```

Это **ease-out-expo** — быстрый старт и медленное завершение. Даёт ощущение "подпрыгивания" и мягкой посадки. Используется в:
- Появлении новых карточек (`newsSlideIn`)
- Переходах карусели (`carousel-item`)
- Framer Motion анимациях карточек

---

*Документация создана на основе кода проекта PULSE. Последнее обновление: актуальная версия.*
