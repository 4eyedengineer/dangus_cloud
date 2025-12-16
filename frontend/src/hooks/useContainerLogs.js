import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

/**
 * Hook for streaming container logs via WebSocket
 * @param {string} serviceId - The service ID to stream logs for
 * @param {object} options - Options for the log stream
 * @param {string} options.pod - Specific pod name (optional)
 * @param {string} options.container - Specific container name (optional)
 * @param {number} options.tailLines - Number of lines to tail (default 100)
 * @param {boolean} enabled - Whether to enable the WebSocket connection
 * @returns {{ logs: string, pods: Array, selectedPod: string, status: string, error: string|null }}
 */
export function useContainerLogs(serviceId, options = {}, enabled = true) {
  const [logs, setLogs] = useState('')
  const [pods, setPods] = useState([])
  const [selectedPod, setSelectedPod] = useState(options.pod || null)
  const [selectedContainer, setSelectedContainer] = useState(options.container || null)
  const [status, setStatus] = useState('idle') // idle, connecting, streaming, disconnected, error
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState(null)
  const wsRef = useRef(null)

  const connect = useCallback(() => {
    if (!serviceId || !enabled) return

    // Build WebSocket URL with query params
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const apiUrl = new URL(API_BASE_URL, window.location.origin)

    const params = new URLSearchParams()
    if (selectedPod) params.append('pod', selectedPod)
    if (selectedContainer) params.append('container', selectedContainer)
    if (options.tailLines) params.append('tailLines', options.tailLines)

    const queryString = params.toString()
    const wsUrl = `${wsProtocol}//${apiUrl.host}${apiUrl.pathname}/services/${serviceId}/logs/stream${queryString ? `?${queryString}` : ''}`

    setStatus('connecting')
    setStatusMessage('Connecting to container logs...')
    setError(null)

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('streaming')
      setStatusMessage('Connected')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        switch (msg.type) {
          case 'connected':
            setStatus('streaming')
            setStatusMessage(`Streaming logs from ${msg.pod}`)
            if (!selectedPod) setSelectedPod(msg.pod)
            break

          case 'pods':
            setPods(msg.pods || [])
            break

          case 'log':
            setLogs(prev => prev + msg.data)
            break

          case 'error':
            setError(msg.message)
            setStatus('error')
            break

          case 'end':
            setStatusMessage('Log stream ended')
            setStatus('disconnected')
            break

          default:
            console.warn('Unknown message type:', msg.type)
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection error')
      setStatus('error')
    }

    ws.onclose = (event) => {
      if (event.code !== 1000 && event.code !== 1001 && status === 'streaming') {
        setError(`Connection closed unexpectedly`)
        setStatus('error')
      } else if (status !== 'error') {
        setStatus('disconnected')
      }
    }
  }, [serviceId, selectedPod, selectedContainer, options.tailLines, enabled, status])

  // Disconnect function
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected')
      wsRef.current = null
    }
    setStatus('disconnected')
    setStatusMessage('Disconnected')
  }, [])

  // Reconnect function
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setLogs('')
    setError(null)
    connect()
  }, [connect])

  // Change pod function
  const changePod = useCallback((podName) => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setSelectedPod(podName)
    setLogs('')
    setError(null)
  }, [])

  // Clear logs function
  const clearLogs = useCallback(() => {
    setLogs('')
  }, [])

  // Connect when enabled and serviceId changes, or when pod changes
  useEffect(() => {
    if (enabled && serviceId && status !== 'streaming') {
      connect()
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
    }
  }, [serviceId, enabled, selectedPod])

  return {
    logs,
    pods,
    selectedPod,
    selectedContainer,
    status,
    statusMessage,
    error,
    connect,
    disconnect,
    reconnect,
    changePod,
    clearLogs,
    setSelectedPod,
    setSelectedContainer,
    isConnected: status === 'streaming',
    isDisconnected: status === 'disconnected' || status === 'idle',
    isError: status === 'error'
  }
}

export default useContainerLogs
