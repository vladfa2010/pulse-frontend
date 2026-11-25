/**
 * =============================================================================
 * PULSE — «Ритм рынков»: ядро виджета (порт эталона ТЗ-194, раздел 3)
 * =============================================================================
 *
 * Логика эталона — контракт: формулы/константы разделов 6–7 ТЗ-194 перенесены
 * дословно. Допустимые адаптации (по ТЗ «нативная встройка»):
 *   (а) поиск элементов внутри контейнера (root), не document;
 *   (б) cleanup: init возвращает destroy() — отмена rAF и слушателей (unmount);
 *   (в) идемпотентность под StrictMode: destroy полностью снимает слушателей,
 *       повторный init пересобирает DOM строк списка (innerHTML = '' в начале).
 * Не перенесено (по ТЗ): собственный <header> виджета (h1, часы, badge) —
 * заголовок есть у страницы; футер — caption-паттерном страницы.
 */

const MAP_ROWS = [
'........................................................................................................................',
'........................................................................................................................',
'..............................#########.##.#########....................................................................',
'............................#######...################.........####........................##...........................',
'...................###.#..#.#####....################...........................###........#.#####........#.............',
'..................####..#.###.#.###......############.........................#........#############.##...##............',
'......#####......##..#####..#.#######.....###########..............###............##.############################.......',
'##...############################.#.###...#######................##########.########.###################################',
'......###########################.####....####.......##........####.###################################################.',
'.....########################.....###......###................####.#############################################.#####..',
'.......##.....###############.....###.#...................#...#.##..#######################################...#..#......',
'.....#..........#################.######.................##.....#..######################################.......##......',
'.................################.#######................###################################################....#.......',
'..................###################...##.................#################################################............',
'...................#####################...................#############.####.############################..............',
'..................###################....................#####.##.###....###.############################..##...........',
'..................#################......................###.....###.###############################.##...#.............',
'...................################......................###....#..#.########.#######################.#..##.............',
'....................##############........................#####.........############################...###..............',
'.....................############........................#########.##.###############################..#................',
'.......................#####....#.......................####################.########################...................',
'......................#.###............................######################.#.####################....................',
'.........................##.....##....................##################.#######...###############......................',
'.........................###..#.....#.................##################.######.....####...####.#.......................',
'...........................###........................###################.###.......###....#####....#...................',
'..............................##......................######################.........##......###....#...................',
'...............................#...#####...............######################........##........#...#.#..................',
'..................................#######...............#####################.........#.............##..................',
'..................................#########....................#############................##....##....................',
'..................................#########....................############..................##.###.###.................',
'.................................############..................###########...................##..##.#...#...............',
'.................................###############................#########.....................#.....#....####.#.........',
'.................................###############................#########.......................##........###...........',
'..................................##############................#########..................................#............',
'..................................#############.................##########..#..........................##..#............',
'....................................###########.................#########..##........................#####.##..........#',
'.....................................##########.................########...##.......................#########...........',
'.....................................#########...................#######..##......................############..........',
'....................................########.....................######...........................#############.........',
'....................................########.....................######...........................#############.........',
'....................................#######.......................####............................#####.#######.........',
'....................................######........................#................................#......####.......#..',
'...................................######..................................................................###........##',
'...................................####..............................................................................##.',
'...................................###..............................................................................##..',
'...................................###..................................................................................',
'...................................##...................................................................................',
'...................................##...................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
'........................................................................................................................',
];

/* lat, lon — для карты; tz — IANA (сам учитывает летнее/зимнее время);
   open/close — локальное время основной сессии; days — 1=пн … 7=вс */
