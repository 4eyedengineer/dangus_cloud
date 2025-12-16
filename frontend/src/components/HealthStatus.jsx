import { useState, useEffect } from 'react'
import TerminalSpinner from './TerminalSpinner'
import { AsciiBox } from './AsciiBox'
import { StatusIndicator } from './StatusIndicator'

function ResponseTimeChart({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-2 text-terminal-muted text-xs font-mono">
        No response time data available
      </div>
    )
  }

  // Get last 10 entries for the chart
  const chartData = history.slice(0, 10).reverse()
  const maxTime = Math.max(...chartData.map(h => h.responseTimeMs || 0), 100)
  const chartHeight = 40

  return (
    <div className="font-mono">
      <div className="text-xs text-terminal-muted uppercase mb-2">Response Time (last 10 checks)</div>
      <div className="flex items-end gap-1 h-10 border-l border-b border-terminal-border pl-1">
        {chartData.map((entry, idx) => {
          const height = entry.responseTimeMs
            ? Math.max((entry.responseTimeMs / maxTime) * chartHeight, 2)
            : 0
          const isHealthy = entry.status === 'healthy'

          return (
            <div
              key={idx}
              className={`w-4 transition-all ${isHealthy ? 'bg-terminal-primary' : 'bg-terminal-red'}`}
              style={{ height: `${height}px` }}
              title={`${entry.responseTimeMs || 0}ms - ${entry.status}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-terminal-muted mt-1">
        <span>0ms</span>
        <span>{maxTime}ms</span>
      </div>
    </div>
  )
}

function PodHealthRow({ pod, isLast }) {
  const isReady = pod.ready
  const statusColor = isReady ? 'text-terminal-primary' : 'text-terminal-red'
  const indicator = isReady ? '\u25CF' : '\u25CB'

  return (
    <div className={`py-2 ${!isLast ? 'border-b border-terminal-border' : ''}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className={statusColor}>{indicator}</span>
        <span className="text-terminal-cyan truncate max-w-[200px]">{pod.name}</span>
        <span className={`text-xs ${isReady ? 'text-terminal-primary' : 'text-terminal-red'}`}>
          {isReady ? 'Ready' : 'Not Ready'}
        </span>
      </div>
      <div className="flex gap-4 mt-1 text-xs text-terminal-muted ml-4">
        <span>Phase: {pod.phase || 'Unknown'}</span>
        <span>Restarts: {pod.restartCount}</span>
      </div>
      <div className="flex gap-4 mt-1 text-xs ml-4">
        <span className={pod.readiness?.status === 'passing' ? 'text-terminal-primary' : 'text-terminal-red'}>
          Readiness: {pod.readiness?.status || 'unknown'}
        </span>
        <span className={pod.liveness?.status === 'passing' ? 'text-terminal-primary' : 'text-terminal-red'}>
          Liveness: {pod.liveness?.status || 'unknown'}
        </span>
      </div>
    </div>
  )
}

function EventRow({ event, isLast }) {
  const isWarning = event.type === 'Warning'
  const timeAgo = formatTimeAgo(event.lastTimestamp)

  return (
    <div className={`py-2 text-xs font-mono ${!isLast ? 'border-b border-terminal-border' : ''}`}>
      <div className="flex items-center gap-2">
        <span className={isWarning ? 'text-terminal-red' : 'text-terminal-primary'}>
          {isWarning ? '\u25CB' : '\u25CF'}
        </span>
        <span className="text-terminal-muted">{timeAgo}</span>
        <span className={isWarning ? 'text-terminal-secondary' : 'text-terminal-muted'}>
          {event.reason}
        </span>
        {event.count > 1 && (
          <span className="text-terminal-muted">(x{event.count})</span>
        )}
      </div>
      <div className="ml-4 text-terminal-muted truncate" title={event.message}>
        {event.message}
      </div>
    </div>
  )
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'unknown'
  const now = new Date()
  const then = new Date(timestamp)
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function HealthStatus({ serviceId, fetchHealth, refreshInterval = 30000 }) {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!serviceId || !fetchHealth) return

    let mounted = true

    const loadHealth = async () => {
      try {
        const data = await fetchHealth(serviceId)
        if (mounted) {
          setHealth(data)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load health status')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    // Initial load
    loadHealth()

    // Set up polling
    const interval = setInterval(loadHealth, refreshInterval)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [serviceId, fetchHealth, refreshInterval])

  if (loading) {
    return (
      <AsciiBox title="Health Status" variant="cyan">
        <div className="flex items-center justify-center py-4">
          <TerminalSpinner color="cyan" />
          <span className="ml-2 text-terminal-muted font-mono text-sm">Loading health status...</span>
        </div>
      </AsciiBox>
    )
  }

  if (error) {
    return (
      <AsciiBox title="Health Status" variant="red">
        <div className="text-center py-4">
          <p className="font-mono text-terminal-red text-sm">! {error}</p>
        </div>
      </AsciiBox>
    )
  }

  if (!health || !health.configured) {
    return (
      <AsciiBox title="Health Status" variant="cyan">
        <div className="text-center py-4">
          <p className="font-mono text-terminal-muted text-sm">
            No health check configured for this service.
          </p>
          <p className="font-mono text-terminal-muted text-xs mt-2">
            Configure a health check path in service settings to enable monitoring.
          </p>
        </div>
      </AsciiBox>
    )
  }

  const isHealthy = health.status === 'healthy'
  const variant = isHealthy ? 'green' : 'red'

  return (
    <AsciiBox title="Health Status" variant={variant}>
      {/* Current Status Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-terminal-border">
        <div className="flex items-center gap-4">
          <StatusIndicator
            status={isHealthy ? 'online' : 'error'}
            label={isHealthy ? 'HEALTHY' : 'UNHEALTHY'}
          />
          <span className="font-mono text-xs text-terminal-muted">
            {health.path}
          </span>
        </div>
        {health.activeCheck && (
          <div className="font-mono text-sm">
            <span className={isHealthy ? 'text-terminal-primary' : 'text-terminal-red'}>
              {health.activeCheck.responseTimeMs}ms
            </span>
            {health.activeCheck.statusCode && (
              <span className="text-terminal-muted ml-2">
                HTTP {health.activeCheck.statusCode}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Active Check Status */}
      {health.activeCheck && (
        <div className="mb-4">
          <div className="text-xs text-terminal-muted uppercase mb-2">Active Health Check</div>
          <div className="font-mono text-sm">
            <span className={health.activeCheck.status === 'healthy' ? 'text-terminal-primary' : 'text-terminal-red'}>
              {health.activeCheck.status === 'healthy' ? '\u2713' : '\u2717'}
            </span>
            <span className="text-terminal-muted ml-2">
              {health.activeCheck.status === 'healthy' ? 'Endpoint responding' : (health.activeCheck.error || 'Endpoint not responding')}
            </span>
          </div>
        </div>
      )}

      {/* Pod Status */}
      {health.pods && health.pods.length > 0 && (
        <div className="mb-4 border-t border-terminal-border pt-3">
          <div className="text-xs text-terminal-muted uppercase mb-2">
            Pods ({health.pods.length})
          </div>
          {health.pods.map((pod, index) => (
            <PodHealthRow
              key={pod.name}
              pod={pod}
              isLast={index === health.pods.length - 1}
            />
          ))}
        </div>
      )}

      {/* Response Time Chart */}
      {health.history && health.history.length > 0 && (
        <div className="mb-4 border-t border-terminal-border pt-3">
          <ResponseTimeChart history={health.history} />
        </div>
      )}

      {/* Recent Events */}
      {health.events && health.events.length > 0 && (
        <div className="border-t border-terminal-border pt-3">
          <div className="text-xs text-terminal-muted uppercase mb-2">Recent Events</div>
          {health.events.slice(0, 5).map((event, index) => (
            <EventRow
              key={`${event.lastTimestamp}-${index}`}
              event={event}
              isLast={index === Math.min(health.events.length, 5) - 1}
            />
          ))}
        </div>
      )}

      <div className="text-xs text-terminal-muted mt-3 text-right">
        Auto-refreshing every {refreshInterval / 1000}s
      </div>
    </AsciiBox>
  )
}

export default HealthStatus
