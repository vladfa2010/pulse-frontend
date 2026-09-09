"use client";

// Локальные патчи PULSE: тёмная тема карточки, типографика, акцентное свечение
// (ТЗ-77); pinned-заголовок через prop header (ТЗ-78); top-anchored контент
// карточки (ТЗ-79); компактная сцена — высота сцены и marginTop колоды зашиты
// под кегль заголовка clamp(32px,5.33vw,64px) из HomeScrollStack, менять
// синхронно (ТЗ-80); prop background — фон сцены с гейтингом по вьюпорту и
// reduced-motion (ТЗ-81). Переустановка из реестра затрёт — см. docs/home.md
// (раздел ScrollStack).

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type ScrollStackVariant =
  "stack" | "deck" | "fade" | "flip" | "zoom" | "reveal";

export interface ScrollStackItem {
  /** Small kicker printed above the heading */
  eyebrow?: string;
  /** Card heading */
  title?: string;
  /** Supporting line under the heading */
  body?: string;
  /** Background image URL */
  image?: string;
  /** Colour used for the kicker and the matching progress tick */
  accent?: string;
}

export interface ScrollStackProps {
  /** Cards rendered by the built-in layout */
  items?: ScrollStackItem[];
  /** Custom cards, one per child, replacing the built-in layout */
  children?: ReactNode;
  /** Pinned heading rendered inside the sticky stage (PULSE patch, ТЗ-78) */
  header?: ReactNode;
  /** Background layer rendered behind the cards (PULSE patch, ТЗ-81/84: монтируется один раз при первом приближении сцены — дальше keep-alive; не монтируется при prefers-reduced-motion) */
  background?: ReactNode;
  /** Which stacking animation to run */
  variant?: ScrollStackVariant;
  /** Viewport heights of scrolling assigned to each card */
  scrollLength?: number;
  /** Pixels a covered card slides up so its edge peeks out */
  peek?: number;
  /** How much a covered card shrinks per step from 0 to 1 */
  scaleStep?: number;
  /** Maximum blur in pixels applied to covered cards */
  blur?: number;
  /** How far covered cards darken from 0 to 1 */
  dim?: number;
  /** Scroll follow damping from 0 for instant to 1 for very loose */
  smooth?: number;
  /** How many covered cards stay mounted behind the active one */
  depth?: number;
  /** Maximum card width in pixels */
  cardWidth?: number;
  /** Card height as a fraction of the viewport */
  cardHeight?: number;
  /** Corner radius of the cards in pixels */
  borderRadius?: number;
  /** Perspective depth in pixels used by the turning variants */
  perspective?: number;
  /** Show the segmented progress rail */
  showProgress?: boolean;
  /** Show the numeric counter */
  showCounter?: boolean;
  /** Fired whenever the frontmost card changes */
  onIndexChange?: (index: number) => void;
  /** Extra classes for the outer section */
  className?: string;
}

const DEFAULT_ITEMS: ScrollStackItem[] = [
  {
    eyebrow: "01. Survey",
    title: "Read the site before it exists",
    body: "Sightlines, prevailing wind and the path of the sun set the footprint long before a wall is drawn.",
    image:
      "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1200&auto=format&fit=crop",
    accent: "#9bd1ff",
  },
  {
    eyebrow: "02. Massing",
    title: "Volume answers to light",
    body: "Blocks are pushed and pulled until every occupied room borrows daylight from two directions.",
    image:
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?q=80&w=1200&auto=format&fit=crop",
    accent: "#ffd9a0",
  },
  {
    eyebrow: "03. Structure",
    title: "A grid you can feel",
    body: "The frame is tuned so the span reads as calm repetition rather than raw engineering.",
    image:
      "https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?q=80&w=1200&auto=format&fit=crop",
    accent: "#c7b8ff",
  },
  {
    eyebrow: "04. Envelope",
    title: "Skin that keeps its temper",
    body: "Glass, shade and thermal mass are balanced until the building holds steady without working hard.",
    image:
      "https://images.unsplash.com/photo-1470075801209-17f9ec0cada6?q=80&w=1200&auto=format&fit=crop",
    accent: "#a8e6cf",
  },
  {
    eyebrow: "05. Detail",
    title: "The last millimetre",
    body: "Reveals, shadow gaps and junctions decide whether the whole thing looks considered or merely finished.",
    image:
      "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?q=80&w=1200&auto=format&fit=crop",
    accent: "#ffb3ba",
  },
];

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const glide = (t: number) => t * t * (3 - 2 * t);

