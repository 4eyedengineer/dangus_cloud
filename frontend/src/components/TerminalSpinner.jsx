import { useState, useEffect } from 'react'

export function TerminalSpinner({
  speed = 100,
  frames = ['|', '/', '-', '\\'],
  className = '',
  color = 'primary'
}) {
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length)
    }, speed)

    return () => clearInterval(interval)
  }, [speed, frames.length])

  const colorClasses = {
    primary: 'text-terminal-primary text-glow-green',
    secondary: 'text-terminal-secondary text-glow-amber',
    cyan: 'text-terminal-cyan text-glow-cyan',
    muted: 'text-terminal-muted'
  }

  const colorClass = colorClasses[color] || colorClasses.primary

  return (
    <span
      className={`font-mono inline-block w-[1ch] ${colorClass} ${className}`}
      role="status"
      aria-label="Loading"
    >
      {frames[frameIndex]}
    </span>
  )
}

export default TerminalSpinner
