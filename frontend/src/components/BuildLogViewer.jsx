import { useEffect, useRef, useState } from 'react'
import { useBuildLogs } from '../hooks/useBuildLogs'
import TerminalSpinner from './TerminalSpinner'

/**
 * Real-time build log viewer component
 * Streams logs via WebSocket and auto-scrolls to bottom
 */
export function BuildLogViewer({ deploymentId, enabled = true, onComplete }) {
  const {
    logs,
    status,
    statusMessage,
    error,
    reconnect,
    isComplete,
    isError
  } = useBuildLogs(deploymentId, enabled)

  const logRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // Call onComplete callback when build completes
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete(status)
    }
  }, [isComplete, status, onComplete])

  // Detect manual scrolling to disable auto-scroll
  const handleScroll = () => {
    if (!logRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = logRef.current
    // If user scrolls up more than 100px from bottom, disable auto-scroll
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(isNearBottom)
  }

  const getStatusColor = () => {
    switch (status) {
      case 'streaming':
        return 'text-terminal-cyan'
      case 'complete':
        return statusMessage.includes('succeeded') ? 'text-terminal-primary' : 'text-terminal-red'
      case 'error':
        return 'text-terminal-red'
      default:
        return 'text-terminal-muted'
    }
  }

  const getStatusIndicator = () => {
    switch (status) {
      case 'connecting':
      case 'streaming':
        return <span className="inline-block w-2 h-2 bg-terminal-cyan rounded-full animate-pulse mr-2" />
      case 'complete':
        return statusMessage.includes('succeeded')
          ? <span className="inline-block w-2 h-2 bg-terminal-primary rounded-full mr-2" />
          : <span className="inline-block w-2 h-2 bg-terminal-red rounded-full mr-2" />
      case 'error':
        return <span className="inline-block w-2 h-2 bg-terminal-red rounded-full mr-2" />
      default:
        return <span className="inline-block w-2 h-2 bg-terminal-muted rounded-full mr-2" />
    }
  }

  return (
    <div className="border border-terminal-border bg-terminal-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-bg-elevated">
        <div className="flex items-center">
          {getStatusIndicator()}
          <span className={`font-mono text-xs uppercase ${getStatusColor()}`}>
            {status === 'streaming' ? 'STREAMING' : status.toUpperCase()}
          </span>
          {statusMessage && (
            <span className="font-mono text-xs text-terminal-muted ml-3">
              {statusMessage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true)
                if (logRef.current) {
                  logRef.current.scrollTop = logRef.current.scrollHeight
                }
              }}
              className="font-mono text-xs text-terminal-muted hover:text-terminal-primary transition-colors"
            >
              [SCROLL TO BOTTOM]
            </button>
          )}
          {isError && (
            <button
              onClick={reconnect}
              className="font-mono text-xs text-terminal-secondary hover:text-terminal-primary transition-colors"
            >
              [RETRY]
            </button>
          )}
        </div>
      </div>

      {/* Log content */}
      <div
        ref={logRef}
        onScroll={handleScroll}
        className="font-mono text-xs bg-black text-terminal-primary p-4 h-80 overflow-auto"
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      >
        {error && (
          <div className="text-terminal-red mb-2">
            ! Error: {error}
          </div>
        )}

        {status === 'connecting' && !logs && (
          <div className="flex items-center gap-2 text-terminal-muted">
            <TerminalSpinner />
            <span>Connecting to build logs...</span>
          </div>
        )}

        {logs ? (
          <pre className="m-0">{logs}</pre>
        ) : status === 'streaming' && !logs ? (
          <div className="flex items-center gap-2 text-terminal-muted">
            <TerminalSpinner />
            <span>Waiting for logs...</span>
          </div>
        ) : null}

        {status === 'streaming' && (
          <span className="inline-block w-2 h-4 bg-terminal-primary animate-pulse ml-1" />
        )}
      </div>
    </div>
  )
}

export default BuildLogViewer