interface Exchange {
  id: string; name: string; codes: string; tz: string | null;
  open: string | null; close: string | null; days: number[];
  lat: number | null; lon: number | null; always?: boolean;
  _x?: number; _y?: number; _row?: HTMLElement;
}
const EXCHANGES: Exchange[] = [
 {id:'wlg', name:'Веллингтон', codes:'NZX',        tz:'Pacific/Auckland',   open:'10:00', close:'16:45', days:[1,2,3,4,5], lat:-41.3, lon:174.8},
 {id:'syd', name:'Сидней',     codes:'ASX',        tz:'Australia/Sydney',   open:'10:00', close:'16:00', days:[1,2,3,4,5], lat:-33.9, lon:151.2},
 {id:'tyo', name:'Токио',      codes:'TSE',        tz:'Asia/Tokyo',       open:'09:00', close:'15:00', days:[1,2,3,4,5], lat:35.7,  lon:139.7},
 {id:'sha', name:'Шанхай',     codes:'SSE',        tz:'Asia/Shanghai',    open:'09:30', close:'15:00', days:[1,2,3,4,5], lat:31.2,  lon:121.5},
 {id:'hkg', name:'Гонконг',    codes:'HKEX',       tz:'Asia/Hong_Kong',   open:'09:30', close:'16:00', days:[1,2,3,4,5], lat:22.3,  lon:114.2},
 {id:'sin', name:'Сингапур',   codes:'SGX',        tz:'Asia/Singapore',   open:'09:00', close:'17:00', days:[1,2,3,4,5], lat:1.35,  lon:103.8},
 {id:'dxb', name:'Дубай',      codes:'DFM',        tz:'Asia/Dubai',       open:'10:00', close:'14:00', days:[0,1,2,3,4], lat:25.2,  lon:55.3},
 {id:'msc', name:'Москва',     codes:'MOEX',       tz:'Europe/Moscow',    open:'09:00', close:'19:00', days:[1,2,3,4,5], lat:55.75, lon:37.6},
 {id:'jhb', name:'Иоханнесбург',codes:'JSE',       tz:'Africa/Johannesburg',open:'09:00', close:'17:00', days:[1,2,3,4,5], lat:-26.2, lon:28.0},
 {id:'fra', name:'Франкфурт',  codes:'XETRA',      tz:'Europe/Berlin',    open:'09:00', close:'17:30', days:[1,2,3,4,5], lat:50.1,  lon:8.7},
 {id:'zrh', name:'Цюрих',      codes:'SIX',        tz:'Europe/Zurich',    open:'09:00', close:'17:30', days:[1,2,3,4,5], lat:47.4,  lon:8.5},
 {id:'par', name:'Париж',      codes:'EURONEXT',   tz:'Europe/Paris',     open:'09:00', close:'17:30', days:[1,2,3,4,5], lat:48.9,  lon:2.35},
 {id:'lon', name:'Лондон',     codes:'LSE',        tz:'Europe/London',    open:'08:00', close:'16:30', days:[1,2,3,4,5], lat:51.5,  lon:-0.13},
 {id:'nyc', name:'Нью-Йорк',   codes:'NYSE',       tz:'America/New_York', open:'09:30', close:'16:00', days:[1,2,3,4,5], lat:40.7,  lon:-74.0},
 {id:'tor', name:'Торонто',    codes:'TSX',        tz:'America/Toronto',  open:'09:30', close:'16:00', days:[1,2,3,4,5], lat:43.7,  lon:-79.4},
 {id:'chi', name:'Чикаго',     codes:'CME · CBOT', tz:'America/Chicago',  open:'08:30', close:'15:00', days:[1,2,3,4,5], lat:41.9,  lon:-87.6},
 {id:'cry', name:'Крипторынок',codes:'24/7',       tz:null, open:null, close:null, days:[1,2,3,4,5,6,7], lat:null, lon:null, always:true},
];

const MIN = 60000, DAY = 86400000;
const DOW_RU = ['вс','пн','вт','ср','чт','пт','сб'];

/* ================= ВРЕМЯ ================= */
const fmtCache: Record<string, Intl.DateTimeFormat> = {};
interface Wall { dow: number; h: number; m: number; s: number; y: number; mo: number; d: number; min: number }
function wallClock(date: Date, tz: string | null): Wall {
  const key = tz || 'UTC';
  if(!fmtCache[key]) fmtCache[key] = new Intl.DateTimeFormat('en-GB',
    {timeZone:key, hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit',
     weekday:'short', hour:'2-digit', minute:'2-digit', second:'2-digit'});
  const p: Record<string, string> = {};
  for(const part of fmtCache[key].formatToParts(date)) p[part.type] = part.value;
  const dowMap: Record<string, number> = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return { dow:dowMap[p.weekday], h:+p.hour, m:+p.minute, s:+p.second, y:+p.year, mo:+p.month, d:+p.day,
           min:(+p.hour)*60 + (+p.minute) };
}
function isOpen(ex: Exchange, date: Date): boolean {
  if(ex.always) return true;
  if(!ex.tz || !ex.open || !ex.close) return false;
  const w = wallClock(date, ex.tz);
  if(!ex.days.includes(w.dow)) return false;
  const [oh,om] = ex.open.split(':').map(Number);
  const [ch,cm] = ex.close.split(':').map(Number);
  return w.min >= oh*60+om && w.min < ch*60+cm;
}
function fmtCD(ms: number): string {
  const t = Math.max(0, ms);
  const h = Math.floor(t/3600000), m = Math.floor(t%3600000/60000);
  return h>0 ? `${h} ч ${String(m).padStart(2,'0')} м` : `${m} м`;
}

