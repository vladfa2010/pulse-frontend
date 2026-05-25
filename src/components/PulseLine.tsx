export default function PulseLine() {
  return (
    <div className="relative w-full max-w-[600px] mx-auto">
      {/* Line */}
      <div
        className="relative h-[1px] w-full overflow-hidden"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 212, 255, 0.15) 30%, rgba(0, 212, 255, 0.15) 70%, transparent 100%)',
        }}
      >
        {/* Animated dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
          style={{
            background: '#00D4FF',
            boxShadow: '0 0 6px rgba(0, 212, 255, 0.6), 0 0 20px rgba(0, 212, 255, 0.3)',
            animation: 'pulseTravel 3s linear infinite',
          }}
        />
      </div>
      <p className="text-center text-xs text-text-muted mt-3">Изучаем новости для вас</p>
      <style>{`
        @keyframes pulseTravel {
          0% { left: 0%; opacity: 0.3; }
          50% { opacity: 1; }
          100% { left: 100%; opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
