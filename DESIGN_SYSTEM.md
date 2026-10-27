# PULSE — Дизайн-система

> Версия: 1.1 | Тема: Dark | Подход: Glassmorphism
> 1.1 (2026-10-27): +§12 Кнопки, +§13 Графики, +§14 Паттерны «Репорты», +§15 Спеки экранов — консолидация разовых решений из кода (Navbar), ТЗ-191/194/195 и DESIGN_SPEC §4. Контент §1–11 и Приложения не менялся.

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
12. [Кнопки](#12-кнопки)
13. [Графики (chart tokens)](#13-графики-chart-tokens)
14. [Паттерны «Репорты» (ТЗ-191/194/195)](#14-паттерны-репорты-тз-191194195)
15. [Спеки экранов](#15-спеки-экранов)

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

| Тип | Цвет | Hex | Примечание |
|-----|------|-----|------------|
| **company** (компания) | Голубой | `#00D4FF` | Цвет по умолчанию |
| **sector** (сектор) | Фиолетовый | `#A78BFA` | |
| **person** (персона) | Жёлтый | `#FBBF24` | |
| **trend** (тренд) | Зелёный | `#34D399` | |
| *остальные* (например, `commodity`) | Голубой | `#00D4FF` | Fallback на `company`, чтобы не было ошибок при неизвестных типах |

В `PopularTagsSlider.tsx` и других компонентах, использующих `TYPE_COLORS`, неизвестный `tag_type` откатывается к цвету `company`.

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

`VoteToast` вызывается внутри карточки `SentimentChartCard` в абсолютном оверлее поверх графика, но **рендерится в единый портал в `document.body`**. Это позволяет избежать конфликтов stacking context карточки и гарантировать, что confetti остаётся под glassmorphism-плашкой Toast'а.

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
| **Z-index overlay** | `z-50` | Оверлей поверх графика, S0- и S2-оверлеев |
| **Pointer events** | `pointer-events-none` | Клики проходят сквозь обёртку, не блокируют график |
| **Выравнивание** | `items-center justify-center` | Toast центрирован внутри карточки |
| **Варианты** | `sync` / `balance` / `contrarian` | Цвет рамки и иконка зависят от результата голосования |
| **Confetti** | только `sync` | 3D CSS-confetti + shockwave + ambient floaters в общем портале |
| **Reduced motion** | поддержка | При `prefers-reduced-motion` confetti отключается, анимации сокращаются |

#### Варианты Toast

| Вариант | Сообщение | Иконка | Цвет рамки | Эффекты |
|---------|-----------|--------|------------|---------|
| **sync** | «Вы в синхроне с настроением сообщества» | 🔥 | Брендовый синий `rgba(0,212,255,0.4)` | glowPulse + confetti |
| **balance** | «Вы держите баланс» | ⚖️ | Белый/серый `rgba(255,255,255,0.15)` | Без confetti |
| **contrarian** | «Ваше мнение отличается — вы мыслите вне рамок» | 🧠 | Фиолетовый `rgba(168,85,247,0.4)` | Без confetti |

#### Портал и слои (z-index layering)

`VoteToast` рендерит внутри overlay невидимый `anchorRef`, измеряет его `getBoundingClientRect()` и переносит весь UI в `document.body`:

```
body
└── .vote-toast-portal (fixed, z-index: 1000, pointer-events: none)
    ├── .vote-toast-effects (absolute, z-index: 1)
    │   ├── shockwave
    │   ├── 3D particles
    │   └── ambient floaters
    └── .vote-toast-layer (absolute, z-index: 2)
        └── .toast
```

Так как Toast и confetti находятся в одном stacking context, внутренний `z-index: 1` / `z-index: 2` однозначно определяет порядок: плашка Toast'а всегда поверх частиц, а частицы светятся сквозь прозрачный glassmorphism фон.

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

#### CSS-классы портала

```css
.vote-toast-portal {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  width: 0;
  height: 0;
}

.vote-toast-effects {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: 0;
  height: 0;
  pointer-events: none;
  perspective: 1000px;
}

.vote-toast-layer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  transform: translate(-50%, -50%);
  pointer-events: none;
  width: max-content;
}

.confetti-host {
  position: absolute;
  top: 0;
  left: 0;
  width: 500px;
  height: 500px;
  pointer-events: none;
  transform: translate(-50%, -50%);
}
```

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
| **newsCardAppear / newsFrostLift** | 1800ms | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Frost Appear — материализация карточки из тёмного тумана в каруселях 2 и 3 |
| **FLIP card shift** | 800ms | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Плавный сдвиг старых карточек вправо при появлении новой карточки слева |
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

#### Frost Appear (AllNewsCarousel)

```css
.news-appear-wrapper {
  position: relative;
  opacity: 0;
  animation: newsCardAppear 1.8s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
}

.news-frost-layer {
  position: absolute;
  inset: 0;
  border-radius: 0.75rem;
  background: linear-gradient(
    180deg,
    rgba(6, 6, 6, 0) 0%,
    rgba(6, 6, 6, 0.5) 30%,
    rgba(6, 6, 6, 0.9) 70%,
    rgba(6, 6, 6, 0.95) 100%
  );
  opacity: 1;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  pointer-events: none;
  z-index: 2;
  animation: newsFrostLift 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.news-visible-wrapper {
  opacity: 1;
}

@keyframes newsCardAppear {
  0% {
    opacity: 0;
    transform: scale(0.97);
    filter: brightness(0.3) blur(2px);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1) blur(0px);
  }
}

@keyframes newsFrostLift {
  0% {
    opacity: 1;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  100% {
    opacity: 0;
    backdrop-filter: blur(0px);
    -webkit-backdrop-filter: blur(0px);
  }
}

/* Каскадная задержка (до 5 карточек в батче) */
.news-appear-wrapper:nth-child(1) { animation-delay: 0s; }
.news-appear-wrapper:nth-child(1) .news-frost-layer { animation-delay: 0s; }

.news-appear-wrapper:nth-child(2) { animation-delay: 0.15s; }
.news-appear-wrapper:nth-child(2) .news-frost-layer { animation-delay: 0.15s; }

.news-appear-wrapper:nth-child(3) { animation-delay: 0.3s; }
.news-appear-wrapper:nth-child(3) .news-frost-layer { animation-delay: 0.3s; }

.news-appear-wrapper:nth-child(4) { animation-delay: 0.45s; }
.news-appear-wrapper:nth-child(4) .news-frost-layer { animation-delay: 0.45s; }

.news-appear-wrapper:nth-child(5) { animation-delay: 0.6s; }
.news-appear-wrapper:nth-child(5) .news-frost-layer { animation-delay: 0.6s; }
```

#### FLIP card shift

FLIP (First / Last / Invert / Play) анимирует сдвиг существующих карточек вправо, когда новая карточка появляется слева. Применяется ко 2-й ("Вся лента") и 3-й ("Общая лента") каруселям через хук `useFlipAnimation.ts`.

- **First:** запоминаем `getBoundingClientRect().left` всех видимых старых карточек.
- **Last:** после рендера новой карточки измеряем новые позиции.
- **Invert:** мгновенно сдвигаем старые карточки на `translateX(delta)` без transition.
- **Play:** включаем `transition: transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)` и анимируем к `translateX(0)`.

```css
.flip-card-shifting {
  will-change: transform;
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

---

## 12. Кнопки

### 12.1 Primary / CTA

Акцентная кнопка действия. Градиент и тёмный текст — как у строки «CTA (Начать)» в §9.5.

```css
.btn-primary {
  background: linear-gradient(135deg, #00D4FF, #0099CC);
  color: #060606;                 /* тёмный текст на светлом градиенте */
  font-weight: 600;
  border-radius: 9999px;          /* rounded-pill */
  padding: 8px 20px;              /* py-2 px-5 */
  font-size: 14px;                /* text-sm */
}
.btn-primary:hover { filter: brightness(1.15); }
```

Источник: `Navbar.tsx` (кнопка «Начать»). Переиспользуется в шапках страниц (например, «Репорты»).

### 12.2 Ghost (вторичная)

```css
.btn-ghost {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border-radius: 9999px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
}
.btn-ghost:hover { border-color: var(--border-active); }
```

Применение: «Поделиться», «Экспорт PDF», кнопки тулбаров. Переход — `all .2s easeOutExpo`.

### 12.3 Круглая liquid-glass иконочная (SoundToggle)

Единственный в системе круглый liquid-glass элемент. Паттерн: база `.liquid-glass` на `border-radius: 50%` + градиентная рамка через собственный `::before` + hover-масштаб + one-shot pulse-кольцо по клику.

```css
.sound-toggle {
  width: 38px; height: 38px;
  border-radius: 50%;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(6px) saturate(140%);
  border: none;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.12);
  transition: transform 300ms easeOutExpo, color 900ms, box-shadow 900ms;
}
.sound-toggle:hover { transform: scale(1.08); }

/* Градиентная рамка (как у .liquid-glass::before, но под круглый бейдж) */
.sound-toggle::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg,
    rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 20%,
    rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%,
    rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.5) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  mix-blend-mode: screen;
  opacity: 0.25;                  /* 0.4 при hover */
}

/* Активное (звук вкл): акцентное свечение; muted: серый */
.sound-toggle.on  { color: #00D4FF; box-shadow: inset 0 1px 1px rgba(0,212,255,0.15), 0 0 16px rgba(0,212,255,0.2), 0 4px 16px rgba(0,0,0,0.15); }
.sound-toggle.off { color: #6B7280; }
```

One-shot кольцо по клику (keyframes в `Navbar.tsx`): `pulseRingCyan 0.8s ease-out` (`0 0 0 0 rgba(0,212,255,0.4)` → расширение до 10px и растворение) / `pulseRingMuted` — красноватое для muted.

Источник: `src/components/Navbar.tsx` (SoundToggleButton). Размер иконки внутри — 20px.

### 12.4 Ссылка-опасность (admin)

Текстовая ссылка destructive-действий: `color: #EF4444` (text-error), hover `#FCA5A5`-family светлее. Применение: пункт «Админ» в навбаре, «Выйти», удаления в админке.

---

## 13. Графики (chart tokens)

Визуальные токены графического слоя (ECharts 6, `CascadeChart`/`CandleChart`, отчёты ТЗ-191/194).

### 13.1 Свечной график

| Элемент | Значение |
|---------|----------|
| Рост (бычья свеча) | `#16a34a` (color / borderColor) |
| Падение | `#dc2626` (color0 / borderColor0) |
| Фон | `transparent` (тема `dark`, backgroundColor не задан) |
| Tooltip | фон `rgba(10,10,10,0.95)`, бордер `#333`, текст `#D1D5DB` 11px |
| Сетка (splitLine) | `#1F2937` |
| Подписи осей | `#6B7280` 10px |
| Объём (bars) | `#374151` |

Источник: `src/components/cascades/CascadeChart.tsx`. Применение: реакция цены в карточке новости, каскады, графики отчёта.

### 13.2 Маркеры новостей на графике (scatter)

| Состояние | Стиль |
|-----------|-------|
| Размер | единый `symbolSize: 12` (размер ничего не кодирует) |
| Первоисточник (первая новость кластера) | `#00D4FF` + белая обводка 1.5px |
| В сессии | `rgba(0, 212, 255, 0.7)`, обводка `rgba(255,255,255,0.5)` 0.5px |
| Вне торговой сессии | `transparent` + dashed обводка `#00D4FF` 1.5px у ближайшей свечи |
| Группа на одной свече | один символ с числом (label 9px bold, цвет `#060606`) |

Источник: `CascadeChart.tsx` (ТЗ-93/97/98/106).

### 13.3 Накопительная сантимент-кривая (ТЗ-194)

Третий под-график под свечами (высота ~14% от контейнера).

| Элемент | Значение |
|---------|----------|
| Линия | step-after, stroke `#6B7280`, width 1.5 |
| Точка-перелом позитива | `#34D399` (r=2) |
| Точка-перелом негатива | `#EF4444` (r=2) |
| Нулевая линия | пунктир `#2A2A2E` |
| Подпись итога у конца | 11px/600, цвет знака; формат «итог: +N» |
| Базовая цена (пунктир-референс на свечах) | `#2A2A2E`, dasharray `3 4` |

Деградация: <2 ненейтральных новостей → панель скрыта, макет возвращается к двум гридам (как у каскадов).

### 13.4 Список событий под графиком (отчёт)

Разделитель — dashed `var(--border-subtle)`; маркер события — точка 7px `#F59E0B`; время — muted; текст — `--text-secondary` 12px.

---

## 14. Паттерны «Репорты» (ТЗ-191/194/195)

Новые блоки страницы недельного отчёта. Мокап-норматив: `сделанные тз/мокап-weekly-report/index.html`.

### 14.1 Лента недель (.week-strip)

Горизонтальный ряд pill-кнопок (scroll-x), различие «сейчас» vs «архив» — закраска.

| Состояние | Стиль |
|-----------|-------|
| Текущая неделя (.current) | `background: linear-gradient(135deg, #00D4FF, #0099CC)`, текст `#060606`, `box-shadow: 0 0 20px rgba(0,212,255,0.25)`, font-weight 600 |
| Пульс live | `.live-dot` 8px `#060606` на фоне пилюли + `::after` кольцо, `@keyframes livePulse 1.6s ease-out infinite` (scale 0.6→1.4, fade) |
| Архив (.past) | фон `rgba(255,255,255,0.03)`, бордер `rgba(255,255,255,0.08)`, текст `--text-secondary` |
| Архив активный | бордер `--border-active`, текст белый |
| Hover любой | `border-color: --border-active` (current не меняется) |

Подпись current: «Текущая неделя · 20–26 окт · идёт, N из 7 дней» (sub 12px, opacity .85).

### 14.2 Облако тегов (.tag-cloud)

Карточка `bg-surface` + `border-subtle` + `rounded-2xl`, внутри flex-wrap пилюли.

- Пилюля — конвенция §4.2 (dot цвета типа, фон `--bg-hover`, бордер типа 40%) + счётчик справа (11px, opacity .55);
- **Размер шрифта = значимость**: `font-size = 11 + (current / maxCurrent) * 6` px → диапазон 11–17px;
- Клик → плавный скролл к секции тега (anchor по tagId, `scroll-margin-top: 24px` у секций);
- Тег без секции — `opacity .45`, `cursor: default`, без hover.

### 14.3 AI-плашка (.ai-summary)

Акцентная цитата-панель (общий итог недели / итоги по тегу).

```css
.ai-summary {
  background: rgba(0, 212, 255, 0.04);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(0, 212, 255, 0.18);
  border-left: 3px solid var(--accent-primary);
  border-radius: 16px;            /* rounded-2xl */
  padding: 16px 20px;
}
.ai-summary .label {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--accent-primary);
}
.ai-summary .text { font-size: 14px; line-height: 1.65; color: #E5E7EB; }
.ai-summary .meta { font-size: 11px; color: var(--text-muted); }
```

Иконка в label — `Brain` (lucide). Подпись meta: «Сгенерировано по N новостей · дата» (модель в UI не показываем).

### 14.4 KPI-карточки

Сетка 6 колонок (900px → 3). Карточка — семейство карточек отчёта (`bg-surface`, `border-subtle`, `rounded-2xl`, padding 14/16). Первая (главный итог) — glow-вариант: `border-color: rgba(0,212,255,0.35)` + `box-shadow: 0 0 24px rgba(0,212,255,0.07)`. Дельты — иконка `ArrowUp`/`ArrowDown` 11px + значение, цвет `--text-success` / `--text-error`; «нет данных» — `--text-muted`, без иконки.

### 14.5 Чипы календаря (kind-chip)

Пилюли типов событий в блоке «Что впереди»:

| Тип | Бордер | Текст |
|-----|--------|-------|
| СД / СА (совет директоров / собрание) | `rgba(0,212,255,0.4)` | `#00D4FF` |
| МСФО / РСБУ (отчётность) | `rgba(167,139,250,0.4)` | `#A78BFA` |
| Дивиденды | `rgba(52,211,153,0.4)` | `#34D399` |
| Макро | `rgba(245,158,11,0.4)` | `#F59E0B` |

### 14.6 Premium-lock

```css
.premium-lock {
  border: 1px dashed rgba(156, 163, 175, .45);
  border-radius: 16px;
  color: var(--text-muted);
  font-size: 12.5px;
}
```

Иконка `Lock` 14px; ссылка — `--accent-primary`. Применение: AI-саммари по тегу без тарифной фичи.

---

## 15. Спеки экранов

Экранно-поведенческие спеки (перенесены из DESIGN_SPEC §4, 2026-10-27; SSOT на спеки визуала — разделы выше).

### 15.1 Home

- **Hero (адаптивная высота):** гость — `min-h-[100dvh]`, `pt-16` (immersive); залогинен — `min-h-[65dvh]`, `pt-4` (компактный).
- **Секции:** Hero (заголовок, поиск, selected tags, PulseLine) → News Timeline (если теги > 0) → Popular Tags (12 + «Добавить все») → Subscribe Block (портфели).
- **Selected tags:** flex-wrap/justify-center под поиском; удаление — AnimatePresence popLayout; новый тег — `.tag-loading` glow.
- **Гейтинг:** добавление тега без логина → логин-модал; без лимита тарифа → paywall.

### 15.2 NewsFeed (/feed)

В `<Layout>` с Navbar; «← Назад» → `/`. Теги — из `getPortfolio`, новости — `getNewsForTag`. Фильтры времени (Все/Час/Сутки/Неделя), поиск по title/source, группировка (Последний час/Сегодня/Вчера/Ранее), пустые состояния («Войдите» / «Нет тегов» / «Не найдены»).

### 15.3 Pricing (/pricing)

Standalone (X + «← Назад») или modal. Состояния: initial / processing / success / error; confetti при success; FAQ 5 вопросов.

### 15.4 Profile (/profile)

«← Назад» → `/`; удаление тега синхронизируется с БД; редактирование email/password; история платежей.

---