/* ================= ЧИСТЫЕ РЕАЛИЗАЦИИ (переопределяют черновики выше) ================= */
function tzOffsetMs(date: Date, tz: string): number {
  // точное смещение: полная локальная стена времени минус инстант (без модулей —
  // иначе зоны UTC+13/+14 ломаются при переходе через полночь)
  const w = wallClock(date, tz);
  return Date.UTC(w.y, w.mo-1, w.d, w.h, w.m, w.s) - date.getTime();
}
function localToInstant(w: Wall, hm: number, tz: string): Date {
  // локальная стена времени (год/месяц/день из w) → инстант UTC, две итерации для DST
  const wall = Date.UTC(w.y, w.mo-1, w.d, Math.floor(hm/60), hm%60);
  let inst = new Date(wall - tzOffsetMs(new Date(wall), tz));
  inst = new Date(wall - tzOffsetMs(inst, tz));
  return inst;
}
function nextEvent(ex: Exchange, date: Date): { type: 'open'|'close'; at: Date } | null {
  if(ex.always || !ex.tz || !ex.open || !ex.close) return null;
  const [oh,om] = ex.open.split(':').map(Number);
  const [ch,cm] = ex.close.split(':').map(Number);
  const openMin = oh*60+om, closeMin = ch*60+cm;
  const openNow = isOpen(ex, date);
  const w0 = wallClock(date, ex.tz);
  for(let d=0; d<8; d++){
    const wp = wallClock(new Date(date.getTime() + d*DAY), ex.tz);
    if(!ex.days.includes(wp.dow)) continue;
    const cand: Array<['open'|'close', number]> = openNow ? [['close', closeMin]] : [['open', openMin], ['close', closeMin]];
    for(const [type, hm] of cand){
      if(d===0 && hm <= w0.min) continue;
      return {type, at: localToInstant(wp, hm, ex.tz)};
    }
  }
  return null;
}

/* ================= КАРТА: ГЛИФОВОЕ ПОЛЕ ================= */
const ORB_CHARSET = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const GLYPH_RAMP = (() => {
  try{
    const cell = 24;
    const probe = document.createElement('canvas'); probe.width = probe.height = cell;
    const pc = probe.getContext('2d', {willReadFrequently:true});
    if(!pc) return Array.from(ORB_CHARSET);
    const font = `500 ${Math.round(cell*0.8)}px ui-monospace, Menlo, Consolas, monospace`;
    const ink = (ch: string) => {
      pc.fillStyle='#000'; pc.fillRect(0,0,cell,cell);
      pc.fillStyle='#fff'; pc.textAlign='center'; pc.textBaseline='middle'; pc.font=font;
      pc.fillText(ch, cell/2, cell/2);
      const d = pc.getImageData(0,0,cell,cell).data;
      let s=0; for(let i=0;i<d.length;i+=4) s+=d[i];
      return s;
    };
    return Array.from(new Set(Array.from(ORB_CHARSET)))
      .map(ch => ({ch, w: ink(ch)}))
      .sort((a,b) => a.w - b.w)
      .map(o => o.ch);
  }catch(e){ return Array.from(ORB_CHARSET); }
})();
/* палитра: ночной минерал -> ледяной циан -> белая вспышка */
const PAL = (() => {
  const night=[6,42,51], lit=[165,243,252], white=[235,253,255];
  const out: number[][] = [];
  for(let i=0;i<33;i++){
    const t=i/32;
    let c: number[];
    if(t<0.5){ const k=t/0.5; c=night.map((v,j)=>v+(lit[j]-v)*k); }
    else{ const k=(t-0.5)/0.5; c=lit.map((v,j)=>v+(white[j]-v)*k*0.7); }
    out.push(c.map(Math.round));
  }
  return out;
})();

