interface TagImpact {
  tag: string
  score: number
  reasoning: string
}

interface Props {
  tagImpacts: TagImpact[]
}

export default function TagImpactList({ tagImpacts }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {tagImpacts.map((ti) => {
        const color = ti.score > 0 ? '#34D399' : ti.score < 0 ? '#EF4444' : '#9CA3AF'
        return (
          <div key={ti.tag} className="group relative">
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full cursor-default" style={{ backgroundColor: `${color}12`, color, border: `1px solid ${color}25` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              {ti.tag} <span className="font-bold">{ti.score > 0 ? '+' : ''}{ti.score}</span>
            </span>
            {ti.reasoning && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs max-w-[240px] z-10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{ backgroundColor: '#1a1a1a', color: '#D1D5DB', border: '1px solid #333' }}>
                {ti.reasoning}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
