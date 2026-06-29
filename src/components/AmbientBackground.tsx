/**
 * AmbientBackground — фоновые SVG-анимации для карточек Carousel 1.
 *
 * Реализует 9 ambient-стилей из TZ_AMBIENT_LINES_v2.md.
 */

import { useMemo } from 'react'

export type AmbientStyle = '01' | '01b' | '01c' | '01d' | '03' | '05' | '06' | '07' | '08'

interface AmbientBackgroundProps {
  style: AmbientStyle
  sentiment: 'positive' | 'negative' | 'neutral'
  id: string
}

const colorMap = {
  positive: '#34D399',
  negative: '#EF4444',
  neutral: '#9CA3AF',
}

function cyrb128(str: string): number {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function useSeededRng(id: string, style: AmbientStyle) {
  return useMemo(() => mulberry32(cyrb128(`${id}-${style}`)), [id, style])
}

function randomBegin(dur: number, rng: () => number): string {
  return `${-(rng() * dur).toFixed(2)}s`
}

export function AmbientBackground({ style, sentiment, id }: AmbientBackgroundProps) {
  const color = colorMap[sentiment]
  const rng = useSeededRng(id, style)

  switch (style) {
    case '01':
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <g stroke={color} fill="none">
              <path
                d="M-20,149 C35,145 95,153 165,150 C250,148 340,146 420,149 C460,150 490,148 520,150"
                strokeWidth="0.35"
                opacity="0.35"
              >
                <animate
                  attributeName="d"
                  values="M-20,149 C35,145 95,153 165,150 C250,148 340,146 420,149 C460,150 490,148 520,150;M-20,164 C15,158 78,172 150,166 C238,160 328,154 412,159 C452,161 486,157 520,161;M-20,149 C35,145 95,153 165,150 C250,148 340,146 420,149 C460,150 490,148 520,150"
                  dur="13s"
                  begin={randomBegin(13, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M-20,168 C40,155 145,185 235,162 C315,148 395,178 475,156 C495,152 510,160 520,156"
                strokeWidth="0.7"
                opacity="0.55"
              >
                <animate
                  attributeName="d"
                  values="M-20,168 C40,155 145,185 235,162 C315,148 395,178 475,156 C495,152 510,160 520,156;M-20,153 C65,138 165,170 258,142 C338,126 418,158 498,136 C508,132 518,140 520,136;M-20,168 C40,155 145,185 235,162 C315,148 395,178 475,156 C495,152 510,160 520,156"
                  dur="22s"
                  begin={randomBegin(22, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M-20,186 C100,168 195,204 290,176 C370,158 450,196 505,172 C512,168 518,174 520,170"
                strokeWidth="1.1"
                opacity="0.75"
              >
                <animate
                  attributeName="d"
                  values="M-20,186 C100,168 195,204 290,176 C370,158 450,196 505,172 C512,168 518,174 520,170;M-20,171 C125,148 220,188 315,158 C395,138 472,178 515,154 C520,150 522,156 520,152;M-20,186 C100,168 195,204 290,176 C370,158 450,196 505,172 C512,168 518,174 520,170"
                  dur="31s"
                  begin={randomBegin(31, rng)}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.35;0.72;0.35"
                  dur="4.5s"
                  begin={randomBegin(4.5, rng)}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          </svg>
        </div>
      )

    case '01b':
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <g stroke={color} fill="none">
              <path
                d="M-20,178 C35,174 95,182 165,179 C250,177 340,175 420,178 C460,179 490,177 520,179"
                strokeWidth="1.1"
                opacity="0.7"
              >
                <animate
                  attributeName="d"
                  values="M-20,178 C35,174 95,182 165,179 C250,177 340,175 420,178 C460,179 490,177 520,179;M-20,163 C15,157 78,171 150,165 C238,159 328,153 412,158 C452,160 486,156 520,160;M-20,178 C35,174 95,182 165,179 C250,177 340,175 420,178 C460,179 490,177 520,179"
                  dur="15s"
                  begin={randomBegin(15, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M-20,195 C40,182 145,212 235,189 C315,175 395,205 475,183 C495,179 510,187 520,183"
                strokeWidth="0.65"
                opacity="0.5"
              >
                <animate
                  attributeName="d"
                  values="M-20,195 C40,182 145,212 235,189 C315,175 395,205 475,183 C495,179 510,187 520,183;M-20,210 C65,195 165,227 258,199 C338,183 418,215 498,193 C508,189 518,197 520,193;M-20,195 C40,182 145,212 235,189 C315,175 395,205 475,183 C495,179 510,187 520,183"
                  dur="17s"
                  begin={randomBegin(17, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M-20,209 C100,191 195,227 290,199 C370,181 450,219 505,195 C512,191 518,197 520,193"
                strokeWidth="0.35"
                opacity="0.3"
              >
                <animate
                  attributeName="d"
                  values="M-20,209 C100,191 195,227 290,199 C370,181 450,219 505,195 C512,191 518,197 520,193;M-20,224 C125,201 220,241 315,211 C395,191 472,231 515,207 C520,203 522,209 520,205;M-20,209 C100,191 195,227 290,199 C370,181 450,219 505,195 C512,191 518,197 520,193"
                  dur="19s"
                  begin={randomBegin(19, rng)}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.3;0.65;0.3"
                  dur="4.5s"
                  begin={randomBegin(4.5, rng)}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          </svg>
        </div>
      )

    case '01c':
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <g stroke={color} fill="none">
              <path
                d="M-20,176 C35,172 95,180 165,177 C250,175 340,173 420,176 C460,177 490,175 520,177"
                strokeWidth="0.6"
                opacity="0.45"
              >
                <animate
                  attributeName="d"
                  values="M-20,176 C35,172 95,180 165,177 C250,175 340,173 420,176 C460,177 490,175 520,177;M-20,161 C15,155 78,169 150,163 C238,157 328,151 412,156 C452,158 486,154 520,158;M-20,176 C35,172 95,180 165,177 C250,175 340,173 420,176 C460,177 490,175 520,177"
                  dur="14s"
                  begin={randomBegin(14, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M-20,193 C40,180 145,210 235,187 C315,173 395,203 475,181 C495,177 510,185 520,181"
                strokeWidth="1.0"
                opacity="0.7"
              >
                <animate
                  attributeName="d"
                  values="M-20,193 C40,180 145,210 235,187 C315,173 395,203 475,181 C495,177 510,185 520,181;M-20,208 C65,193 165,225 258,197 C338,181 418,213 498,191 C508,187 518,195 520,191;M-20,193 C40,180 145,210 235,187 C315,173 395,203 475,181 C495,177 510,185 520,181"
                  dur="16s"
                  begin={randomBegin(16, rng)}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.45;0.85;0.45"
                  dur="4.5s"
                  begin={randomBegin(4.5, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M-20,210 C100,192 195,228 290,200 C370,182 450,220 505,196 C512,192 518,198 520,194"
                strokeWidth="0.35"
                opacity="0.3"
              >
                <animate
                  attributeName="d"
                  values="M-20,210 C100,192 195,228 290,200 C370,182 450,220 505,196 C512,192 518,198 520,194;M-20,225 C125,202 220,242 315,212 C395,192 472,232 515,208 C520,204 522,210 520,206;M-20,210 C100,192 195,228 290,200 C370,182 450,220 505,196 C512,192 518,198 520,194"
                  dur="18s"
                  begin={randomBegin(18, rng)}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          </svg>
        </div>
      )

    case '01d':
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <g stroke={color} fill="none">
              <path
                d="M-20,119 C35,115 95,123 165,120 C250,118 340,116 420,119 C460,120 490,118 520,120"
                strokeWidth="0.35"
                opacity="0.3"
              >
                <animate
                  attributeName="d"
                  values="M-20,119 C35,115 95,123 165,120 C250,118 340,116 420,119 C460,120 490,118 520,120;M-20,104 C15,98 78,112 150,106 C238,100 328,94 412,99 C452,101 486,97 520,101;M-20,119 C35,115 95,123 165,120 C250,118 340,116 420,119 C460,120 490,118 520,120"
                  dur="13s"
                  begin={randomBegin(13, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M-20,136 C40,123 145,153 235,130 C315,116 395,146 475,124 C495,120 510,128 520,124"
                strokeWidth="1.05"
                opacity="0.75"
              >
                <animate
                  attributeName="d"
                  values="M-20,136 C40,123 145,153 235,130 C315,116 395,146 475,124 C495,120 510,128 520,124;M-20,151 C65,136 165,168 258,140 C338,124 418,156 498,134 C508,130 518,138 520,134;M-20,136 C40,123 145,153 235,130 C315,116 395,146 475,124 C495,120 510,128 520,124"
                  dur="15s"
                  begin={randomBegin(15, rng)}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.45;0.85;0.45"
                  dur="4.5s"
                  begin={randomBegin(4.5, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M-20,153 C100,135 195,171 290,143 C370,125 450,163 505,139 C512,135 518,141 520,137"
                strokeWidth="0.55"
                opacity="0.45"
              >
                <animate
                  attributeName="d"
                  values="M-20,153 C100,135 195,171 290,143 C370,125 450,163 505,139 C512,135 518,141 520,137;M-20,168 C125,145 220,185 315,155 C395,135 472,175 515,151 C520,147 522,153 520,149;M-20,153 C100,135 195,171 290,143 C370,125 450,163 505,139 C512,135 518,141 520,137"
                  dur="17s"
                  begin={randomBegin(17, rng)}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          </svg>
        </div>
      )

    case '03':
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <g stroke={color} fill="none">
              <ellipse cx="320" cy="60" rx="100" ry="40" strokeWidth="0.35" opacity="0.05">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 320 60"
                  to="360 320 60"
                  dur="50s"
                  begin={randomBegin(50, rng)}
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse cx="320" cy="60" rx="140" ry="55" strokeWidth="0.6" opacity="0.07">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="30 320 60"
                  to="390 320 60"
                  dur="70s"
                  begin={randomBegin(70, rng)}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.07;0.2;0.07"
                  dur="5s"
                  begin={randomBegin(5, rng)}
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse cx="320" cy="60" rx="180" ry="70" strokeWidth="0.9" opacity="0.04">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 320 60"
                  to="-360 320 60"
                  dur="90s"
                  begin={randomBegin(90, rng)}
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse cx="320" cy="60" rx="220" ry="85" strokeWidth="0.3" opacity="0.03">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="15 320 60"
                  to="-345 320 60"
                  dur="110s"
                  begin={randomBegin(110, rng)}
                  repeatCount="indefinite"
                />
              </ellipse>
              <circle cx="320" cy="60" r="2" fill={color} stroke="none" opacity="0.08">
                <animate
                  attributeName="r"
                  values="2;3;2"
                  dur="6s"
                  begin={randomBegin(6, rng)}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.08;0.03;0.08"
                  dur="6s"
                  begin={randomBegin(6, rng)}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          </svg>
        </div>
      )

    case '05':
      return (
        <div className="ambient">
          <svg viewBox="0 0 500 250" preserveAspectRatio="none">
            <g stroke={color} fill="none">
              <path d="M0,200 Q60,180 120,190 T240,170 T360,185 T500,160" strokeDasharray="500" strokeWidth="0.8" opacity="0.08">
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;-30;0"
                  dur="18s"
                  begin={randomBegin(18, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path d="M0,180 Q80,150 160,170 T320,140 T500,155" strokeDasharray="500" strokeWidth="0.7" opacity="0.07">
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;25;0"
                  dur="20s"
                  begin={randomBegin(20, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path d="M0,220 Q100,200 200,210 T400,195 T500,205" strokeDasharray="500" strokeWidth="0.6" opacity="0.06">
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;-20;0"
                  dur="16s"
                  begin={randomBegin(16, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path d="M0,160 Q70,130 140,150 T280,125 T420,140 T500,130" strokeDasharray="500" strokeWidth="0.5" opacity="0.04">
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;22;0"
                  dur="22s"
                  begin={randomBegin(22, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <path d="M0,240 Q120,215 240,230 T500,210" strokeDasharray="500" strokeWidth="0.4" opacity="0.03">
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;-18;0"
                  dur="14s"
                  begin={randomBegin(14, rng)}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          </svg>
        </div>
      )

    case '06':
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <g opacity="0.08">
              <path d="M435,165 Q300,200 200,175 Q100,150 -10,170" fill="none" stroke={color} strokeWidth="0.5">
                <animate
                  attributeName="d"
                  values="M435,165 Q300,200 200,175 Q100,150 -10,170;M435,175 Q300,190 200,155 Q100,180 -10,160;M435,165 Q300,200 200,175 Q100,150 -10,170"
                  dur="15s"
                  begin={randomBegin(15, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <circle r="1.5" fill={color}>
                <animateMotion
                  dur="10s"
                  begin={randomBegin(10, rng)}
                  repeatCount="indefinite"
                  path="M435,165 Q300,200 200,175 Q100,150 -10,170"
                />
              </circle>

              <path d="M435,185 Q280,210 180,195 Q80,170 -10,190" fill="none" stroke={color} strokeWidth="0.5">
                <animate
                  attributeName="d"
                  values="M435,185 Q280,210 180,195 Q80,170 -10,190;M435,195 Q280,200 180,180 Q80,200 -10,180;M435,185 Q280,210 180,195 Q80,170 -10,190"
                  dur="17s"
                  begin={randomBegin(17, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <circle r="1.5" fill={color} opacity="0.7">
                <animateMotion
                  dur="12s"
                  begin={randomBegin(12, rng)}
                  repeatCount="indefinite"
                  path="M435,185 Q280,210 180,195 Q80,170 -10,190"
                />
              </circle>

              <path d="M435,145 Q320,180 220,160 Q120,130 -10,150" fill="none" stroke={color} strokeWidth="0.4" opacity="0.6">
                <animate
                  attributeName="d"
                  values="M435,145 Q320,180 220,160 Q120,130 -10,150;M435,155 Q320,170 220,140 Q120,165 -10,140;M435,145 Q320,180 220,160 Q120,130 -10,150"
                  dur="13s"
                  begin={randomBegin(13, rng)}
                  repeatCount="indefinite"
                />
              </path>
              <circle r="1" fill={color} opacity="0.5">
                <animateMotion
                  dur="14s"
                  begin={randomBegin(14, rng)}
                  repeatCount="indefinite"
                  path="M435,145 Q320,180 220,160 Q120,130 -10,150"
                />
              </circle>
            </g>
          </svg>
        </div>
      )

    case '07': {
      const gradId = `breath-${id}`
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <defs>
              <radialGradient id={gradId} cx="75%" cy="25%" r="45%">
                <stop offset="0%" stopColor={color} stopOpacity="0.1" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="320" cy="55" rx="120" ry="80" fill={`url(#${gradId})`}>
              <animate
                attributeName="rx"
                values="120;160;120"
                dur="9s"
                begin={randomBegin(9, rng)}
                repeatCount="indefinite"
              />
              <animate
                attributeName="ry"
                values="80;110;80"
                dur="9s"
                begin={randomBegin(9, rng)}
                repeatCount="indefinite"
              />
            </ellipse>
            <ellipse cx="100" cy="180" rx="70" ry="50" fill={`url(#${gradId})`} opacity="0.4">
              <animate
                attributeName="rx"
                values="70;95;70"
                dur="13s"
                begin={randomBegin(13, rng)}
                repeatCount="indefinite"
              />
              <animate
                attributeName="ry"
                values="50;70;50"
                dur="13s"
                begin={randomBegin(13, rng)}
                repeatCount="indefinite"
              />
            </ellipse>
          </svg>
        </div>
      )
    }

    case '08':
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <g fill={color}>
              <circle r="1.2" opacity="0.15">
                <animateMotion
                  path="M50,30 Q120,80 80,150 Q40,100 50,30"
                  dur="28s"
                  begin={randomBegin(28, rng)}
                  repeatCount="indefinite"
                />
              </circle>
              <circle r="0.8" opacity="0.1">
                <animateMotion
                  path="M200,20 Q280,60 250,140 Q180,100 200,20"
                  dur="35s"
                  begin={randomBegin(35, rng)}
                  repeatCount="indefinite"
                />
              </circle>
              <circle r="1.5" opacity="0.12">
                <animateMotion
                  path="M300,40 Q340,100 300,170 Q260,110 300,40"
                  dur="22s"
                  begin={randomBegin(22, rng)}
                  repeatCount="indefinite"
                />
              </circle>
              <circle r="0.6" opacity="0.08">
                <animateMotion
                  path="M150,60 Q200,40 180,120 Q130,100 150,60"
                  dur="40s"
                  begin={randomBegin(40, rng)}
                  repeatCount="indefinite"
                />
              </circle>
              <circle r="1" opacity="0.1">
                <animateMotion
                  path="M80,120 Q140,160 100,180 Q60,140 80,120"
                  dur="32s"
                  begin={randomBegin(32, rng)}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          </svg>
        </div>
      )

    default:
      return null
  }
}