interface Shot {
  transform: string;
  opacity: number;
  filter: string;
  clip: string;
}

interface Recipe {
  peek: number;
  scaleStep: number;
  blur: number;
  dim: number;
  radius: number;
  enter: number;
}

const shade = (v: number, dim: number, blur: number) => {
  const parts: string[] = [];
  if (blur > 0.01) parts.push(`blur(${(v * blur).toFixed(2)}px)`);
  if (dim > 0.001) parts.push(`brightness(${(1 - v * dim).toFixed(3)})`);
  return parts.length ? parts.join(" ") : "none";
};

const pose = (
  variant: ScrollStackVariant,
  offset: number,
  index: number,
  cfg: Recipe,
): Shot => {
  const full = `inset(0 0 0 0 round ${cfg.radius}px)`;
  const lean = index % 2 === 0 ? 1 : -1;

  if (offset < 0) {
    const u = clamp(offset + 1, 0, 1);
    const e = glide(u);
    switch (variant) {
      case "fade":
        return {
          transform: `translate3d(0,0,0) scale(${(1.06 - 0.06 * e).toFixed(2)})`,
          opacity: e,
          filter: "none",
          clip: full,
        };
      case "flip":
        return {
          transform: `translate3d(0,${((1 - e) * 26).toFixed(2)}%,0) rotateX(${((1 - e) * -72).toFixed(2)}deg)`,
          opacity: clamp(e * 1.6, 0, 1),
          filter: "none",
          clip: full,
        };
      case "zoom":
        return {
          transform: `translate3d(0,0,0) scale(${(0.52 + 0.48 * e).toFixed(2)})`,
          opacity: clamp(e * 1.4, 0, 1),
          filter:
            cfg.blur > 0.01
              ? `blur(${((1 - e) * cfg.blur).toFixed(2)}px)`
              : "none",
          clip: full,
        };
      case "reveal":
        return {
          transform: "translate3d(0,0,0)",
          opacity: 1,
          filter: "none",
          clip: `inset(${((1 - u) * 100).toFixed(2)}% 0 0 0 round ${cfg.radius}px)`,
        };
      case "deck":
        return {
          transform: `translate3d(0,${((1 - u) * (cfg.enter + 6)).toFixed(2)}%,0) rotate(${((1 - e) * 4 * lean).toFixed(2)}deg)`,
          opacity: 1,
          filter: "none",
          clip: full,
        };
      default:
        return {
          transform: `translate3d(0,${((1 - u) * cfg.enter).toFixed(2)}%,0)`,
          opacity: 1,
          filter: "none",
          clip: full,
        };
    }
  }

  const v = offset;
  const e = glide(clamp(v, 0, 1));
  switch (variant) {
    case "fade":
      return {
        transform: `translate3d(0,0,0) scale(${(1 - e * 0.06).toFixed(2)})`,
        opacity: 1 - e,
        filter: shade(e, cfg.dim, cfg.blur),
        clip: full,
      };
    case "flip":
      return {
        transform: `translate3d(0,${(-e * 26).toFixed(2)}%,0) rotateX(${(e * 72).toFixed(2)}deg)`,
        opacity: 1 - e,
        filter: shade(e, cfg.dim, 0),
        clip: full,
      };
    case "zoom":
      return {
        transform: `translate3d(0,0,0) scale(${(1 + e * 0.42).toFixed(2)})`,
        opacity: 1 - e,
        filter:
          cfg.blur > 0.01
            ? `blur(${(e * cfg.blur * 1.4).toFixed(2)}px)`
            : "none",
        clip: full,
      };
    case "reveal":
      return {
        transform: `translate3d(0,${(-v * cfg.peek * 0.5).toFixed(2)}px,0) scale(${(1 - v * cfg.scaleStep * 0.7).toFixed(2)})`,
        opacity: 1,
        filter: shade(v, cfg.dim, cfg.blur),
        clip: full,
      };
    case "deck":
      return {
        transform: `translate3d(0,${(-v * cfg.peek * 0.75).toFixed(2)}px,0) rotate(${(v * 4.5 * lean).toFixed(2)}deg) scale(${(1 - v * cfg.scaleStep * 0.85).toFixed(2)})`,
        opacity: 1,
        filter: shade(v, cfg.dim, cfg.blur),
        clip: full,
      };
    default:
      return {
        transform: `translate3d(0,${(-v * cfg.peek).toFixed(2)}px,0) scale(${(1 - v * cfg.scaleStep).toFixed(2)})`,
        opacity: 1,
        filter: shade(v, cfg.dim, cfg.blur),
        clip: full,
      };
  }
};