/* value-noise, повторяет шейдер орба */
const fract = (x: number) => x - Math.floor(x);
function hash3(x: number, y: number, z: number): number {
  const px=fract(x*0.3183099+0.1)*17, py=fract(y*0.3183099+0.1)*17, pz=fract(z*0.3183099+0.1)*17;
  return fract(px*py*pz*(px+py+pz));
}
function noise3(x: number, y: number, z: number): number {
  const ix=Math.floor(x), iy=Math.floor(y), iz=Math.floor(z);
  let fx=x-ix, fy=y-iy, fz=z-iz;
  fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy); fz=fz*fz*(3-2*fz);
  const L=(a: number,b: number,t: number) => a+(b-a)*t;
  return L(
    L(L(hash3(ix,iy,iz),   hash3(ix+1,iy,iz),   fx), L(hash3(ix,iy+1,iz),   hash3(ix+1,iy+1,iz),   fx), fy),
    L(L(hash3(ix,iy,iz+1), hash3(ix+1,iy,iz+1), fx), L(hash3(ix,iy+1,iz+1), hash3(ix+1,iy+1,iz+1), fx), fy),
    fz);
}
const sstep = (a: number, b: number, x: number) => { const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };

/* солнце: деклинация и субсолярная долгота (NOAA, приближение) */
function sunInfo(date: Date): { decl: number; lon: number } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = (date.getTime() - start) / DAY;
  const day = Math.floor(doy);
  const utcHours = (doy - day) * 24;
  const g = 2*Math.PI/365 * (day - 1 + (utcHours - 12)/24);
  const decl = 0.006918 - 0.399912*Math.cos(g) + 0.070257*Math.sin(g)
    - 0.006758*Math.cos(2*g) + 0.000907*Math.sin(2*g)
    - 0.002697*Math.cos(3*g) + 0.00148*Math.sin(3*g);
  const eqt = 229.18*(0.000075 + 0.001868*Math.cos(g) - 0.032077*Math.sin(g)
    - 0.014615*Math.cos(2*g) - 0.040849*Math.sin(2*g)); // минуты
  return {decl, lon: 180 - 15*(utcHours + eqt/60)};
}

function project(lat: number, lon: number, w: number, h: number): [number, number] {
  const pad = 14;
  return [ pad + (lon+180)/360*(w-2*pad), pad + (90-lat)/180*(h-2*pad) ];
}

