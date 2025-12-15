import { useState, useEffect } from 'react'

export function TerminalTypewriter({
  text = '',
  speed = 40,
  showCursor = true,
  cursorChar = '█',
  onComplete,
  className = '',
  color = 'primary'
}) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(true)

  useEffect(() => {
    setDisplayedText('')
    setIsComplete(false)
  }, [text])

  useEffect(() => {
    if (displayedText.length < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1))
      }, speed)

      return () => clearTimeout(timeout)
    } else if (!isComplete && text.length > 0) {
      setIsComplete(true)
      onComplete?.()
    }
  }, [displayedText, text, speed, isComplete, onComplete])

  useEffect(() => {
    if (!showCursor) return

    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, 530)

    return () => clearInterval(interval)
  }, [showCursor])

  const colorClasses = {
    primary: 'text-terminal-primary',
    secondary: 'text-terminal-secondary',
    cyan: 'text-terminal-cyan',
    muted: 'text-terminal-muted'
  }

  const colorClass = colorClasses[color] || colorClasses.primary

  return (
    <span
      className={`font-mono ${colorClass} ${className}`}
      role="status"
      aria-label={text}
    >
      {displayedText}
      {showCursor && (
        <span
          className={`animate-cursor-blink ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        >
          {cursorChar}
        </span>
      )}
    </span>
  )
}

export default TerminalTypewriter
