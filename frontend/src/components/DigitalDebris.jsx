import { useMemo } from 'react'

// Block characters for debris effect
const DEBRIS_CHARS = ['░', '▒', '▓', '█']

// Generate pseudo-random debris particles
const generateParticles = (count, width, height, seed = 42) => {
  const particles = []
  // Simple seeded random for consistent results
  let random = seed
  const nextRandom = () => {
    random = (random * 1103515245 + 12345) & 0x7fffffff
    return random / 0x7fffffff
  }

  for (let i = 0; i < count; i++) {
    const size = 10 + Math.floor(nextRandom() * 6) // 10-16px
    const grayValue = 34 + Math.floor(nextRandom() * 68) // #222 to #666 grayscale
    particles.push({
      id: i,
      char: DEBRIS_CHARS[Math.floor(nextRandom() * DEBRIS_CHARS.length)],
      x: nextRandom() * (width - size),
      y: nextRandom() * (height - size),
      opacity: 0.15 + nextRandom() * 0.25, // 0.15 - 0.4
      color: `rgb(${grayValue}, ${grayValue}, ${grayValue})`,
      size,
    })
  }

  return particles
}

export function DigitalDebris({
  density = 'normal',
  width = 400,
  height = 200,
  seed = 42,
  className = ''
}) {
  const densityMap = {
    sparse: 15,
    normal: 30,
    dense: 50
  }

  const particleCount = densityMap[density] || densityMap.normal

  const particles = useMemo(
    () => generateParticles(particleCount, width, height, seed),
    [particleCount, width, height, seed]
  )

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden font-mono ${className}`}
      aria-hidden="true"
    >
      {particles.map(particle => (
        <span
          key={particle.id}
          className="absolute select-none"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            opacity: particle.opacity,
            color: particle.color,
            fontSize: `${particle.size}px`,
            lineHeight: 1,
          }}
        >
          {particle.char}
        </span>
      ))}
    </div>
  )
}

// Variant that fills parent container
export function DigitalDebrisFill({
  density = 'normal',
  seed = 42,
  className = ''
}) {
  const densityMap = {
    sparse: 20,
    normal: 40,
    dense: 70
  }

  const particleCount = densityMap[density] || densityMap.normal

  // Use percentages for responsive positioning
  const particles = useMemo(() => {
    const result = []
    let random = seed
    const nextRandom = () => {
      random = (random * 1103515245 + 12345) & 0x7fffffff
      return random / 0x7fffffff
    }

    for (let i = 0; i < particleCount; i++) {
      const size = 10 + Math.floor(nextRandom() * 6)
      const grayValue = 34 + Math.floor(nextRandom() * 68) // #222 to #666 grayscale
      result.push({
        id: i,
        char: DEBRIS_CHARS[Math.floor(nextRandom() * DEBRIS_CHARS.length)],
        x: nextRandom() * 95, // percentage (leave room for particle size)
        y: nextRandom() * 95, // percentage
        opacity: 0.15 + nextRandom() * 0.25,
        color: `rgb(${grayValue}, ${grayValue}, ${grayValue})`,
        size,
      })
    }

    return result
  }, [particleCount, seed])

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden font-mono ${className}`}
      aria-hidden="true"
    >
      {particles.map(particle => (
        <span
          key={particle.id}
          className="absolute select-none"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            opacity: particle.opacity,
            color: particle.color,
            fontSize: `${particle.size}px`,
            lineHeight: 1,
          }}
        >
          {particle.char}
        </span>
      ))}
    </div>
  )
}

export default DigitalDebris
