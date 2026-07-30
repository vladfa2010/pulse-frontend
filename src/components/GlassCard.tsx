export default function GlassCard({
  children,
  className = '',
  accentColor,
}: {
  children: React.ReactNode
  className?: string
  accentColor?: string
}) {
  return (
    <div
      className={`rounded-2xl p-6 md:p-8 relative overflow-hidden ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        border: `1px solid ${accentColor ? accentColor + '20' : 'rgba(255, 255, 255, 0.06)'}`,
      }}
    >
      {accentColor && (
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accentColor}30, transparent)` }}
        />
      )}
      {children}
    </div>
  )
}
