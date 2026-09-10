"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
export type TileRevealDirection = "alternate" | "top" | "bottom";
export interface TileRevealProps {
  images: string[];
  headline?: ReactNode;
  children?: ReactNode;
  columns?: number;
  gap?: number;
  gridWidth?: number;
  tileAspect?: number;
  tileRadius?: number;
  grayscale?: boolean;
  direction?: TileRevealDirection;
  stagger?: number;
  overlap?: number;
  zoom?: number;
  spread?: number;
  scrollLength?: number;
  /** Буфер после финала: сколько 100svh этап остаётся приклеенным
      при уже завершённой анимации (гасит инерцию скролла).
      ЛОКАЛЬНЫЙ ПАТЧ PULSE (ТЗ-73) — при переустановке компонента из реестра затрётся. */
  endBuffer?: number;
  scrub?: number;
  contentGap?: number;
  backgroundColor?: string;
  onProgress?: (progress: number) => void;
  className?: string;
  style?: CSSProperties;
}
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const inOut = (t: number, power: number) =>
  t < 0.5
    ? Math.pow(2, power - 1) * Math.pow(t, power)
    : 1 - Math.pow(-2 * t + 2, power) / 2;
const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(media.matches);
    read();
    media.addEventListener("change", read);
    return () => media.removeEventListener("change", read);
  }, []);
  return reduced;
};
// Локальный патч PULSE (ТЗ-86): детект тач-устройств — по образцу scroll-stack
// (ТЗ-83). На тачах scrub обнуляется в цикле step (следование скроллу 1:1).
const useCoarsePointer = () => {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const read = () => setCoarse(media.matches);
    read();
    media.addEventListener("change", read);
    return () => media.removeEventListener("change", read);
  }, []);
  return coarse;
};
const TileReveal = ({
  images,
  headline,
  children,
  columns = 3,
  gap = 28,
  gridWidth = 720,
  tileAspect = 1,
  tileRadius = 0,
  grayscale = true,
  direction = "alternate",
  stagger = 0.06,
  overlap = 0.6,
  zoom = 2.05,
  spread = 0.4,
  scrollLength = 3,
  endBuffer = 0,
  scrub = 0.08,
  contentGap = 28,
  backgroundColor = "transparent",
  onProgress,
  className,
  style,
}: TileRevealProps) => {
  const reducedMotion = usePrefersReducedMotion();
  const coarse = useCoarsePointer(); // ТЗ-86
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headlineRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const shown = useRef(0);
  const painted = useRef(-1); // ТЗ-82: последний отрисованный квант прогресса
  const spin = useRef(0);
  const beat = useRef(0);
  const live = useRef(false);
  const stageWidth = useRef(0);
  const stageHeight = useRef(0);
  const gridWidthNow = useRef(0);
  const gridHeight = useRef(0);
  const revealHeight = useRef(0);
  const cols = Math.max(1, Math.round(columns));
  const count = images.length;
  const plan = useMemo(() => {
    const mid = (cols - 1) / 2;
    const lengths = Array.from({ length: cols }, (_, c) =>
      Math.floor((count - c + cols - 1) / cols),
    );
    const longest = Math.max(0, ...lengths);
    const flyEnd = longest > 0 ? 1 + (longest - 1) * stagger : 0;
    const zoomStart = Math.max(0, flyEnd - overlap);
    const splitStart = zoomStart + 0.5;
    const contentStart = zoomStart + 1 - 0.32;
    const total = Math.max(zoomStart + 1, contentStart + 0.32, 0.001);
    const tiles = Array.from({ length: count }, (_, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const len = lengths[c];
      const fromTop =
        direction === "top"
          ? true
          : direction === "bottom"
            ? false
            : c % 2 === 0;
      const order = fromTop ? len - 1 - r : r;
      const centred = Math.abs(c - mid) < 0.001;
      const lateral = centred ? 0 : Math.sign(c - mid);
      const vertical = centred ? (r < Math.floor(len / 2) ? -1 : 1) : 0;
      return {
        start: order * stagger,
        dir: fromTop ? -1 : 1,
        col: c,
        row: r,
        lateral,
        vertical,
      };
    });
    const rows = Math.ceil(count / cols);
    return { tiles, rows, mid, zoomStart, splitStart, contentStart, total };
  }, [cols, count, direction, overlap, stagger]);
  const paint = useCallback(
    (progress: number) => {
      const grid = gridRef.current;
      if (!grid) return;
      const u = progress * plan.total;
      const flyDistance = (stageHeight.current + gridHeight.current) / 2;
      const z = inOut(clamp(u - plan.zoomStart, 0, 1), 3);
      const s = inOut(clamp((u - plan.splitStart) / 0.5, 0, 1), 1);
      const reveal = inOut(clamp((u - plan.contentStart) / 0.32, 0, 1), 2);
      const scale = Math.max(zoom, 1);
      grid.style.transform = `scale(${1 + (scale - 1) * z})`;
      // ТЗ-76: в финале split (s >= 1) сетка полностью за экраном — убираем её
      // из композитного дерева, иначе iOS Safari держит тяжёлый слой и дрожит
      // при пересчёте sticky. Реверс возвращает visibility.
      grid.style.visibility = s >= 1 ? "hidden" : "visible";
      const tileW = Math.max(
        1,
        (gridWidthNow.current - gap * (cols - 1)) / cols,
      );
      const tileH = tileW / Math.max(tileAspect, 0.01);
      const pitchX = tileW + gap;
      const pitchY = tileH + gap;
      const rowMid = (plan.rows - 1) / 2;
      const clearX = (colOffset: number) =>
        Math.max(
          spread * tileW,
          stageWidth.current / (2 * scale) +
            tileW / 2 -
            Math.abs(colOffset) +
            gap,
        );
      const clearY = (rowOffset: number) =>
        Math.max(
          spread * tileH,
          stageHeight.current / (2 * scale) +
            tileH / 2 -
            Math.abs(rowOffset) +
            gap,
        );
      for (let i = 0; i < plan.tiles.length; i++) {
        const node = tileRefs.current[i];
        if (!node) continue;
        const tile = plan.tiles[i];
        const fly = inOut(clamp(u - tile.start, 0, 1), 1);
        const flyY = tile.dir * flyDistance * (1 - fly);
        const pushX = tile.lateral * clearX((tile.col - plan.mid) * pitchX) * z;
        const pushY = tile.vertical * clearY((tile.row - rowMid) * pitchY) * s;
        node.style.transform = `translate3d(${pushX.toFixed(2)}px, ${(flyY + pushY).toFixed(2)}px, 0)`;
        node.style.visibility = fly <= 0 ? "hidden" : "visible";
      }
      const head = headlineRef.current;
      if (head) {
        const lift = ((revealHeight.current + contentGap) / 2) * (1 - reveal);
        head.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0)`;
      }
      const body = revealRef.current;
      if (body) {
        body.style.opacity = reveal.toFixed(3);
        body.style.transform = `translate3d(0, ${((1 - reveal) * 12).toFixed(2)}px, 0)`;
        body.style.pointerEvents = reveal > 0.5 ? "auto" : "none";
      }
      onProgress?.(progress);
    },
    [cols, contentGap, gap, onProgress, plan, spread, tileAspect, zoom],
  );
  const measure = useCallback(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return 0;
    const rect = root.getBoundingClientRect();
    const stageH = stage.getBoundingClientRect().height;
    // ТЗ-73: буфер после финала — вычитаем из run, чтобы прогресс 1
    // достигался на той же позиции скролла, а sticky-этап держался дольше
    const run = rect.height - stageH - Math.max(endBuffer, 0) * stageH;
    if (run <= 0) return 0;
    return clamp(-rect.top / run, 0, 1);
  }, [endBuffer]);
  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const stage = stageRef.current;
    const grid = gridRef.current;
    if (!root || !stage || !grid) return;
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;
    // ТЗ-86: на тачах вязкость убираем — следование скроллу 1:1 в том же кадре
    // (lag=0 → pull=1), иначе при обрыве iOS-инерции прогресс схлопывается
    // не монотонно — упругий отскок сетки на 2–3px.
    const lag = coarse ? 0 : Math.max(scrub, 0);
    const step = (now: number) => {
      const last = beat.current || now;
      const delta = Math.min(0.05, Math.max(0, (now - last) / 1000));
      beat.current = now;
      const target = measure();
      const pull = lag > 0 ? 1 - Math.exp(-delta / lag) : 1;
      const next = shown.current + (target - shown.current) * pull;
      shown.current = next;
      // ТЗ-82: квантуем прогресс до 0,001 — хвост догонялки в доли
      // физического пикселя на Retina @3x дрожит из-за округления браузера;
      // совпавший квант в DOM не пишем.
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
    let primed = false; // ТЗ-76: снап прогресса только на первом settle
    const settle = () => {
      const stageBox = stage.getBoundingClientRect();
      stageWidth.current = stageBox.width;
      stageHeight.current = stageBox.height;
      gridWidthNow.current = grid.offsetWidth;
      gridHeight.current = grid.offsetHeight;
      revealHeight.current = revealRef.current?.offsetHeight ?? 0;
      if (!primed) {
        primed = true;
        shown.current = measure(); // снап только на старте (загрузка посреди сцены)
      }
      paint(shown.current); // последующие settle — только геометрия, прогресс доезжает lerp-циклом
    };
    settle();
    view.addEventListener("scroll", wake, { passive: true });
    doc.addEventListener("scroll", wake, { passive: true, capture: true });
    view.addEventListener("resize", settle);
    view.addEventListener("pageshow", settle);
    const watch = new ResizeObserver(settle);
    watch.observe(root);
    watch.observe(stage);
    watch.observe(grid);
    if (revealRef.current) watch.observe(revealRef.current);
    return () => {
      view.cancelAnimationFrame(spin.current);
      live.current = false;
      view.removeEventListener("scroll", wake);
      doc.removeEventListener("scroll", wake, { capture: true });
      view.removeEventListener("resize", settle);
      view.removeEventListener("pageshow", settle);
      watch.disconnect();
    };
  }, [measure, paint, reducedMotion, scrub, coarse]);
  const rootStyle = useMemo<CSSProperties>(
    () => ({
      height: reducedMotion
        ? undefined
        : `${((1 + Math.max(scrollLength, 0) + Math.max(endBuffer, 0)) * 100).toFixed(2)}svh`,
      ...style,
    }),
    [reducedMotion, scrollLength, endBuffer, style],
  );
  const tileStyle = useMemo<CSSProperties>(
    () => ({
      aspectRatio: `${tileAspect}`,
      borderRadius: `${tileRadius}px`,
    }),
    [tileAspect, tileRadius],
  );
  const content = (
    <div
      className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center"
      style={{ gap: `${contentGap}px` }}
    >
      {headline !== undefined && (
        <div
          ref={headlineRef}
          className="will-change-transform [backface-visibility:hidden]"
        >
          {headline}
        </div>
      )}
      {children !== undefined && (
        <div
          ref={revealRef}
          className="will-change-transform [backface-visibility:hidden]"
          style={reducedMotion ? undefined : { opacity: 0 }}
        >
          {children}
        </div>
      )}
    </div>
  );
  if (reducedMotion) {
    return (
      <section
        ref={rootRef}
        className={cn("relative w-full overflow-hidden", className)}
        style={{ ...rootStyle, height: "100svh", background: backgroundColor }}
      >
        {content}
      </section>
    );
  }
  return (
    <section
      ref={rootRef}
      className={cn("relative w-full", className)}
      style={rootStyle}
    >
      <div
        ref={stageRef}
        className="sticky top-0 w-full overflow-hidden"
        style={{ height: "100svh", background: backgroundColor }}
      >
        {content}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: `min(${gridWidth}px, calc(100% - ${gap * 2}px))` }}
        >
          <div
            ref={gridRef}
            className="grid will-change-transform"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: `${gap}px`,
            }}
          >
            {images.map((src, i) => (
              <div
                key={`${src}-${i}`}
                ref={(node) => {
                  tileRefs.current[i] = node;
                }}
                className="w-full overflow-hidden will-change-transform [backface-visibility:hidden]"
                style={{ ...tileStyle, visibility: "hidden" }}
              >
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  className={cn(
                    "h-full w-full select-none object-cover",
                    grayscale && "grayscale",
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
export default TileReveal;
