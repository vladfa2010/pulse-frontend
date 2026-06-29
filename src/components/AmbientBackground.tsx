/**
 * AmbientBackground — фоновые SVG-анимации для карточек Carousel 1.
 *
 * Реализует 7 ambient-стилей из TZ-002:
 *   01a–01d: Flowing Waves
 *   03:      Ellipse Orbit
 *   05:      Noise Terrain
 *   06:      Particle Terrain
 */

export type AmbientStyle = '01a' | '01b' | '01c' | '01d' | '03' | '05' | '06'

interface AmbientBackgroundProps {
  style: AmbientStyle
  sentiment: 'positive' | 'negative' | 'neutral'
}

const colorMap = {
  positive: '#34D399',
  negative: '#EF4444',
  neutral: '#9CA3AF',
}

export function AmbientBackground({ style, sentiment }: AmbientBackgroundProps) {
  const color = colorMap[sentiment]

  switch (style) {
    case '01a':
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <g stroke={color} fill="none" opacity="0.08">
              <path d="M-20,140 C60,125 120,155 200,135 C280,115 340,145 445,130">
                <animate
                  attributeName="d"
                  values="M-20,140 C60,125 120,155 200,135 C280,115 340,145 445,130;M-20,130 C80,150 140,120 220,150 C300,130 360,160 445,140;M-20,140 C60,125 120,155 200,135 C280,115 340,145 445,130"
                  dur="13s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M-20,168 C70,150 140,180 210,160 C290,140 360,170 445,155" strokeWidth="0.8">
                <animate
                  attributeName="d"
                  values="M-20,168 C70,150 140,180 210,160 C290,140 360,170 445,155;M-20,158 C90,178 150,148 230,168 C310,148 380,178 445,162;M-20,168 C70,150 140,180 210,160 C290,140 360,170 445,155"
                  dur="22s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M-20,195 C80,175 150,205 220,185 C300,165 370,195 445,180" strokeWidth="0.6">
                <animate
                  attributeName="d"
                  values="M-20,195 C80,175 150,205 220,185 C300,165 370,195 445,180;M-20,185 C100,205 160,175 240,195 C320,175 390,205 445,188;M-20,195 C80,175 150,205 220,185 C300,165 370,195 445,180"
                  dur="31s"
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
            <g stroke={color} fill="none" opacity="0.08">
              <path d="M-20,170 C60,155 130,185 200,165 C280,145 350,175 445,160">
                <animate
                  attributeName="d"
                  values="M-20,170 C60,155 130,185 200,165 C280,145 350,175 445,160;M-20,160 C80,180 140,150 220,175 C300,155 370,185 445,170;M-20,170 C60,155 130,185 200,165 C280,145 350,175 445,160"
                  dur="15s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M-20,195 C70,180 140,210 210,190 C290,170 360,200 445,185" strokeWidth="0.8">
                <animate
                  attributeName="d"
                  values="M-20,195 C70,180 140,210 210,190 C290,170 360,200 445,185;M-20,185 C90,205 150,175 230,200 C310,180 380,210 445,195;M-20,195 C70,180 140,210 210,190 C290,170 360,200 445,185"
                  dur="17s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M-20,215 C80,200 150,225 220,210 C300,195 370,220 445,205" strokeWidth="0.6">
                <animate
                  attributeName="d"
                  values="M-20,215 C80,200 150,225 220,210 C300,195 370,220 445,205;M-20,205 C100,220 160,200 240,220 C320,205 390,225 445,212;M-20,215 C80,200 150,225 220,210 C300,195 370,220 445,205"
                  dur="19s"
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
            <g stroke={color} fill="none" opacity="0.08">
              <path d="M-20,168 C60,153 130,183 200,163 C280,143 350,173 445,158">
                <animate
                  attributeName="d"
                  values="M-20,168 C60,153 130,183 200,163 C280,143 350,173 445,158;M-20,158 C80,178 140,148 220,173 C300,153 370,183 445,168;M-20,168 C60,153 130,183 200,163 C280,143 350,173 445,158"
                  dur="14s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M-20,193 C70,178 140,208 210,188 C290,168 360,198 445,183" strokeWidth="0.8">
                <animate
                  attributeName="d"
                  values="M-20,193 C70,178 140,208 210,188 C290,168 360,198 445,183;M-20,183 C90,203 150,173 230,198 C310,178 380,208 445,193;M-20,193 C70,178 140,208 210,188 C290,168 360,198 445,183"
                  dur="16s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M-20,218 C80,203 150,228 220,213 C300,198 370,223 445,208" strokeWidth="0.6">
                <animate
                  attributeName="d"
                  values="M-20,218 C80,203 150,228 220,213 C300,198 370,223 445,208;M-20,208 C100,223 160,203 240,223 C320,208 390,228 445,215;M-20,218 C80,203 150,228 220,213 C300,198 370,223 445,208"
                  dur="18s"
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
            <g stroke={color} fill="none" opacity="0.08">
              <path d="M-20,111 C60,96 130,126 200,106 C280,86 350,116 445,101">
                <animate
                  attributeName="d"
                  values="M-20,111 C60,96 130,126 200,106 C280,86 350,116 445,101;M-20,101 C80,121 140,91 220,116 C300,96 370,126 445,111;M-20,111 C60,96 130,126 200,106 C280,86 350,116 445,101"
                  dur="13s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M-20,136 C70,121 140,151 210,131 C290,111 360,141 445,126" strokeWidth="0.8">
                <animate
                  attributeName="d"
                  values="M-20,136 C70,121 140,151 210,131 C290,111 360,141 445,126;M-20,126 C90,146 150,116 230,141 C310,121 380,151 445,136;M-20,136 C70,121 140,151 210,131 C290,111 360,141 445,126"
                  dur="15s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M-20,161 C80,146 150,171 220,156 C300,141 370,166 445,151" strokeWidth="0.6">
                <animate
                  attributeName="d"
                  values="M-20,161 C80,146 150,171 220,156 C300,141 370,166 445,151;M-20,151 C100,166 160,146 240,166 C320,151 390,171 445,158;M-20,161 C80,146 150,171 220,156 C300,141 370,166 445,151"
                  dur="17s"
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
              <ellipse cx="320" cy="60" rx="100" ry="40">
                <animateTransform attributeName="transform" type="rotate" from="0 320 60" to="360 320 60" dur="25s" repeatCount="indefinite" />
              </ellipse>
              <ellipse cx="320" cy="60" rx="140" ry="55" strokeWidth="0.8" opacity="0.7">
                <animateTransform attributeName="transform" type="rotate" from="30 320 60" to="390 320 60" dur="35s" repeatCount="indefinite" />
              </ellipse>
              <ellipse cx="320" cy="60" rx="180" ry="70" strokeWidth="0.6" opacity="0.5">
                <animateTransform attributeName="transform" type="rotate" from="0 320 60" to="-360 320 60" dur="45s" repeatCount="indefinite" />
              </ellipse>
              <ellipse cx="320" cy="60" rx="220" ry="85" strokeWidth="0.5" opacity="0.3">
                <animateTransform attributeName="transform" type="rotate" from="15 320 60" to="-345 320 60" dur="55s" repeatCount="indefinite" />
              </ellipse>
              <circle cx="320" cy="60" r="2" fill={color} stroke="none" opacity="0.25">
                <animate attributeName="r" values="2;4;2" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.08;0.25" dur="3s" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>
        </div>
      )

    case '05':
      return (
        <div className="ambient">
          <svg viewBox="0 0 425 225" preserveAspectRatio="none">
            <g stroke={color} fill="none">
              <path d="M0,200 Q60,180 120,190 T240,170 T360,185 T425,160" strokeWidth="0.8" opacity="0.08" strokeDasharray="500">
                <animate attributeName="stroke-dashoffset" values="0;-25;0" dur="14s" repeatCount="indefinite" />
              </path>
              <path d="M0,180 Q70,200 140,170 T260,185 T380,165 T425,180" strokeWidth="0.8" opacity="0.065" strokeDasharray="500">
                <animate attributeName="stroke-dashoffset" values="0;22;0" dur="16s" repeatCount="indefinite" />
              </path>
              <path d="M0,210 Q80,190 160,205 T280,185 T400,200 T425,190" strokeWidth="0.8" opacity="0.05" strokeDasharray="500">
                <animate attributeName="stroke-dashoffset" values="0;-20;0" dur="18s" repeatCount="indefinite" />
              </path>
              <path d="M0,160 Q50,180 100,150 T220,170 T340,150 T425,165" strokeWidth="0.8" opacity="0.04" strokeDasharray="500">
                <animate attributeName="stroke-dashoffset" values="0;28;0" dur="20s" repeatCount="indefinite" />
              </path>
              <path d="M0,190 Q70,170 140,200 T260,180 T380,195 T425,185" strokeWidth="0.8" opacity="0.03" strokeDasharray="500">
                <animate attributeName="stroke-dashoffset" values="0;-18;0" dur="22s" repeatCount="indefinite" />
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
                  values="M435,165 Q300,200 200,175 Q100,150 -10,170;M435,175 Q300,210 200,185 Q100,160 -10,180;M435,165 Q300,200 200,175 Q100,150 -10,170"
                  dur="15s"
                  repeatCount="indefinite"
                />
              </path>
              <circle r="1.5" fill={color}>
                <animateMotion dur="10s" repeatCount="indefinite" path="M435,165 Q300,200 200,175 Q100,150 -10,170" />
              </circle>
              <circle r="1.5" fill={color}>
                <animateMotion dur="10s" begin="-5s" repeatCount="indefinite" path="M435,165 Q300,200 200,175 Q100,150 -10,170" />
              </circle>

              <path d="M435,185 Q310,220 210,195 Q110,170 -10,190" fill="none" stroke={color} strokeWidth="0.5">
                <animate
                  attributeName="d"
                  values="M435,185 Q310,220 210,195 Q110,170 -10,190;M435,195 Q310,230 210,205 Q110,180 -10,200;M435,185 Q310,220 210,195 Q110,170 -10,190"
                  dur="15s"
                  repeatCount="indefinite"
                />
              </path>
              <circle r="1.5" fill={color}>
                <animateMotion dur="12s" repeatCount="indefinite" path="M435,185 Q310,220 210,195 Q110,170 -10,190" />
              </circle>
              <circle r="1.5" fill={color}>
                <animateMotion dur="12s" begin="-6s" repeatCount="indefinite" path="M435,185 Q310,220 210,195 Q110,170 -10,190" />
              </circle>

              <path d="M435,205 Q320,230 220,215 Q120,190 -10,210" fill="none" stroke={color} strokeWidth="0.5">
                <animate
                  attributeName="d"
                  values="M435,205 Q320,230 220,215 Q120,190 -10,210;M435,215 Q320,240 220,225 Q120,200 -10,220;M435,205 Q320,230 220,215 Q120,190 -10,210"
                  dur="15s"
                  repeatCount="indefinite"
                />
              </path>
              <circle r="1.5" fill={color}>
                <animateMotion dur="14s" repeatCount="indefinite" path="M435,205 Q320,230 220,215 Q120,190 -10,210" />
              </circle>
              <circle r="1.5" fill={color}>
                <animateMotion dur="14s" begin="-7s" repeatCount="indefinite" path="M435,205 Q320,230 220,215 Q120,190 -10,210" />
              </circle>
            </g>
          </svg>
        </div>
      )

    default:
      return null
  }
}
