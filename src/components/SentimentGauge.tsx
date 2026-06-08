import { useEffect, useState } from 'react'

interface Props {
  score: number // -10..+10
}

export default function SentimentGauge({ score }: Props) {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  const angle = ((animatedScore + 10) / 20) * 180
  const color = score > 0 ? '#34D399' : score < 0 ? '#EF4444' : '#9CA3AF'

  return (
    <div className="flex flex-col items-center py-2">
      <svg width="200" height="100" viewBox="0 0 200 100">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#222" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(angle / 180) * 251} 251`} style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
        <line x1="100" y1="100" x2={100 + 70 * Math.cos(Math.PI - (angle * Math.PI / 180))} y2={100 - 70 * Math.sin(Math.PI - (angle * Math.PI / 180))} stroke="#fff" strokeWidth="3" strokeLinecap="round" style={{ transition: 'all 0.8s ease-out' }} />
        <circle cx="100" cy="100" r="5" fill="#fff" />
        <text x="15" y="95" fontSize="8" fill="#6B7280" textAnchor="middle">-10</text>
        <text x="100" y="55" fontSize="8" fill="#6B7280" textAnchor="middle">0</text>
        <text x="185" y="95" fontSize="8" fill="#6B7280" textAnchor="middle">+10</text>
      </svg>
      <span className="text-sm font-bold -mt-1" style={{ color }}>{score > 0 ? '+' : ''}{score}</span>
    </div>
  )
}