/* ================= INIT ================= */
export function init(root: HTMLElement): () => void {
  const q = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if(!el) throw new Error(`[MarketRhythm] не найден ${sel}`);
    return el;
  };
  const mapCv = q<HTMLCanvasElement>('.mr-map');
  const rulerCv = q<HTMLCanvasElement>('.mr-ruler-cv');
  const tip = q<HTMLDivElement>('.mr-tip');
  const chip = q<HTMLDivElement>('.mr-chip');
  const rowsEl = q<HTMLDivElement>('.mr-rows');
  const mapCtxRaw = mapCv.getContext('2d');
  const rulerCtxRaw = rulerCv.getContext('2d');
  if(!mapCtxRaw || !rulerCtxRaw) return () => {}; // canvas 2D недоступен — тихий no-op
  // отдельные константы: сужение типа не протекает в замыкания drawMap/drawRuler
  const mapCtx: CanvasRenderingContext2D = mapCtxRaw;
  const rulerCtx: CanvasRenderingContext2D = rulerCtxRaw;

  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const state = { mode: 'UTC' as 'UTC' | 'LOCAL', sel: 'msc', hot: null as string | null };

  const COLS = 120, ROWS_N = 60;
  let mapT = 0;
  const lamp = { x: 0, y: 0, tx: 0, ty: 0, str: 0, tstr: 0 };
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sizeCanvas(cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width*d); cv.height = Math.round(r.height*d);
    ctx.setTransform(d,0,0,d,0,0);
    return { w: r.width, h: r.height };
  }

  let mapCacheKey = '';
  function drawMap(){
    const now = new Date();
    // кэш: минута + ведро анимации (~9/с) + подсветка + размер
    const bucket = reduceMotion ? 0 : Math.floor(mapT * 9);
    const key = [Math.floor(now.getTime()/60000), bucket, state.sel, state.hot,
                 mapCv.clientWidth, mapCv.clientHeight, Math.round((window.devicePixelRatio||1)*100),
                 Math.round(lamp.x/3), Math.round(lamp.y/3), Math.round(lamp.str*40)].join('|');
    if(key === mapCacheKey) return;
    mapCacheKey = key;
    const {w, h} = sizeCanvas(mapCv, mapCtx);
    mapCtx.clearRect(0,0,w,h);
    const pad = 14;
    const sun = sunInfo(now);
    const sDec = Math.sin(sun.decl), cDec = Math.cos(sun.decl);
    const sunLonR = sun.lon*Math.PI/180;
    const cellW = (w-2*pad)/COLS, cellH = (h-2*pad)/ROWS_N;
    const fBase = Math.max(7, Math.round(cellW/0.58));
    const fontLo = `${fBase}px ui-monospace, Menlo, Consolas, monospace`;
    const fontMid = `${Math.max(7, Math.round(fBase*0.88))}px ui-monospace, Menlo, Consolas, monospace`;
    const fontHi = `${Math.max(7, Math.round(fBase*0.75))}px ui-monospace, Menlo, Consolas, monospace`;
    mapCtx.textAlign = 'center'; mapCtx.textBaseline = 'middle';
    let lastBucket = -1;
    const t = reduceMotion ? 12.3 : mapT;
    for(let r=0; r<ROWS_N; r++){
      const lat = 90 - (r+.5)*180/ROWS_N;
      const latR = lat*Math.PI/180;
      const sLat = Math.sin(latR), cLat = Math.cos(latR);
      for(let c=0; c<COLS; c++){
        if(MAP_ROWS[r][c] !== '#') continue;
        const lon = -180 + (c+.5)*360/COLS;
        const [x,y] = project(lat, lon, w, h);
        const lonR = lon*Math.PI/180;
        const qx = cLat*Math.cos(lonR), qy = cLat*Math.sin(lonR), qz = sLat;
        const drift = (noise3(qx*2.6, qy*2.6 + t*0.039, qz*2.6) - 0.5)*3.2;
        const bands = 0.5 + 0.5*Math.sin(latR*30 + drift + t*0.2275);
        const grain = noise3(qx*11 + t*0.0585, qy*11, qz*11 + t*0.0325);
        const albedo = Math.min(1, Math.max(0, 0.52*bands + 0.33*grain + 0.22));
        const sinElev = sLat*sDec + cLat*cDec*Math.cos(sunLonR - lonR);
        const lit = sstep(-0.1, 0.85, sinElev);
        let lampV = 0;
        if(lamp.str > 0.01){
          const s = Math.min(w, h) * 0.256;
          const dx = (x - lamp.x)/s, dy = (y - lamp.y)/s;
          lampV = lamp.str * 0.39 * Math.exp(-(dx*dx + dy*dy)*1.8);
        }
        const value = (0.3 + 0.7*albedo)*(0.22 + 0.78*lit) + albedo*0.14*(1-lit);
        const level = Math.pow(Math.min(1, (value + lampV)*1.6), 1.1);
        const bucketN = level < 0.4 ? 0 : level < 0.75 ? 1 : 2;
        if(bucketN !== lastBucket){ mapCtx.font = bucketN === 0 ? fontLo : bucketN === 1 ? fontMid : fontHi; lastBucket = bucketN; }
        const gAlb = Math.min(1, 0.12 + albedo*0.95);
        const gi = Math.min(GLYPH_RAMP.length-1, Math.floor(gAlb*(GLYPH_RAMP.length-1) + 0.5));
        if(gi < 1) continue;
        const pi = Math.min(32, Math.floor(Math.min(1, value + lampV*0.65)*32.999));
        const col = PAL[pi];
        const alpha = 0.25 + 0.75*Math.min(1, level*1.2);
        mapCtx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(2)})`;
        mapCtx.fillText(GLYPH_RAMP[gi], x, y + cellH*0.06);
      }
    }
    mapCtx.textAlign = 'left'; mapCtx.textBaseline = 'alphabetic';

    // маркеры бирж (с прилипанием к ближайшей точке суши)
    const cellAt = (px: number, py: number) => {
      const c = Math.min(COLS-1, Math.floor((px-pad)/(w-2*pad)*COLS)), r = Math.floor((py-pad)/(h-2*pad)*ROWS_N);
      return (r>=0 && r<ROWS_N && c>=0 && c<COLS) ? MAP_ROWS[r][c] : '.';
    };
    for(const ex of EXCHANGES){
      if(ex.always || ex.lat==null || ex.lon==null) continue;
      let [x,y] = project(ex.lat, ex.lon, w, h);
      if(cellAt(x,y) !== '#'){
        outer: for(let rad=2; rad<=14; rad+=2){
          for(let a=0; a<16; a++){
            const nx = x + rad*Math.cos(a/16*6.283), ny = y + rad*Math.sin(a/16*6.283);
            if(cellAt(nx,ny) === '#'){ x = nx; y = ny; break outer; }
          }
        }
      }
      ex._x = x; ex._y = y;
      const open = isOpen(ex, now);
      const active = state.sel===ex.id || state.hot===ex.id;
      const col = open ? '#34d399' : '#EF4444';
      const g = mapCtx.createRadialGradient(x,y,0,x,y,active?18:12);
      g.addColorStop(0, open?'rgba(52,211,153,.5)':'rgba(239,68,68,.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      mapCtx.fillStyle = g; mapCtx.beginPath(); mapCtx.arc(x,y,active?18:12,0,7); mapCtx.fill();
      mapCtx.fillStyle = col;
      mapCtx.beginPath(); mapCtx.arc(x,y,active?4.4:3.2,0,7); mapCtx.fill();
      if(active){
        mapCtx.strokeStyle = 'rgba(0,212,255,.9)'; mapCtx.lineWidth = 1.4;
        mapCtx.beginPath(); mapCtx.arc(x,y,8.5,0,7); mapCtx.stroke();
      }
    }
  }

  /* ================= ШКАЛА ================= */
  function dayStart(date: Date): number {
    // ось шкалы ВСЕГДА неподвижна: сутки от 00:00 UTC
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
  function rulerRows(now: Date): Exchange[] {
    const open = EXCHANGES.filter(e=>!e.always && isOpen(e, now));
    open.sort((a,b)=>{
      const na = nextEvent(a, now), nb = nextEvent(b, now);
      return (na?na.at.getTime():Infinity) - (nb?nb.at.getTime():Infinity);
    });
    const rows = [...open];
    for(const id of [state.hot, state.sel]){
      const e = EXCHANGES.find(x=>x.id===id);
      if(e && !e.always && !rows.includes(e)) rows.push(e);
    }
    return rows;
  }
  function drawRuler(){
    const now = new Date();
    const start = dayStart(now);
    const rows = rulerRows(now);
    const rowH = 16, labelW = 74, tickH = 26, padT = 4;
    const totalH = padT + rows.length*rowH + tickH;
    const track = rulerCv.parentElement as HTMLElement;
    if(track.style.height !== totalH + 'px') track.style.height = totalH + 'px';
    const {w, h} = sizeCanvas(rulerCv, rulerCtx);
    rulerCtx.clearRect(0,0,w,h);
    const bw = w - labelW;

    for(let i=0;i<24;i+=2){
      rulerCtx.fillStyle = 'rgba(255,255,255,.025)';
      rulerCtx.fillRect(labelW + i*bw/24, padT, bw/24, rows.length*rowH);
    }

    rulerCtx.font = '10px ui-monospace, Menlo, monospace';
    rows.forEach((ex, ri)=>{
      const y = padT + ri*rowH;
      const open = isOpen(ex, now);
      const active = state.sel===ex.id || state.hot===ex.id;
      rulerCtx.textAlign = 'left';
      rulerCtx.fillStyle = active ? 'rgba(0,212,255,.95)' : (open ? '#34d399' : '#6B7280');
      rulerCtx.fillText(ex.codes, 2, y+11);
      rulerCtx.fillStyle = open ? 'rgba(52,211,153,.35)' : 'rgba(0,212,255,.14)';
      let runStart: number | null = null;
      for(let i=0;i<=288;i++){
        const inst = new Date(start + i*5*MIN);
        const o = i<288 && isOpen(ex, inst);
        if(o && runStart===null) runStart = i;
        if(!o && runStart!==null){
          const x0 = labelW + runStart*bw/288, x1 = labelW + i*bw/288;
          rulerCtx.beginPath();
          rulerCtx.roundRect(x0, y+3, Math.max(2, x1-x0), 10, 3);
          rulerCtx.fill();
          runStart = null;
        }
      }
      if(active){
        rulerCtx.strokeStyle = 'rgba(0,212,255,.4)'; rulerCtx.lineWidth = 1;
        rulerCtx.beginPath();
        rulerCtx.roundRect(labelW+.5, y+1.5, bw-1, 13, 4);
        rulerCtx.stroke();
      }
    });

    rulerCtx.strokeStyle = '#2E2E2E'; rulerCtx.fillStyle = '#9CA3AF';
    rulerCtx.textAlign = 'center';
    const ty = padT + rows.length*rowH;
    for(let i=0;i<=48;i++){
      const x = labelW + i*bw/48, major = i%2===0;
      rulerCtx.beginPath(); rulerCtx.moveTo(x, ty+6); rulerCtx.lineTo(x, ty+(major?17:11)); rulerCtx.stroke();
      if(major){
        const inst = new Date(start + i*30*MIN);
        const lbl = state.mode==='UTC'
          ? String(i/2).padStart(2,'0')
          : String(wallClock(inst, viewerTz).h).padStart(2,'0');
        rulerCtx.fillText(lbl, x, ty+23);
      }
    }
    rulerCtx.textAlign = 'left';

    const frac = Math.min(1, Math.max(0, (now.getTime() - start)/DAY));
    const x = labelW + frac*bw;
    const grad = rulerCtx.createLinearGradient(0,0,0,ty);
    grad.addColorStop(0,'rgba(245,158,11,.95)'); grad.addColorStop(1,'rgba(245,158,11,.25)');
    rulerCtx.strokeStyle = grad; rulerCtx.lineWidth = 1.6;
    rulerCtx.beginPath(); rulerCtx.moveTo(x,0); rulerCtx.lineTo(x,ty); rulerCtx.stroke();

    chip.style.left = (x/w * 100) + '%';
    const hh = state.mode==='UTC' ? now.getUTCHours() : wallClock(now, viewerTz).h;
    const mm = state.mode==='UTC' ? now.getUTCMinutes() : wallClock(now, viewerTz).m;
    chip.textContent = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${state.mode==='UTC'?'UTC':'лок'}`;
  }

  /* ================= СПИСОК БИРЖ ================= */
  function buildRows(){
    rowsEl.innerHTML = '';
    for(const ex of EXCHANGES){
      const div = document.createElement('div');
      div.className = 'row' + (ex.always ? ' crypto' : '');
      div.innerHTML = `
        <span class="led"></span>
        <span class="row-name">${ex.name}<span class="codes">${ex.codes}</span></span>
        <span class="row-sub"></span>
        <span class="row-cd"><span class="cd-t"></span><span class="cd-l"></span></span>`;
      const onClick = () => { state.sel = ex.id; update(); };
      const onEnter = () => { state.hot = ex.id; update(); };
      const onLeave = () => { state.hot = null; update(); };
      div.addEventListener('click', onClick);
      div.addEventListener('mouseenter', onEnter);
      div.addEventListener('mouseleave', onLeave);
      rowHandlers.push({ div, onClick, onEnter, onLeave });
      rowsEl.appendChild(div);
      ex._row = div;
    }
  }
  const rowHandlers: Array<{ div: HTMLElement; onClick: () => void; onEnter: () => void; onLeave: () => void }> = [];
  function updateRows(){
    const now = new Date();
    for(const ex of EXCHANGES){
      const row = ex._row; if(!row) continue;
      row.classList.toggle('sel', state.sel === ex.id);
      row.classList.toggle('hot', state.hot === ex.id);
      const led = row.querySelector('.led') as HTMLElement;
      const sub = row.querySelector('.row-sub') as HTMLElement;
      const cdT = row.querySelector('.cd-t') as HTMLElement, cdL = row.querySelector('.cd-l') as HTMLElement;
      if(ex.always){
        led.className = 'led always';
        const w = wallClock(now, viewerTz);
        sub.textContent = `открыт всегда · у вас ${DOW_RU[w.dow]} ${String(w.h).padStart(2,'0')}:${String(w.m).padStart(2,'0')}`;
        cdT.textContent = '24 / 7'; cdL.textContent = ''; cdL.className = 'cd-l';
        continue;
      }
      const open = isOpen(ex, now);
      led.className = 'led ' + (open ? 'open' : 'closed');
      const w = wallClock(now, ex.tz);
      sub.textContent = `${DOW_RU[w.dow]} ${String(w.h).padStart(2,'0')}:${String(w.m).padStart(2,'0')} лок · сессия ${ex.open}–${ex.close}`;
      const ev = nextEvent(ex, now);
      if(ev){
        cdT.textContent = fmtCD(ev.at.getTime() - now.getTime());
        cdL.textContent = ev.type === 'open' ? 'до открытия' : 'до закрытия';
        cdL.className = 'cd-l ' + (ev.type === 'open' ? 'closed' : 'open');
      }
    }
  }

  /* ================= ТУЛТИП КАРТЫ ================= */
  let tipRaf = false;
  function scheduleUpdate(){
    if(tipRaf) return; tipRaf = true;
    requestAnimationFrame(() => { tipRaf = false; update(); });
  }
  const onMouseMove = (e: MouseEvent) => {
    const r = mapCv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    lamp.tx = mx; lamp.ty = my; lamp.tstr = 1;
    let best: Exchange | null = null, bd = 16;
    for(const ex of EXCHANGES){
      if(ex.lat == null || ex._x == null || ex._y == null) continue;
      const d = Math.hypot(ex._x - mx, ex._y - my);
      if(d < bd){ bd = d; best = ex; }
    }
    if(best){
      if(state.hot !== best.id){ state.hot = best.id; scheduleUpdate(); }
      const now = new Date();
      const open = isOpen(best, now);
      const w = wallClock(now, best.tz);
      tip.innerHTML = `<b>${best.name}</b> <span class="tt-muted">${best.codes}</span><br>
<span class="tt-status ${open ? 'open' : 'closed'}">${open ? '● открыта' : '● закрыта'}</span><br>
<span class="tt-muted">${DOW_RU[w.dow]} ${String(w.h).padStart(2,'0')}:${String(w.m).padStart(2,'0')} лок · ${best.open}–${best.close}</span>`;
      tip.style.left = Math.min(r.width - 180, (best._x ?? 0) + 14) + 'px';
      tip.style.top = Math.max(8, (best._y ?? 0) - 62) + 'px';
      tip.style.opacity = '1';
    } else if(state.hot){
      state.hot = null; tip.style.opacity = '0'; scheduleUpdate();
    }
  };
  const onMouseLeave = () => {
    state.hot = null; tip.style.opacity = '0'; lamp.tstr = 0; scheduleUpdate();
  };
  const onClick = () => {
    if(state.hot){ state.sel = state.hot; update(); }
  };
  mapCv.addEventListener('mousemove', onMouseMove);
  mapCv.addEventListener('mouseleave', onMouseLeave);
  mapCv.addEventListener('click', onClick);

  /* ================= ПЕРЕКЛЮЧАТЕЛЬ ЧАСОВОГО ПОЯСА ================= */
  const segBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.mr-tzseg button'));
  const segHandlers = segBtns.map(btn => {
    const handler = () => {
      segBtns.forEach(b => b.classList.toggle('on', b === btn));
      state.mode = (btn.dataset.tz as 'UTC' | 'LOCAL') || 'UTC';
      update();
    };
    btn.addEventListener('click', handler);
    return { btn, handler };
  });

  /* ================= ЦИКЛ ================= */
  function update(){
    drawMap();
    drawRuler();
    updateRows();
  }
  const onResize = () => update();
  window.addEventListener('resize', onResize);

  let lastFrame = performance.now();
  let rafId = 0;
  function frame(t: number){
    const dt = Math.min(1000, t - lastFrame); lastFrame = t;
    mapT += dt/1000;
    {
      const k = 1 - Math.exp(-dt/550);
      lamp.x += (lamp.tx - lamp.x)*k;
      lamp.y += (lamp.ty - lamp.y)*k;
      lamp.str += (lamp.tstr - lamp.str)*k;
    }
    update();
    rafId = requestAnimationFrame(frame);
  }

  buildRows();
  update();
  rafId = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    mapCv.removeEventListener('mousemove', onMouseMove);
    mapCv.removeEventListener('mouseleave', onMouseLeave);
    mapCv.removeEventListener('click', onClick);
    for(const { div, onClick: c, onEnter, onLeave } of rowHandlers) {
      div.removeEventListener('click', c);
      div.removeEventListener('mouseenter', onEnter);
      div.removeEventListener('mouseleave', onLeave);
    }
    for(const { btn, handler } of segHandlers) btn.removeEventListener('click', handler);
  };
}
