import { useState, useEffect } from 'react'

const FULL_LOGO = `██████╗  █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗███████╗
██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██║   ██║██╔════╝
██║  ██║███████║██╔██╗ ██║██║  ███╗██║   ██║███████╗
██║  ██║██╔══██║██║╚██╗██║██║   ██║██║   ██║╚════██║
██████╔╝██║  ██║██║ ╚████║╚██████╔╝╚██████╔╝███████║
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚══════╝`

const COMPACT_LOGO = `DANGUS`

export function AsciiLogo({
  variant = 'full',
  showCloud = true,
  showBorder = true,
  glowColor = 'green',
  className = ''
}) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const displayVariant = isMobile ? 'compact' : variant
  const logo = displayVariant === 'full' ? FULL_LOGO : COMPACT_LOGO

  const glowClasses = {
    green: 'text-terminal-primary text-glow-green',
    amber: 'text-terminal-secondary text-glow-amber',
    cyan: 'text-terminal-cyan text-glow-cyan',
    red: 'text-terminal-red text-glow-red',
    none: 'text-terminal-primary'
  }

  const borderGlowClasses = {
    green: 'text-terminal-primary',
    amber: 'text-terminal-secondary',
    cyan: 'text-terminal-cyan',
    red: 'text-terminal-red',
    none: 'text-terminal-muted'
  }

  const logoLines = logo.split('\n')
  const maxLineLength = Math.max(...logoLines.map(line => line.length))
  const cloudText = 'C L O U D'
  const cloudPadding = Math.floor((maxLineLength - cloudText.length) / 2)

  const renderBorderedLogo = () => {
    const borderWidth = maxLineLength + 4
    const topBorder = '┌' + '─'.repeat(borderWidth) + '┐'
    const bottomBorder = '└' + '─'.repeat(borderWidth) + '┘'

    return (
      <div className={`font-mono whitespace-pre leading-none ${className}`}>
        <div className={borderGlowClasses[glowColor]} aria-hidden="true">
          {topBorder}
        </div>
        {logoLines.map((line, index) => (
          <div key={index} aria-hidden="true">
            <span className={borderGlowClasses[glowColor]}>│  </span>
            <span className={glowClasses[glowColor]}>{line.padEnd(maxLineLength)}</span>
            <span className={borderGlowClasses[glowColor]}>  │</span>
          </div>
        ))}
        {showCloud && displayVariant === 'full' && (
          <div aria-hidden="true">
            <span className={borderGlowClasses[glowColor]}>│  </span>
            <span className={`${glowClasses[glowColor]} tracking-[0.5em]`}>
              {' '.repeat(cloudPadding)}{cloudText}{' '.repeat(maxLineLength - cloudPadding - cloudText.length)}
            </span>
            <span className={borderGlowClasses[glowColor]}>  │</span>
          </div>
        )}
        <div className={borderGlowClasses[glowColor]} aria-hidden="true">
          {bottomBorder}
        </div>
      </div>
    )
  }

  const renderSimpleLogo = () => (
    <div className={`font-mono whitespace-pre leading-none ${className}`} aria-hidden="true">
      <div className={glowClasses[glowColor]}>
        {logo}
      </div>
      {showCloud && displayVariant === 'full' && (
        <div className={`${glowClasses[glowColor]} tracking-[0.5em] mt-1`}>
          {' '.repeat(cloudPadding)}{cloudText}
        </div>
      )}
    </div>
  )

  return (
    <div role="img" aria-label="Dangus Cloud">
      {showBorder ? renderBorderedLogo() : renderSimpleLogo()}
    </div>
  )
}

export default AsciiLogo
