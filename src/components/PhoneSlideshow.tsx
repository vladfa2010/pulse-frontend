import { useState, useEffect, useCallback } from 'react'

const SCREENS = [
  '/screenshots/screen1.jpg',
  '/screenshots/screen2.jpg',
  '/screenshots/screen3.jpg',
]

const INTERVAL = 4000 // 4 seconds

export default function PhoneSlideshow() {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState<boolean[]>([true, false, false])

  const goTo = useCallback((index: number) => {
    setCurrent(index)
    setLoaded((prev) => {
      const next = [...prev]
      next[index] = true
      return next
    })
  }, [])

  // Autoplay
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % SCREENS.length
        setLoaded((l) => {
          const nl = [...l]
          nl[next] = true
          return nl
        })
        return next
      })
    }, INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative w-full h-full">
      {/* Images with crossfade */}
      {SCREENS.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`PULSE screen ${i + 1}`}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{
            opacity: i === current ? 1 : 0,
            filter: 'brightness(0.95)',
            zIndex: i === current ? 2 : 1,
          }}
          loading={loaded[i] ? undefined : 'lazy'}
        />
      ))}

      {/* Dot indicators */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2"
      >
        {SCREENS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="transition-all duration-300 rounded-full"
            style={{
              width: i === current ? 20 : 6,
              height: 6,
              background:
                i === current
                  ? '#00D4FF'
                  : 'rgba(255,255,255,0.3)',
              border: 'none',
              cursor: 'pointer',
            }}
            aria-label={`Screen ${i + 1}`}
          />
        ))}
      </div>

      {/* Subtle gradient overlay at bottom for dot readability */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 z-[5] pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(14,14,14,0.6), transparent)',
        }}
      />
    </div>
  )
}
