import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'

interface TagProps {
  label: string
  type: 'company' | 'sector' | 'person' | 'trend'
  onRemove: () => void
  onClick?: () => void
  enriching?: boolean
}

const typeColors: Record<string, string> = {
  company: '#00D4FF',
  sector: '#A78BFA',
  person: '#FBBF24',
  trend: '#34D399',
}

export default function Tag({ label, type, onRemove, onClick, enriching }: TagProps) {
  const color = typeColors[type]

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="inline-flex items-center gap-2 h-9 pl-3.5 pr-2 rounded-pill text-sm font-medium text-text-primary relative group"
      style={{
        backgroundColor: '#161616',
        border: `1px solid ${color}40`,
      }}
    >
      {/* Colored dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Label */}
      <span
        onClick={onClick}
        className={`truncate max-w-[clamp(72px,25vw,150px)] ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
        title={enriching ? 'Обогащается...' : label}
      >
        {label}
      </span>

      {/* Enrichment indicator */}
      {enriching && (
        <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: '#6B7280' }} />
      )}

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="flex items-center justify-center w-5 h-5 rounded-full text-text-muted hover:text-text-error hover:bg-bg-hover transition-colors duration-150 ml-1"
        aria-label={`Remove ${label}`}
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}
