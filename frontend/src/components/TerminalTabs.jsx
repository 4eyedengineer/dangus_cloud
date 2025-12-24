import { useState } from 'react'
import PropTypes from 'prop-types'

// Color constants matching tailwind.config.js
const COLORS = {
  primary: '#33ff33',
  secondary: '#ffaa00',
  muted: '#888888'
}

export function TerminalTabs({ tabs, activeTab, onTabChange, className = '' }) {
  const [hoveredTab, setHoveredTab] = useState(null)

  return (
    <div role="tablist" className={`flex border-b border-terminal-border ${className}`}>
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id
        const isHovered = hoveredTab === tab.id && !isActive

        // Determine text color: active > hover > muted
        let textColor = COLORS.muted
        if (isActive) textColor = COLORS.primary
        else if (isHovered) textColor = COLORS.secondary

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab(null)}
            className={[
              'px-4 py-2 font-mono text-sm uppercase tracking-wide',
              'transition-terminal-fast outline-none',
              'focus-visible:ring-1 focus-visible:ring-terminal-primary',
              index < tabs.length - 1 ? 'border-r border-terminal-border' : '',
              isActive
                ? 'bg-terminal-bg-elevated border-b-2 border-terminal-primary -mb-px'
                : 'bg-transparent border-b-2 border-transparent hover:bg-terminal-bg-secondary'
            ].filter(Boolean).join(' ')}
            style={{ color: textColor }}
            aria-selected={isActive}
            role="tab"
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

TerminalTabs.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.string
  })).isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  className: PropTypes.string
}

export default TerminalTabs
