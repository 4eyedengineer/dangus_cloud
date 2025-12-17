import { useState, useEffect, useRef } from 'react'
import TerminalSpinner from './TerminalSpinner'
import { AsciiBox } from './AsciiBox'
import { useWebSocket } from '../hooks/useWebSocket'

function MetricGauge({ label, value, max, unit, showRaw = true }) {
  const percent = max ? Math.min(Math.round((value / max) * 100), 100) : 0
  const hasLimit = max !== null && max !== undefined

  // Color based on usage percentage
  const getColor = (pct) => {
    if (pct > 80) return 'red'
    if (pct > 60) return 'amber'
    return 'green'
  }

  const color = hasLimit ? getColor(percent) : 'cyan'

  const colorClasses = {
    green: 'bg-terminal-primary',
    amber: 'bg-terminal-secondary',
    red: 'bg-terminal-red',
    cyan: 'bg-terminal-cyan'
  }

  const textColorClasses = {
    green: 'text-terminal-primary',
    amber: 'text-terminal-secondary',
    red: 'text-terminal-red',
    cyan: 'text-terminal-cyan'
  }

  // Format display values
  const formatValue = (val, u) => {
    if (u === 'm') return `${Math.round(val)}${u}`
    if (u === 'Mi') return `${Math.round(val)}${u}`
    return `${val}${u}`
  }

  return (
    <div className="font-mono">
      <div className="text-xs text-terminal-muted uppercase mb-1">{label}</div>
      <div className={`text-lg ${textColorClasses[color]}`}>
        {showRaw && (
          <>
            {formatValue(value, unit)}
            {hasLimit && <span className="text-terminal-muted"> / {formatValue(max, unit)}</span>}
          </>
        )}
        {hasLimit && (
          <span className="text-sm text-terminal-muted ml-2">({percent}%)</span>
        )}
        {!hasLimit && !showRaw && (
          <span className="text-terminal-muted text-sm">No limit set</span>
        )}
      </div>
      <div className="h-2 bg-terminal-bg-secondary mt-2 border border-terminal-border">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: hasLimit ? `${percent}%` : '0%' }}
        />
      </div>
      {!hasLimit && (
        <div className="text-xs text-terminal-muted mt-1">
          {formatValue(value, unit)} (no limit)
        </div>
      )}
    </div>
  )
}

