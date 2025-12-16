import { useEffect, useRef, useState, useMemo } from 'react'
import { useContainerLogs } from '../hooks/useContainerLogs'
import { fetchServiceLogs } from '../api/services'
import TerminalSpinner from './TerminalSpinner'
import TerminalButton from './TerminalButton'
import TerminalInput from './TerminalInput'

/**
 * Container logs viewer component
 * Supports real-time streaming and historical log viewing
 */
export function LogViewer({ serviceId, enabled = true }) {
  const [mode, setMode] = useState('historical') // 'historical' or 'streaming'
  const [historicalLogs, setHistoricalLogs] = useState('')
  const [historicalPods, setHistoricalPods] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [filter, setFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [selectedPodName, setSelectedPodName] = useState('')
  const [tailLines, setTailLines] = useState(200)

  const logRef = useRef(null)

  const {
    logs: streamLogs,
    pods: streamPods,
    selectedPod,
    status,
    statusMessage,
    error: streamError,
    connect,
    disconnect,
    reconnect,
    changePod,
    clearLogs,
    isConnected,
    isDisconnected,
    isError
  } = useContainerLogs(serviceId, { tailLines: 100 }, mode === 'streaming' && enabled)

  // Fetch historical logs
  const fetchLogs = async (podName = selectedPodName) => {
    setLoading(true)
    setFetchError(null)
    try {
      const result = await fetchServiceLogs(serviceId, {
        tailLines,
        pod: podName || undefined
      })
      setHistoricalPods(result.pods || [])
      if (result.pods && result.pods.length > 0) {
        const targetPod = podName
          ? result.pods.find(p => p.name === podName)
          : result.pods[0]
        if (targetPod) {
          setHistoricalLogs(targetPod.logs || '')
          if (!selectedPodName) {
            setSelectedPodName(targetPod.name)
          }
        }
      } else {
        setHistoricalLogs('')
      }
    } catch (err) {
      setFetchError(err.message || 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch when component mounts
  useEffect(() => {
    if (enabled && mode === 'historical') {
      fetchLogs()
    }
  }, [serviceId, enabled, mode])

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [streamLogs, historicalLogs, autoScroll])

  // Detect manual scrolling
  const handleScroll = () => {
    if (!logRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = logRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(isNearBottom)
  }

  // Get active logs and pods based on mode
  const activeLogs = mode === 'streaming' ? streamLogs : historicalLogs
  const activePods = mode === 'streaming' ? streamPods : historicalPods
  const activeError = mode === 'streaming' ? streamError : fetchError

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!filter.trim()) return activeLogs
    const lines = activeLogs.split('\n')
    return lines
      .filter(line => line.toLowerCase().includes(filter.toLowerCase()))
      .join('\n')
  }, [activeLogs, filter])

  // Handle pod change
  const handlePodChange = (e) => {
    const podName = e.target.value
    setSelectedPodName(podName)
    if (mode === 'streaming') {
      changePod(podName)
    } else {
      fetchLogs(podName)
    }
  }

  // Handle mode toggle
  const handleModeToggle = () => {
    if (mode === 'historical') {
      setMode('streaming')
    } else {
      disconnect()
      setMode('historical')
      fetchLogs(selectedPodName)
    }
  }

  // Download logs
  const downloadLogs = () => {
    const blob = new Blob([activeLogs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${serviceId}-${selectedPodName || 'all'}-${new Date().toISOString().slice(0, 19)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getStatusColor = () => {
    if (mode === 'historical') return 'text-terminal-secondary'
    switch (status) {
      case 'streaming':
        return 'text-terminal-cyan'
      case 'error':
        return 'text-terminal-red'
      default:
        return 'text-terminal-muted'
    }
  }

  const getStatusIndicator = () => {
    if (mode === 'historical') {
      return loading
        ? <TerminalSpinner className="mr-2" />
        : <span className="inline-block w-2 h-2 bg-terminal-secondary rounded-full mr-2" />
    }
    switch (status) {
      case 'connecting':
      case 'streaming':
        return <span className="inline-block w-2 h-2 bg-terminal-cyan rounded-full animate-pulse mr-2" />
      case 'error':
        return <span className="inline-block w-2 h-2 bg-terminal-red rounded-full mr-2" />
      default:
        return <span className="inline-block w-2 h-2 bg-terminal-muted rounded-full mr-2" />
    }
  }

  const getStatusText = () => {
    if (mode === 'historical') {
      return loading ? 'LOADING' : 'HISTORICAL'
    }
    return status === 'streaming' ? 'STREAMING' : status.toUpperCase()
  }

  return (
    <div className="border border-terminal-border bg-terminal-bg-secondary">
      {/* Header */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-terminal-border bg-terminal-bg-elevated">
        {/* Top row: Status and controls */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center">
            {getStatusIndicator()}
            <span className={`font-mono text-xs uppercase ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            {statusMessage && mode === 'streaming' && (
              <span className="font-mono text-xs text-terminal-muted ml-3">
                {statusMessage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
                [SCROLL]
              </button>
            )}
            {mode === 'historical' && (
              <button
                onClick={() => fetchLogs(selectedPodName)}
                disabled={loading}
                className="font-mono text-xs text-terminal-secondary hover:text-terminal-primary transition-colors disabled:opacity-50"
              >
                [REFRESH]
              </button>
            )}
            {mode === 'streaming' && isError && (
              <button
                onClick={reconnect}
                className="font-mono text-xs text-terminal-secondary hover:text-terminal-primary transition-colors"
              >
                [RETRY]
              </button>
            )}
            {activeLogs && (
              <button
                onClick={downloadLogs}
                className="font-mono text-xs text-terminal-muted hover:text-terminal-primary transition-colors"
              >
                [DOWNLOAD]
              </button>
            )}
            {mode === 'streaming' && (
              <button
                onClick={clearLogs}
                className="font-mono text-xs text-terminal-muted hover:text-terminal-primary transition-colors"
              >
                [CLEAR]
              </button>
            )}
          </div>
        </div>

        {/* Bottom row: Pod selector, filter, mode toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Pod selector */}
          {activePods.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-terminal-muted">POD:</span>
              <select
                value={selectedPodName || (mode === 'streaming' ? selectedPod : '')}
                onChange={handlePodChange}
                className="bg-terminal-bg-secondary text-terminal-primary font-mono text-xs border border-terminal-border px-2 py-1 focus:outline-none focus:border-terminal-primary"
              >
                {activePods.map(pod => (
                  <option key={pod.name} value={pod.name}>
                    {pod.name} ({pod.status || 'Unknown'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter input */}
          <div className="flex items-center gap-2 flex-1 min-w-[150px] max-w-xs">
            <span className="font-mono text-xs text-terminal-muted">FILTER:</span>
            <TerminalInput
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search logs..."
              className="flex-1 text-xs py-1"
            />
          </div>

          {/* Mode toggle */}
          <TerminalButton
            variant={mode === 'streaming' ? 'primary' : 'secondary'}
            onClick={handleModeToggle}
            disabled={loading}
            className="text-xs py-1"
          >
            {mode === 'streaming' ? '[ STOP STREAM ]' : '[ STREAM ]'}
          </TerminalButton>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={logRef}
        onScroll={handleScroll}
        className="font-mono text-xs bg-black text-terminal-primary p-4 h-96 overflow-auto"
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      >
        {activeError && (
          <div className="text-terminal-red mb-2">
            ! Error: {activeError}
          </div>
        )}

        {loading && !filteredLogs && (
          <div className="flex items-center gap-2 text-terminal-muted">
            <TerminalSpinner />
            <span>Loading logs...</span>
          </div>
        )}

        {mode === 'streaming' && status === 'connecting' && !filteredLogs && (
          <div className="flex items-center gap-2 text-terminal-muted">
            <TerminalSpinner />
            <span>Connecting to log stream...</span>
          </div>
        )}

        {!loading && !filteredLogs && !activeError && (
          <div className="text-terminal-muted">
            {activePods.length === 0
              ? 'No running pods found. Deploy the service to view logs.'
              : 'No logs available.'}
          </div>
        )}

        {filteredLogs && (
          <pre className="m-0">{filteredLogs}</pre>
        )}

        {mode === 'streaming' && isConnected && (
          <span className="inline-block w-2 h-4 bg-terminal-primary animate-pulse ml-1" />
        )}
      </div>

      {/* Footer with line count */}
      <div className="px-4 py-2 border-t border-terminal-border bg-terminal-bg-elevated">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-terminal-muted">
            {filteredLogs ? filteredLogs.split('\n').length : 0} lines
            {filter && ` (filtered from ${activeLogs.split('\n').length})`}
          </span>
          {mode === 'historical' && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-terminal-muted">TAIL:</span>
              <select
                value={tailLines}
                onChange={(e) => {
                  setTailLines(parseInt(e.target.value, 10))
                }}
                className="bg-terminal-bg-secondary text-terminal-primary font-mono text-xs border border-terminal-border px-2 py-1 focus:outline-none focus:border-terminal-primary"
              >
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LogViewer