export const ScrollStack = ({
  items = DEFAULT_ITEMS,
  children,
  header,
  background,
  variant = "stack",
  scrollLength = 1,
  peek = 26,
  scaleStep = 0.07,
  blur = 4,
  dim = 0.28,
  smooth = 0.16,
  depth = 3,
  cardWidth = 880,
  cardHeight = 0.68,
  borderRadius = 22,
  perspective = 1400,
  showProgress = true,
  showCounter = true,
  onIndexChange,
  className,
}: ScrollStackProps) => {
  const custom = useMemo(
    () => Children.toArray(children).filter((node) => isValidElement(node)),
    [children],
  );
  const cards = custom.length > 0 ? custom : items;
  const count = cards.length;

  const rootRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dimRefs = useRef<(HTMLSpanElement | null)[]>([]); // ТЗ-83: оверлей затемнения на тачах
  const railRef = useRef<HTMLSpanElement | null>(null);
  const shown = useRef(0);
  const painted = useRef(-1); // ТЗ-82: последний отрисованный квант прогресса
  const beat = useRef(0);
  const spin = useRef(0);
  const live = useRef(false);
  const seen = useRef(-1);
  const report = useRef(onIndexChange);

  const [lead, setLead] = useState(0);
  const [calm, setCalm] = useState(false);
  const [stageVisible, setStageVisible] = useState(false);

  // ТЗ-81/84: фон (WebGL) монтируем лениво — но только ОДИН раз, при первом
  // приближении сцены к вьюпорту (+1 экран). Дальше keep-alive: размонтирование
  // канваса при уходе за кадр и его пересоздание посреди скролла (новый WebGL-
  // контекст + компиляция шейдеров) давали видимый рывок на iPhone. Плата —
  // постоянный rAF/GPU, смягчено облегчённым рендером в black-hole.tsx (ТЗ-84).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !background) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStageVisible(true);
          io.disconnect(); // защёлка: больше не наблюдаем
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(stage);
    return () => io.disconnect();
  }, [background]);

  useEffect(() => {
    report.current = onIndexChange;
  }, [onIndexChange]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setCalm(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // ТЗ-83: на тач-устройствах filter (blur/brightness) не анимируем —
  // Safari не выносит его на композитор и перерисовывает слои каждый кадр
  // (микро-фризы при наезжании карточек). Затемнение там делаем оверлеем.
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const recipe = useMemo<Recipe>(
    () => ({
      peek: Math.max(0, peek),
      scaleStep: clamp(scaleStep, 0, 0.4),
      blur: calm || coarse ? 0 : Math.max(0, blur),
      dim: clamp(dim, 0, 1),
      radius: Math.max(0, borderRadius),
      enter: ((1 + 1 / clamp(cardHeight, 0.2, 0.95)) / 2) * 100 + 3,
    }),
    [peek, scaleStep, blur, dim, borderRadius, calm, coarse, cardHeight],
  );

  const paint = useCallback(
    (progress: number) => {
      const keep = Math.max(1, Math.round(depth));
      for (let i = 0; i < count; i += 1) {
        const slot = slotRefs.current[i];
        if (!slot) continue;
        const offset = progress - i;
        if (offset < -1.0005 || offset > keep) {
          if (slot.style.visibility !== "hidden") {
            slot.style.visibility = "hidden";
          }
          continue;
        }
        if (slot.style.visibility === "hidden") slot.style.visibility = "";
        const shot = pose(variant, offset, i, recipe);
        slot.style.transform = shot.transform;
        slot.style.opacity = shot.opacity.toFixed(2);
        // ТЗ-83: на тачах filter не пишем вообще (none), затемнение — оверлей
        slot.style.filter = coarse ? "none" : shot.filter;
        slot.style.clipPath = shot.clip;
        // ТЗ-83: та же кривая, что у brightness в pose() (без glide) —
        // opacity-only, уходит на композитор
        const dimNode = dimRefs.current[i];
        if (dimNode) {
          dimNode.style.opacity = (
            coarse && offset > 0 ? Math.min(offset, 1) * dim : 0
          ).toFixed(2);
        }
      }
      if (railRef.current && count > 1) {
        const ratio = clamp(progress / (count - 1), 0, 1);
        railRef.current.style.transform = `scaleX(${ratio.toFixed(2)})`;
      }
      const front = clamp(Math.round(progress), 0, count - 1);
      if (front !== seen.current) {
        seen.current = front;
        setLead(front);
        report.current?.(front);
      }
    },
    [count, depth, recipe, variant, coarse, dim],
  );

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root || count < 1) return 0;
    const stage = stageRef.current;
    if (!stage) return 0;
    const box = root.getBoundingClientRect();
    const span = box.height - stage.offsetHeight; // ТЗ-80: размах по высоте сцены, не вьюпорта
    if (span <= 0) return 0;
    return clamp(-box.top / span, 0, 1) * (count - 1);
  }, [count]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;

    const ease = calm ? 0 : clamp(smooth, 0, 0.95);

    const step = (stamp: number) => {
      const last = beat.current || stamp;
      const delta = Math.min(0.05, Math.max(0, (stamp - last) / 1000));
      beat.current = stamp;

      const target = measure();
      const from = shown.current;
      const pull = ease > 0 ? 1 - Math.pow(1 - ease, delta * 60) : 1;
      const next = from + (target - from) * pull;
      shown.current = next;
      // ТЗ-82: квантуем прогресс до 0,001 — хвост догонялки в доли
      // физического пикселя на Retina @3x дрожит из-за округления браузера;
      // совпавший квант в DOM не пишем (рестайлов в разы меньше).
      const q = Math.round(next * 1000) / 1000;
      if (q !== painted.current) {
        painted.current = q;
        paint(q);
      }

      if (Math.abs(target - next) > 0.0015) {
        spin.current = view.requestAnimationFrame(step);
      } else {
        shown.current = target;
        painted.current = Math.round(target * 1000) / 1000;
        paint(target);
        live.current = false;
      }
    };

    const wake = () => {
      if (live.current) return;
      live.current = true;
      beat.current = 0;
      spin.current = view.requestAnimationFrame(step);
    };

    shown.current = measure();
    paint(shown.current);

    view.addEventListener("scroll", wake, { passive: true });
    doc.addEventListener("scroll", wake, { passive: true, capture: true });
    view.addEventListener("resize", wake);

    const watch = new ResizeObserver(wake);
    watch.observe(root);

    return () => {
      view.cancelAnimationFrame(spin.current);
      live.current = false;
      view.removeEventListener("scroll", wake);
      doc.removeEventListener("scroll", wake, { capture: true });
      view.removeEventListener("resize", wake);
      watch.disconnect();
    };
  }, [measure, paint, smooth, calm]);

  // ТЗ-80: высота КОНТЕНТА сцены = navbar-отступ + заголовок + зазор 21vh +
  // карточка + зона рейла. Из неё считается ранвей секции (компактный хвост
  // после финала). Сама sticky-сцена ниже — снова 100vh, чтобы рейл/счётчик
  // стояли у нижнего края ЭКРАНА, а не под карточкой.
  // ВНИМАНИЕ: кегль заголовка (clamp(32px,5.33vw,64px)) продублирован из
  // HomeScrollStack HEADING — меняется там → менять и здесь (см. docs/home.md).
  const cardVh = clamp(cardHeight, 0.2, 0.95) * 100;
  const stageH =
    `calc(4rem + env(safe-area-inset-top, 0px) + 20px` +
    ` + (clamp(32px, 5.33vw, 64px) * 1.05) + 21vh + ${cardVh}vh + 64px)`;
  const runwayScroll = Math.max(0, count - 1) * Math.max(0.2, scrollLength) * 100;

  return (
    <section
      ref={rootRef}
      aria-label="Инструменты PULSE"
      className={cn("relative w-full", className)}
      style={{ height: `calc(${stageH} + ${runwayScroll}vh)` }}
    >
      <div
        ref={stageRef}
        className="sticky top-0 flex w-full items-start justify-center overflow-hidden px-4 sm:px-8"
        style={{ height: '100vh', perspective: `${Math.max(200, perspective)}px` }}
      >
        {background && !calm && stageVisible && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {background}
          </div>
        )}
        {header && (
          <div
            className="pointer-events-none absolute inset-x-0 z-[60] flex justify-center px-6"
            style={{ top: 'calc(4rem + env(safe-area-inset-top) + 20px)' }}
          >
            {header}
          </div>
        )}
        <div
          className="relative w-full"
          style={{
            maxWidth: `${Math.max(200, cardWidth)}px`,
            height: `${clamp(cardHeight, 0.2, 0.95) * 100}vh`,
            marginTop:
              'calc(4rem + env(safe-area-inset-top, 0px) + 20px' +
              ' + (clamp(32px, 5.33vw, 64px) * 1.05) + 21vh)', // ТЗ-80: заголовок + зазор
          }}
        >
          {cards.map((card, index) => (
            <div
              key={index}
              ref={(node) => {
                slotRefs.current[index] = node;
              }}
              className="absolute inset-0 [backface-visibility:hidden] [transform-style:preserve-3d] [will-change:transform,opacity]"
              style={{ zIndex: index }}
            >
              {custom.length > 0 ? (
                (card as ReactNode)
              ) : (
                <Face
                  item={card as ScrollStackItem}
                  index={index}
                  total={count}
                  radius={recipe.radius}
                />
              )}
              {/* ТЗ-83: на тачах затемнение накрытой карточки — этим оверлеем
                  (opacity, композитор), а не filter: brightness() */}
              <span
                ref={(node) => {
                  dimRefs.current[index] = node;
                }}
                className="pointer-events-none absolute inset-0 bg-black"
                style={{ opacity: 0, borderRadius: `${recipe.radius}px` }}
                aria-hidden="true"
              />
            </div>
          ))}
        </div>

        {(showProgress || showCounter) && count > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-center gap-4 px-6">
            {showProgress && (
              <span className="relative h-px w-28 overflow-hidden bg-current/20 sm:w-44">
                <span
                  ref={railRef}
                  className="absolute inset-0 origin-left bg-current"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>
            )}
            {showCounter && (
              <span className="text-[11px] font-medium tabular-nums tracking-widest opacity-60">
                {String(lead + 1).padStart(2, "0")} /{" "}
                {String(count).padStart(2, "0")}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const Face = ({
  item,
  index,
  total,
  radius,
}: {
  item: ScrollStackItem;
  index: number;
  total: number;
  radius: number;
}) => (
  <article
    className="relative flex h-full w-full flex-col justify-start overflow-hidden border border-white/15 bg-[#0E0E0E] shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)]"
    style={{ borderRadius: `${radius}px` }}
  >
    {item.accent && !item.image && (
      <span
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(120% 90% at 50% -20%, ${item.accent}26 0%, transparent 55%)` }}
      />
    )}
    {item.image && (
      <>
        <img
          src={item.image}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      </>
    )}

    <span
      className={cn(
        "absolute right-5 top-5 text-[11px] font-medium tabular-nums tracking-widest sm:right-7 sm:top-7",
        item.image ? "text-white/55" : "text-white/50",
      )}
    >
      {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
    </span>

    <div className="relative flex flex-col gap-[10px] px-8 pb-6 pt-5 max-sm:px-[18px] max-sm:pb-[18px] max-sm:pt-[14px]">
      {item.eyebrow && (
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.2em]",
            !item.accent &&
              (item.image
                ? "text-white/70"
                : "text-neutral-500 dark:text-neutral-400"),
          )}
          style={item.accent ? { color: item.accent } : undefined}
        >
          {item.eyebrow}
        </span>
      )}
      {item.title && (
        <h3
          className={cn(
            "text-balance text-[clamp(22px,2.6vw,30px)] font-medium leading-[1.15] tracking-tight",
            item.image ? "text-white" : "text-white",
          )}
        >
          {item.title}
        </h3>
      )}
      {item.body && (
        <p
          className={cn(
            "max-w-[64ch] text-[14px] leading-[1.6]",
            item.image
              ? "text-white/70"
              : "text-[#9CA3AF]",
          )}
        >
          {item.body}
        </p>
      )}
    </div>
  </article>
);

export default ScrollStack;
