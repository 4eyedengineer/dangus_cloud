import { useState, useEffect, useCallback } from 'react'
import { AsciiLogo } from './AsciiLogo'
import { AsciiDivider } from './AsciiDivider'
import { DigitalDebrisFill } from './DigitalDebris'
import { StatusIndicator } from './StatusIndicator'
import { useWebSocket } from '../hooks/useWebSocket'

export function Layout({
  children,
  breadcrumbs = [],
  showSidebar = true,
  sidebarContent = null,
  navItems = [
    { label: 'Dashboard', href: '/', active: true },
    { label: 'Projects', href: '/projects' },
    { label: 'Settings', href: '/settings' },
    { label: 'Logout', href: '/logout' }
  ],
  onNavClick = () => {},
  showKeyboardHints = true,
  className = '',
  userName = null
}) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { connectionState: wsConnectionState, reconnect: wsReconnect } = useWebSocket()

  // Map WebSocket connection state to status indicator
  const wsStatusMap = {
    connected: 'online',
    connecting: 'pending',
    reconnecting: 'warning',
    disconnected: 'offline',
    failed: 'error'
  }

  const wsLabelMap = {
    connected: 'WS LIVE',
    connecting: 'WS CONNECTING',
    reconnecting: 'WS RECONNECTING',
    disconnected: 'WS OFFLINE',
    failed: 'WS FAILED'
  }

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    // Alt + number keys for nav items
    if (e.altKey && e.key >= '1' && e.key <= '9') {
      const index = parseInt(e.key) - 1
      if (navItems[index]) {
        e.preventDefault()
        onNavClick(navItems[index])
      }
    }
    // Alt + S to toggle sidebar
    if (e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      setSidebarCollapsed(prev => !prev)
    }
  }, [navItems, onNavClick])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const formatTimestamp = (date) => {
    return date.toISOString().replace('T', ' ').substring(0, 19)
  }


  return (
    <div className={`min-h-screen bg-terminal-primary flex flex-col terminal-grid-bg ${className}`}>
      {/* Header */}
      <header className="border-b border-terminal-border">
        {/* Top bar with logo and system status */}
        <div className="flex items-start justify-between px-4 py-3 md:px-6 md:py-4 relative">
          {/* Digital debris effect */}
          {!isMobile && <DigitalDebrisFill density="sparse" seed={42} />}

          {/* ASCII Logo */}
          <div className="flex-shrink-0 relative z-10">
            <AsciiLogo
              variant="full"
              showBorder={!isMobile}
              showCloud={!isMobile}
              glowColor="green"
              useHeatGradient={!isMobile}
            />
          </div>

          {/* System Status */}
          <div className="flex flex-col items-end gap-1 relative z-10">
            {userName && (
              <div className="flex items-center gap-2 text-sm font-mono mb-1">
                <span className="text-terminal-muted uppercase tracking-terminal-wide">
                  USER:
                </span>
                <span className="text-terminal-primary">
                  {userName}
                </span>
              </div>
            )}
            {!isMobile && (
              <div className="text-terminal-muted text-xs font-mono">
                {formatTimestamp(currentTime)}
              </div>
            )}
          </div>
        </div>

        {/* Navigation bar */}
        <nav
          className="px-4 py-2 md:px-6 border-t border-terminal-border bg-terminal-bg-secondary"
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="flex items-center gap-1 md:gap-2 flex-wrap">
            {navItems.map((item, index) => (
              <span key={item.label} className="inline-flex items-center">
                <button
                  onClick={() => onNavClick(item)}
                  className={`
                    font-mono text-sm md:text-base transition-terminal-fast
                    ${item.active
                      ? 'text-terminal-primary text-glow-green'
                      : 'text-terminal-secondary hover:text-terminal-primary'
                    }
                  `}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.label}
                </button>
                {index < navItems.length - 1 && (
                  <span className="text-terminal-muted mx-2" aria-hidden="true">
                    –
                  </span>
                )}
              </span>
            ))}

            {/* Keyboard hint */}
            {showKeyboardHints && !isMobile && (
              <span className="ml-auto text-terminal-muted text-xs font-mono hidden lg:inline">
                Alt+1-{Math.min(navItems.length, 9)} to navigate
              </span>
            )}
          </div>
        </nav>

        {/* Breadcrumb navigation */}
        {breadcrumbs.length > 0 && (
          <div className="px-4 py-2 md:px-6 border-t border-terminal-border">
            <nav aria-label="Breadcrumb" className="font-mono text-sm">
              <ol className="flex items-center gap-1 flex-wrap">
                <li>
                  <span className="text-terminal-primary">root</span>
                </li>
                {breadcrumbs.map((crumb, index) => (
                  <li key={index} className="flex items-center gap-1">
                    <span className="text-terminal-muted" aria-hidden="true">
                      /
                    </span>
                    {crumb.href ? (
                      <a
                        href={crumb.href}
                        className="text-terminal-secondary hover:text-terminal-primary transition-terminal-fast"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="text-terminal-primary">{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        )}
      </header>

      {/* Main content area with optional sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (desktop only) */}
        {showSidebar && sidebarContent && !isMobile && (
          <aside
            className={`
              border-r border-terminal-border bg-terminal-bg-secondary
              transition-all duration-200 ease-in-out
              ${sidebarCollapsed ? 'w-12' : 'w-64'}
            `}
            aria-label="Sidebar"
          >
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full px-3 py-2 text-terminal-muted hover:text-terminal-primary
                         border-b border-terminal-border font-mono text-sm
                         transition-terminal-fast flex items-center justify-between"
              aria-expanded={!sidebarCollapsed}
              aria-controls="sidebar-content"
            >
              {!sidebarCollapsed && <span>MENU</span>}
              <span aria-hidden="true">
                {sidebarCollapsed ? '►' : '◄'}
              </span>
            </button>

            {/* Sidebar content */}
            <div
              id="sidebar-content"
              className={`
                overflow-y-auto
                ${sidebarCollapsed ? 'hidden' : 'block'}
              `}
            >
              {sidebarContent}
            </div>

            {/* Keyboard hint for sidebar */}
            {showKeyboardHints && !sidebarCollapsed && (
              <div className="absolute bottom-0 left-0 w-64 px-3 py-2 border-t border-terminal-border">
                <span className="text-terminal-muted text-xs font-mono">
                  Alt+S to toggle
                </span>
              </div>
            )}
          </aside>
        )}

        {/* Main content */}
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6"
          role="main"
        >
          {children}
        </main>
      </div>

      {/* Footer status bar */}
      <footer className="border-t border-terminal-border px-4 py-2 md:px-6">
        <div className="flex items-center justify-between font-mono text-xs md:text-sm">
          <div className="flex items-center gap-3">
            <StatusIndicator
              status={wsStatusMap[wsConnectionState] || 'offline'}
              label={wsLabelMap[wsConnectionState] || 'WS'}
              size="sm"
            />
            {wsConnectionState === 'failed' && (
              <button
                onClick={wsReconnect}
                className="text-terminal-secondary hover:text-terminal-primary transition-colors text-xs"
                title="Reconnect WebSocket"
              >
                [RETRY]
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-terminal-muted">
            {!isMobile && (
              <span className="hidden md:inline">
                DANGUS CLOUD v1.0
              </span>
            )}
            <span aria-hidden="true">│</span>
            <time dateTime={currentTime.toISOString()}>
              {formatTimestamp(currentTime)}
            </time>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="font-mono text-sm">
      <ol className="flex items-center gap-1 flex-wrap">
        <li>
          <span className="text-terminal-primary">root</span>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            <span className="text-terminal-muted" aria-hidden="true">
              /
            </span>
            {item.href ? (
              <a
                href={item.href}
                className="text-terminal-secondary hover:text-terminal-primary transition-terminal-fast"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-terminal-primary">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function SidebarMenu({ items = [], onItemClick = () => {} }) {
  return (
    <nav className="py-2">
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => onItemClick(item)}
          className={`
            w-full px-4 py-2 text-left font-mono text-sm
            transition-terminal-fast flex items-center gap-2
            ${item.active
              ? 'text-terminal-primary bg-terminal-bg-elevated'
              : 'text-terminal-secondary hover:text-terminal-primary hover:bg-terminal-bg-elevated'
            }
          `}
        >
          <span aria-hidden="true">
            {item.active ? '►' : ' '}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default Layout
