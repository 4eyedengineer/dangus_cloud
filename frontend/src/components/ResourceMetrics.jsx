import { useState, useEffect, useRef } from 'react'
import TerminalSpinner from './TerminalSpinner'
import { TerminalCard } from './TerminalCard'
import { SegmentedGauge } from './SegmentedGauge'
import { useWebSocket } from '../hooks/useWebSocket'

// v2 threshold colors
const getStatusColor = (percent) => {
  if (percent <= 50) return '#33ff33'  // healthy
  if (percent <= 70) return '#aaff33'  // warning
  if (percent <= 85) return '#ffaa33'  // caution
  return '#ff3333'                      // critical
}

// Format display values
const formatValue = (val, unit) => {
  if (unit === 'm') return `${Math.round(val)}${unit}`
  if (unit === 'Mi') return `${Math.round(val)}${unit}`
  return `${val}${unit}`
}

function MetricGaugeArc({ label, value, max, unit }) {
  const percent = max ? Math.min(Math.round((value / max) * 100), 100) : 0
  const hasLimit = max !== null && max !== undefined

  if (!hasLimit) {
    return (
      <div className="flex flex-col items-center font-mono">
        <div className="text-xs text-terminal-muted uppercase mb-2">{label}</div>
        <div className="text-terminal-cyan text-lg">
          {formatValue(value, unit)}
        </div>
        <div className="text-xs text-terminal-muted mt-1">No limit set</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <SegmentedGauge
        value={value}
        max={max}
        title={label}
        size={120}
        unit="%"
      />
      <div className="text-xs text-terminal-muted mt-2 font-mono">
        {formatValue(value, unit)} / {formatValue(max, unit)}
      </div>
    </div>
  )
}

function PodMetricRow({ pod, isLast }) {
  const cpuPercent = pod.cpu.percentUsed
  const memPercent = pod.memory.percentUsed

  // v2 threshold-based color classes
  const getStatusColorClass = (pct) => {
    if (pct === null) return 'text-terminal-muted'
    if (pct <= 50) return 'text-status-healthy'
    if (pct <= 70) return 'text-status-warning'
    if (pct <= 85) return 'text-status-caution'
    return 'text-status-critical'
  }

  // Get phase color
  const getPhaseColor = (phase) => {
    switch (phase) {
      case 'Running': return 'text-terminal-green'
      case 'Pending': return 'text-terminal-amber'
      case 'Failed': return 'text-terminal-red'
      case 'Succeeded': return 'text-terminal-cyan'
      default: return 'text-terminal-muted'
    }
  }

  return (
    <div className={`py-2 ${!isLast ? 'border-b border-terminal-border' : ''}`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-terminal-muted">Pod:</span>
          <span className="text-terminal-cyan truncate max-w-[180px]">{pod.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={getPhaseColor(pod.phase)}>{pod.phase || 'Unknown'}</span>
          {pod.restartCount > 0 && (
            <span className="text-terminal-amber text-xs">
              ({pod.restartCount} restart{pod.restartCount > 1 ? 's' : ''})
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-6 mt-1 text-xs">
        <span className={getStatusColorClass(cpuPercent)}>
          CPU: {pod.cpu.usage}
          {cpuPercent !== null && ` (${cpuPercent}%)`}
        </span>
        <span className={getStatusColorClass(memPercent)}>
          MEM: {pod.memory.usage}
          {memPercent !== null && ` (${memPercent}%)`}
        </span>
        {pod.ready !== undefined && (
          <span className={pod.ready ? 'text-terminal-green' : 'text-terminal-red'}>
            {pod.ready ? 'Ready' : 'Not Ready'}
          </span>
        )}
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
      <TerminalCard title="Resource Usage" variant="cyan">
        <div className="flex items-center justify-center py-4">
          <TerminalSpinner color="cyan" />
          <span className="ml-2 text-terminal-muted font-mono text-sm">Loading metrics...</span>
        </div>
      </TerminalCard>
    )
  }

  if (error) {
    return (
      <TerminalCard title="Resource Usage" variant="red">
        <div className="text-center py-4">
          <p className="font-mono text-terminal-red text-sm">! {error}</p>
        </div>
      </TerminalCard>
    )
  }

  if (!metrics || !metrics.available) {
    return (
      <TerminalCard title="Resource Usage" variant="cyan">
        <div className="text-center py-4">
          <p className="font-mono text-terminal-muted text-sm">
            {metrics?.message || 'Metrics not available. Service may not be running.'}
          </p>
        </div>
      </TerminalCard>
    )
  }

  // Convert bytes to Mi for display
  const memoryMi = Math.round(metrics.aggregated.totalMemoryBytes / 1024 / 1024)
  const memoryLimitMi = metrics.limits?.memoryBytes
    ? Math.round(metrics.limits.memoryBytes / 1024 / 1024)
    : null

  return (
    <TerminalCard title="Resource Usage" variant="cyan">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <MetricGaugeArc
          label="CPU"
          value={metrics.aggregated.totalCpuMillicores}
          max={metrics.limits?.cpuMillicores}
          unit="m"
        />
        <MetricGaugeArc
          label="Memory"
          value={memoryMi}
          max={memoryLimitMi}
          unit="Mi"
        />
      </div>

      {metrics.pods.length > 0 && (
        <div className="border-t border-terminal-border pt-3 mt-3">
          <div className="flex justify-between items-center text-xs text-terminal-muted uppercase mb-2">
            <span>Pods ({metrics.aggregated.podCount})</span>
            <div className="flex gap-3">
              {metrics.aggregated.ready !== undefined && (
                <span className={metrics.aggregated.ready === metrics.aggregated.podCount ? 'text-terminal-green' : 'text-terminal-amber'}>
                  {metrics.aggregated.ready}/{metrics.aggregated.podCount} Ready
                </span>
              )}
              {metrics.aggregated.restarts > 0 && (
                <span className="text-terminal-amber">
                  {metrics.aggregated.restarts} restart{metrics.aggregated.restarts > 1 ? 's' : ''}
                </span>
              )}
            </div>
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
    </TerminalCard>
  )
}

export default ResourceMetrics
