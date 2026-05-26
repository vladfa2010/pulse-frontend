import { useMemo } from 'react'

interface PasswordStrengthProps {
  password: string
}

type Level = 0 | 1 | 2 | 3 | 4

function getLevel(password: string): Level {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score as Level
}

function levelLabel(level: Level): string {
  switch (level) {
    case 0: return 'Слишком короткий'
    case 1: return 'Слабый'
    case 2: return 'Средний'
    case 3: return 'Хороший'
    case 4: return 'Отличный'
  }
}

function levelColor(level: Level): string {
  switch (level) {
    case 0: return '#EF4444'
    case 1: return '#EF4444'
    case 2: return '#F59E0B'
    case 3: return '#34D399'
    case 4: return '#00D4FF'
  }
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const level = useMemo(() => getLevel(password), [password])

  if (!password) return null

  return (
    <div className="mt-2 mb-1">
      {/* 4 segments */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= level ? levelColor(level) : '#222222',
              opacity: i <= level ? 1 : 0.3,
            }}
          />
        ))}
      </div>
      {/* Label */}
      <p
        className="text-xs mt-1.5 font-medium transition-colors duration-300"
        style={{ color: levelColor(level) }}
      >
        {levelLabel(level)}
      </p>
    </div>
  )
}