function PodMetricRow({ pod, isLast }) {
  const cpuPercent = pod.cpu.percentUsed
  const memPercent = pod.memory.percentUsed

  const getStatusColor = (pct) => {
    if (pct === null) return 'text-terminal-muted'
    if (pct > 80) return 'text-terminal-red'
    if (pct > 60) return 'text-terminal-secondary'
    return 'text-terminal-primary'
  }

  return (
    <div className={`py-2 ${!isLast ? 'border-b border-terminal-border' : ''}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-terminal-muted">Pod:</span>
        <span className="text-terminal-cyan truncate max-w-[200px]">{pod.name}</span>
      </div>
      <div className="flex gap-6 mt-1 text-xs">
        <span className={getStatusColor(cpuPercent)}>
          CPU: {pod.cpu.usage}
          {cpuPercent !== null && ` (${cpuPercent}%)`}
        </span>
        <span className={getStatusColor(memPercent)}>
          MEM: {pod.memory.usage}
          {memPercent !== null && ` (${memPercent}%)`}
        </span>
      </div>
    </div>
  )
}

export function ResourceMetrics({ serviceId, fetchMetrics, refreshInterval = 5000 }) {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const { connectionState, subscribe, isConnected } = useWebSocket()
  const fallbackIntervalRef = useRef(null)

  // Initial fetch
  useEffect(() => {
    if (!serviceId || !fetchMetrics) return

    let mounted = true

    const loadMetrics = async () => {
      try {
        const data = await fetchMetrics(serviceId)
        if (mounted) {
          setMetrics(data)
          setError(null)
          setLastUpdate(new Date().toISOString())
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load metrics')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    // Initial load
    loadMetrics()

    return () => {
      mounted = false
    }
  }, [serviceId, fetchMetrics])

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!serviceId) return

    const channel = `service:${serviceId}:metrics`

    const unsubscribe = subscribe(channel, (event) => {
      const { payload, timestamp } = event
      setMetrics(payload)
      setLastUpdate(timestamp || new Date().toISOString())
      setError(null)
    })

    return () => {
      unsubscribe()
    }
  }, [serviceId, subscribe])

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (!serviceId || !fetchMetrics) return

    const loadMetrics = async () => {
      try {
        const data = await fetchMetrics(serviceId)
        setMetrics(data)
        setError(null)
        setLastUpdate(new Date().toISOString())
      } catch (err) {
        setError(err.message || 'Failed to load metrics')
      }
    }

    // Only use polling as fallback when WebSocket is not connected
    if (!isConnected() && !fallbackIntervalRef.current) {
      fallbackIntervalRef.current = setInterval(loadMetrics, refreshInterval)
    } else if (isConnected() && fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current)
      fallbackIntervalRef.current = null
    }

    return () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current)
        fallbackIntervalRef.current = null
      }
    }
  }, [serviceId, fetchMetrics, refreshInterval, connectionState, isConnected])

  if (loading) {
    return (
      <AsciiBox title="Resource Usage" variant="cyan">
        <div className="flex items-center justify-center py-4">
          <TerminalSpinner color="cyan" />
          <span className="ml-2 text-terminal-muted font-mono text-sm">Loading metrics...</span>
        </div>
      </AsciiBox>
    )
  }

  if (error) {
    return (
      <AsciiBox title="Resource Usage" variant="red">
        <div className="text-center py-4">
          <p className="font-mono text-terminal-red text-sm">! {error}</p>
        </div>
      </AsciiBox>
    )
  }

  if (!metrics || !metrics.available) {
    return (
      <AsciiBox title="Resource Usage" variant="cyan">
        <div className="text-center py-4">
          <p className="font-mono text-terminal-muted text-sm">
            {metrics?.message || 'Metrics not available. Service may not be running.'}
          </p>
        </div>
      </AsciiBox>
    )
  }

  // Convert bytes to Mi for display
  const memoryMi = Math.round(metrics.aggregated.totalMemoryBytes / 1024 / 1024)
  const memoryLimitMi = metrics.limits?.memoryBytes
    ? Math.round(metrics.limits.memoryBytes / 1024 / 1024)
    : null

  return (
    <AsciiBox title="Resource Usage" variant="cyan">
      <div className="grid grid-cols-2 gap-6 mb-4">
        <MetricGauge
          label="CPU"
          value={metrics.aggregated.totalCpuMillicores}
          max={metrics.limits?.cpuMillicores}
          unit="m"
        />
        <MetricGauge
          label="Memory"
          value={memoryMi}
          max={memoryLimitMi}
          unit="Mi"
        />
      </div>

      {metrics.pods.length > 0 && (
        <div className="border-t border-terminal-border pt-3 mt-3">
          <div className="text-xs text-terminal-muted uppercase mb-2">
            Pods ({metrics.aggregated.podCount})
          </div>
          {metrics.pods.map((pod, index) => (
            <PodMetricRow
              key={pod.name}
              pod={pod}
              isLast={index === metrics.pods.length - 1}
            />
          ))}
        </div>
      )}

      <div className="text-xs text-terminal-muted mt-3 text-right flex items-center justify-end gap-2">
        {isConnected() ? (
          <span className="flex items-center gap-1 text-terminal-green">
            <span className="inline-block w-1.5 h-1.5 bg-terminal-green rounded-full" />
            Live updates
          </span>
        ) : (
          <span>Auto-refreshing every {refreshInterval / 1000}s</span>
        )}
      </div>
    </AsciiBox>
  )
}

export default ResourceMetrics
