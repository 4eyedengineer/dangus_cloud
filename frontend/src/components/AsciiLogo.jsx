import { useState, useEffect } from 'react'

const FULL_LOGO = `██████╗  █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗███████╗
██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██║   ██║██╔════╝
██║  ██║███████║██╔██╗ ██║██║  ███╗██║   ██║███████╗
██║  ██║██╔══██║██║╚██╗██║██║   ██║██║   ██║╚════██║
██████╔╝██║  ██║██║ ╚████║╚██████╔╝╚██████╔╝███████║
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚══════╝`

const COMPACT_LOGO = `DANGUS`

// Heat gradient colors (red → orange → yellow → green)
const HEAT_COLORS = [
  '#ff3333', // red
  '#ff6633', // red-orange
  '#ff9933', // orange
  '#ffcc33', // yellow
  '#33ff33', // green
]

// Get gradient color based on horizontal position
const getHeatColor = (charIndex, totalWidth) => {
  const ratio = charIndex / totalWidth
  const colorIndex = Math.min(Math.floor(ratio * HEAT_COLORS.length), HEAT_COLORS.length - 1)
  return HEAT_COLORS[colorIndex]
}

// Render a line with heat gradient coloring
function HeatGradientLine({ line, maxWidth }) {
  return (
    <span>
      {line.split('').map((char, index) => (
        <span
          key={index}
          style={{ color: char !== ' ' ? getHeatColor(index, maxWidth) : 'transparent' }}
        >
          {char}
        </span>
      ))}
    </span>
  )
}

export function AsciiLogo({
  variant = 'full',
  showCloud = true,
  showBorder = true,
  glowColor = 'green',
  useHeatGradient = true,
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

  // Render logo content with optional heat gradient
  const renderLogoContent = (line, index) => {
    if (useHeatGradient && displayVariant === 'full') {
      return <HeatGradientLine key={index} line={line.padEnd(maxLineLength)} maxWidth={maxLineLength} />
    }
    return <span className={glowClasses[glowColor]}>{line.padEnd(maxLineLength)}</span>
  }

  // Render cloud text with heat gradient
  const renderCloudContent = () => {
    const paddedCloud = ' '.repeat(cloudPadding) + cloudText + ' '.repeat(maxLineLength - cloudPadding - cloudText.length)
    if (useHeatGradient && displayVariant === 'full') {
      return <HeatGradientLine line={paddedCloud} maxWidth={maxLineLength} />
    }
    return (
      <span className={`${glowClasses[glowColor]} tracking-[0.5em]`}>
        {paddedCloud}
      </span>
    )
  }

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
            {renderLogoContent(line, index)}
            <span className={borderGlowClasses[glowColor]}>  │</span>
          </div>
        ))}
        {showCloud && displayVariant === 'full' && (
          <div aria-hidden="true">
            <span className={borderGlowClasses[glowColor]}>│  </span>
            {renderCloudContent()}
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
      <div>
        {logoLines.map((line, index) => (
          <div key={index}>
            {renderLogoContent(line, index)}
          </div>
        ))}
      </div>
      {showCloud && displayVariant === 'full' && (
        <div className="mt-1">
          {renderCloudContent()}
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
