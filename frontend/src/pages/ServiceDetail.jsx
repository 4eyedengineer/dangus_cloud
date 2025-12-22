import { useState, useEffect, useCallback } from 'react'
import { TerminalCard, TerminalDivider, TerminalSection, TerminalModal } from '../components/TerminalCard'
import { StatusIndicator } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'
import TerminalInput from '../components/TerminalInput'
import TerminalSpinner from '../components/TerminalSpinner'
import { useToast } from '../components/Toast'
import { BuildLogViewer } from '../components/BuildLogViewer'
import { ResourceMetrics } from '../components/ResourceMetrics'
import { DomainManager } from '../components/DomainManager'
import { LogViewer } from '../components/LogViewer'
import { HealthStatus } from '../components/HealthStatus'
import { CloneServiceModal } from '../components/CloneServiceModal'
import { fetchService, triggerDeploy, fetchWebhookSecret, restartService, fetchServiceMetrics, validateDockerfile, fetchServiceHealth, fetchSuggestedPort, fixServicePort, rollbackService, startService, stopService } from '../api/services'
import { fetchEnvVars, createEnvVar, updateEnvVar, deleteEnvVar, revealEnvVar } from '../api/envVars'
import { fetchDeployments } from '../api/deployments'
import { ApiError } from '../api/utils'
import { useDeploymentStatus } from '../hooks/useDeploymentStatus'
import { useWebSocket } from '../hooks/useWebSocket'

export function ServiceDetail({ serviceId, onBack }) {
  const [service, setService] = useState(null)
  const [envVars, setEnvVars] = useState([])
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCloneModal, setShowCloneModal] = useState(false)

  const [configCollapsed, setConfigCollapsed] = useState(false)
  const [resourcesCollapsed, setResourcesCollapsed] = useState(false)
  const [healthCollapsed, setHealthCollapsed] = useState(false)
  const [envCollapsed, setEnvCollapsed] = useState(false)
  const [webhooksCollapsed, setWebhooksCollapsed] = useState(false)
  const [domainsCollapsed, setDomainsCollapsed] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [buildLogsCollapsed, setBuildLogsCollapsed] = useState(false)
  const [showBuildLogs, setShowBuildLogs] = useState(false)
  const [containerLogsCollapsed, setContainerLogsCollapsed] = useState(false)

  const [copied, setCopied] = useState(null)
  const [revealedSecrets, setRevealedSecrets] = useState({})
  const [webhookSecret, setWebhookSecret] = useState(null)
  const [webhookRevealed, setWebhookRevealed] = useState(false)

  const [showAddEnvModal, setShowAddEnvModal] = useState(false)
  const [showEditEnvModal, setShowEditEnvModal] = useState(null)
  const [showDeleteEnvModal, setShowDeleteEnvModal] = useState(null)
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')
  const [editEnvValue, setEditEnvValue] = useState('')
  const [envSubmitting, setEnvSubmitting] = useState(false)

  const [deploying, setDeploying] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [showRestartMenu, setShowRestartMenu] = useState(false)
  const [lastNotifiedStatus, setLastNotifiedStatus] = useState(null)

  const [showRollbackModal, setShowRollbackModal] = useState(null)
  const [rollingBack, setRollingBack] = useState(false)

  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState(null)
  const [validationCollapsed, setValidationCollapsed] = useState(true)

  const [fixingPort, setFixingPort] = useState(false)
  const [changingState, setChangingState] = useState(false)

  const toast = useToast()
  const { connectionState: wsConnectionState, isConnected: wsIsConnected } = useWebSocket()

  // Get the latest deployment ID for log streaming and WebSocket subscription
  const latestDeploymentId = deployments[0]?.id

  // Use WebSocket for real-time deployment status updates
  const {
    status: wsDeploymentStatus,
    message: wsDeploymentMessage,
    isActive: wsIsActive,
    isComplete: wsIsComplete,
    isFailed: wsIsFailed
  } = useDeploymentStatus(latestDeploymentId, deployments[0])

  // Check if any deployment is in progress
  const hasActiveDeployment = useCallback(() => {
    if (!deployments.length) return false
    // Use WebSocket status if available, otherwise fall back to local state
    const latestStatus = wsDeploymentStatus || deployments[0]?.status
    return ['pending', 'building', 'deploying'].includes(latestStatus)
  }, [deployments, wsDeploymentStatus])

  // Auto-show build logs when a deployment is active
  useEffect(() => {
    if (hasActiveDeployment()) {
      setShowBuildLogs(true)
      setBuildLogsCollapsed(false)
    }
  }, [hasActiveDeployment])

  // Initial load
  useEffect(() => {
    if (serviceId) {
      loadServiceData()
    }
  }, [serviceId])

  // Handle WebSocket status updates
  useEffect(() => {
    if (!wsDeploymentStatus || !latestDeploymentId) return

    // Update deployments array with new status from WebSocket
    setDeployments(prev => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      if (updated[0]?.id === latestDeploymentId) {
        updated[0] = { ...updated[0], status: wsDeploymentStatus }
      }
      return updated
    })

    // Notify on status changes
    const notifyKey = `${latestDeploymentId}-${wsDeploymentStatus}`
    if (notifyKey !== lastNotifiedStatus) {
      if (wsDeploymentStatus === 'live') {
        toast.success('Deployment completed successfully!')
        setLastNotifiedStatus(notifyKey)
        // Refresh service data to get final state
        loadServiceData()
      } else if (wsDeploymentStatus === 'failed') {
        toast.error('Deployment failed')
        setLastNotifiedStatus(notifyKey)
        // Refresh to get error details
        loadServiceData()
      }
    }
  }, [wsDeploymentStatus, latestDeploymentId, lastNotifiedStatus, toast])

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (!serviceId || loading) return

    // Only use polling as fallback when WebSocket is disconnected
    const shouldPoll = hasActiveDeployment() && !wsIsConnected()
    if (!shouldPoll) return

    const pollInterval = setInterval(async () => {
      try {
        const [serviceData, deploymentsData] = await Promise.all([
          fetchService(serviceId),
          fetchDeployments(serviceId)
        ])
        setService(serviceData)

        const newDeployments = deploymentsData.deployments || []
        const latestId = newDeployments[0]?.id
        const latestStatus = newDeployments[0]?.status

        // Only notify once per status change per deployment
        const notifyKey = `${latestId}-${latestStatus}`
        if (notifyKey !== lastNotifiedStatus) {
          if (latestStatus === 'live') {
            toast.success('Deployment completed successfully!')
            setLastNotifiedStatus(notifyKey)
          } else if (latestStatus === 'failed') {
            toast.error('Deployment failed')
            setLastNotifiedStatus(notifyKey)
          }
        }

        setDeployments(newDeployments)
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000) // Poll every 3 seconds as fallback

    return () => clearInterval(pollInterval)
  }, [serviceId, loading, deployments, lastNotifiedStatus, wsIsConnected, hasActiveDeployment])

  const loadServiceData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [serviceData, envData, deploymentsData] = await Promise.all([
        fetchService(serviceId),
        fetchEnvVars(serviceId),
        fetchDeployments(serviceId)
      ])
      setService(serviceData)
      setEnvVars(envData)
      setDeployments(deploymentsData.deployments || [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load service')
      toast.error('Failed to load service')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text, key) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for HTTP contexts - use textarea + execCommand
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
      toast.success('Copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleRevealEnvVar = async (envVar) => {
    if (revealedSecrets[envVar.id]) {
      // Hide it
      setRevealedSecrets(prev => {
        const next = { ...prev }
        delete next[envVar.id]
        return next
      })
      return
    }

    try {
      const revealed = await revealEnvVar(serviceId, envVar.id)
      setRevealedSecrets(prev => ({
        ...prev,
        [envVar.id]: revealed.value
      }))
    } catch (err) {
      toast.error('Failed to reveal value')
    }
  }

  const handleRevealWebhookSecret = async () => {
    if (webhookRevealed) {
      setWebhookRevealed(false)
      return
    }

    try {
      const data = await fetchWebhookSecret(serviceId)
      setWebhookSecret(data)
      setWebhookRevealed(true)
    } catch (err) {
      toast.error('Failed to reveal webhook secret')
    }
  }

  const handleAddEnvVar = async (e) => {
    e.preventDefault()
    if (!newEnvKey.trim() || !newEnvValue.trim()) return

    setEnvSubmitting(true)
    try {
      const created = await createEnvVar(serviceId, newEnvKey.trim(), newEnvValue)
      setEnvVars(prev => [...prev, created])
      setNewEnvKey('')
      setNewEnvValue('')
      setShowAddEnvModal(false)
      toast.success(`Environment variable "${newEnvKey}" added`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to add environment variable'
      toast.error(message)
    } finally {
      setEnvSubmitting(false)
    }
  }

  const handleUpdateEnvVar = async (e) => {
    e.preventDefault()
    if (!editEnvValue.trim()) return

    setEnvSubmitting(true)
    try {
      await updateEnvVar(serviceId, showEditEnvModal.id, editEnvValue)
      // Clear revealed value since it changed
      setRevealedSecrets(prev => {
        const next = { ...prev }
        delete next[showEditEnvModal.id]
        return next
      })
      setEditEnvValue('')
      setShowEditEnvModal(null)
      toast.success(`Environment variable "${showEditEnvModal.key}" updated`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update environment variable'
      toast.error(message)
    } finally {
      setEnvSubmitting(false)
    }
  }

  const handleDeleteEnvVar = async (envVar) => {
    setEnvSubmitting(true)
    try {
      await deleteEnvVar(serviceId, envVar.id)
      setEnvVars(prev => prev.filter(e => e.id !== envVar.id))
      setShowDeleteEnvModal(null)
      toast.success(`Environment variable "${envVar.key}" deleted`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete environment variable'
      toast.error(message)
    } finally {
      setEnvSubmitting(false)
    }
  }

  const handleTriggerDeploy = async () => {
    setDeploying(true)
    try {
      const deployment = await triggerDeploy(serviceId)
      setDeployments(prev => [deployment, ...prev])
      toast.success('Deployment triggered successfully')
      // Show build logs for new deployment
      setShowBuildLogs(true)
      setBuildLogsCollapsed(false)
      // Refresh service data to get new deployment status
      const updatedService = await fetchService(serviceId)
      setService(updatedService)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to trigger deployment'
      toast.error(message)
    } finally {
      setDeploying(false)
    }
  }

  const handleRestart = async (type = 'rolling') => {
    setRestarting(true)
    setShowRestartMenu(false)
    try {
      await restartService(serviceId, type)
      toast.success(`Service restart initiated (${type})`)
      // Refresh service data after a short delay to allow pods to restart
      setTimeout(loadServiceData, 2000)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to restart service'
      toast.error(message)
    } finally {
      setRestarting(false)
    }
  }

  const handleValidateDockerfile = async () => {
    setValidating(true)
    setValidation(null)
    try {
      const result = await validateDockerfile(serviceId)
      setValidation(result)
      setValidationCollapsed(false)
      if (result.valid && result.warnings.length === 0) {
        toast.success('Dockerfile is valid with no warnings')
      } else if (result.valid) {
        toast.warning(`Dockerfile valid with ${result.warnings.length} warning(s)`)
      } else {
        toast.error(`Validation failed: ${result.errors.length} error(s)`)
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to validate Dockerfile'
      toast.error(message)
    } finally {
      setValidating(false)
    }
  }

  const handleFixPort = async () => {
    setFixingPort(true)
    try {
      const result = await fixServicePort(serviceId)
      toast.success(`Port updated from ${result.previous_port} to ${result.new_port}`)
      // Refresh service data to get updated port
      const updatedService = await fetchService(serviceId)
      setService(updatedService)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fix port'
      toast.error(message)
    } finally {
      setFixingPort(false)
    }
  }

  const handleRollback = async (deployment) => {
    setRollingBack(true)
    try {
      const newDeployment = await rollbackService(serviceId, deployment.id)
      setDeployments(prev => [newDeployment, ...prev])
      setShowRollbackModal(null)
      toast.success('Rollback initiated - deploying previous version')
      // Show build logs for the rollback deployment
      setShowBuildLogs(true)
      setBuildLogsCollapsed(false)
      // Refresh service data
      const updatedService = await fetchService(serviceId)
      setService(updatedService)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to initiate rollback'
      toast.error(message)
    } finally {
      setRollingBack(false)
    }
  }

  // Derive service running state from deployment status
  const isServiceRunning = useCallback(() => {
    // If we have a live deployment status, the service is running
    const latestStatus = wsDeploymentStatus || deployments[0]?.status
    return latestStatus === 'live'
  }, [wsDeploymentStatus, deployments])

  // Check if service has ever been deployed
  const hasBeenDeployed = deployments.length > 0 && deployments.some(d => d.status === 'live' || d.image_tag)

  const handleToggleServiceState = async () => {
    if (changingState) return

    const currentlyRunning = isServiceRunning()
    const newState = currentlyRunning ? 'stopped' : 'running'
    setChangingState(true)

    try {
      if (newState === 'stopped') {
        await stopService(serviceId)
        toast.success('Service stopped')
      } else {
        await startService(serviceId)
        toast.success('Service started')
      }
      // Refresh service data to get updated status
      await loadServiceData()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : `Failed to ${newState === 'stopped' ? 'stop' : 'start'} service`
      toast.error(message)
    } finally {
      setChangingState(false)
    }
  }

  // Get the latest live deployment (for determining which deployments can be rolled back to)
  const latestLiveDeployment = deployments.find(d => d.status === 'live')

  // Check if a deployment is a rollback candidate (live, has image_tag, and not the current deployment)
  const isRollbackCandidate = (deployment) => {
    return deployment.status === 'live' &&
           deployment.image_tag &&
           deployment.id !== latestLiveDeployment?.id
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toISOString().replace('T', ' ').substring(0, 19)
  }

  const getStatusText = (status) => {
    const statusMap = {
      online: 'RUNNING',
      offline: 'STOPPED',
      warning: 'DEGRADED',
      error: 'FAILED',
      pending: 'PENDING',
      success: 'SUCCESS',
      failed: 'FAILED',
      live: 'LIVE',
      building: 'BUILDING',
      deploying: 'DEPLOYING'
    }
    return statusMap[status] || status?.toUpperCase() || 'UNKNOWN'
  }

  const getDeploymentStatusIndicator = (status) => {
    switch (status) {
      case 'live': return 'online'
      case 'success': return 'online'
      case 'failed': return 'error'
      case 'pending':
      case 'building':
      case 'deploying': return 'pending'
      default: return 'idle'
    }
  }

  const getServiceStatusIndicator = () => {
    if (service?.latest_deployment) {
      const status = service.latest_deployment.status
      if (status === 'live') return 'online'
      if (status === 'failed') return 'error'
      if (status === 'building' || status === 'deploying' || status === 'pending') return 'pending'
    }
    return 'offline'
  }

  const maskValue = (length = 20) => {
    return '*'.repeat(length)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <TerminalSpinner className="text-2xl" />
          <p className="font-mono text-terminal-muted mt-4">Loading service...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="font-mono text-terminal-red mb-4">! {error}</p>
        <div className="flex gap-3">
          <TerminalButton variant="secondary" onClick={onBack}>
            [ BACK ]
          </TerminalButton>
          <TerminalButton variant="secondary" onClick={loadServiceData}>
            [ RETRY ]
          </TerminalButton>
        </div>
      </div>
    )
  }

  if (!service) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={onBack}
              className="font-mono text-terminal-secondary hover:text-terminal-primary transition-colors"
            >
              &lt; BACK
            </button>
            <h1 className="font-mono text-xl text-terminal-primary text-glow-green uppercase tracking-terminal-wide">
              {service.name}
            </h1>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <StatusIndicator
              status={getServiceStatusIndicator()}
              label={getStatusText(service.latest_deployment?.status || 'pending')}
            />
            {hasActiveDeployment() && (
              <span className="font-mono text-xs text-terminal-cyan animate-pulse flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-terminal-cyan rounded-full animate-ping" />
                {wsIsConnected() ? 'LIVE UPDATES' : 'AUTO-REFRESHING'}
              </span>
            )}
            {wsConnectionState === 'connected' && (
              <span className="font-mono text-xs text-terminal-green flex items-center gap-1" title="WebSocket connected">
                <span className="inline-block w-1.5 h-1.5 bg-terminal-green rounded-full" />
                WS
              </span>
            )}
            <span className="font-mono text-xs text-terminal-muted">
              Port: <span className="text-terminal-secondary">:{service.port}</span>
            </span>
            <span className="font-mono text-xs text-terminal-muted">
              Branch: <span className="text-terminal-secondary">{service.branch || 'main'}</span>
            </span>
          </div>
          {/* Live URL - shown prominently when service is deployed */}
          {service.url && service.latest_deployment?.status === 'live' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-xs text-terminal-muted">LIVE AT:</span>
              <a
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-terminal-cyan hover:text-terminal-primary hover:underline transition-colors"
              >
                {service.url}
              </a>
              <button
                onClick={() => handleCopy(service.url, 'service_url')}
                className="text-terminal-muted hover:text-terminal-primary text-xs"
              >
                {copied === 'service_url' ? '[OK]' : '[COPY]'}
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {service.repo_url && (
            <TerminalButton
              variant="secondary"
              onClick={handleValidateDockerfile}
              disabled={validating}
            >
              {validating ? '[ VALIDATING... ]' : '[ VALIDATE DOCKERFILE ]'}
            </TerminalButton>
          )}
          <TerminalButton
            variant="secondary"
            onClick={() => setShowCloneModal(true)}
          >
            [ CLONE ]
          </TerminalButton>
          <TerminalButton
            variant={isServiceRunning() ? 'danger' : 'primary'}
            onClick={handleToggleServiceState}
            disabled={changingState || !hasBeenDeployed}
            title={!hasBeenDeployed ? 'Deploy service first' : undefined}
          >
            {changingState
              ? '[ PROCESSING... ]'
              : isServiceRunning()
                ? '[ STOP ]'
                : '[ START ]'
            }
          </TerminalButton>
          <TerminalButton
            variant="primary"
            onClick={handleTriggerDeploy}
            disabled={deploying || (validation && !validation.valid)}
          >
            {deploying ? '[ DEPLOYING... ]' : '[ DEPLOY ]'}
          </TerminalButton>
          <div className="relative">
            <TerminalButton
              variant="secondary"
              onClick={() => setShowRestartMenu(!showRestartMenu)}
              disabled={restarting}
            >
              {restarting ? '[ RESTARTING... ]' : '[ RESTART ▼ ]'}
            </TerminalButton>
            {showRestartMenu && (
              <div className="absolute right-0 mt-1 w-48 border border-terminal-border bg-terminal-bg-secondary z-10">
                <button
                  className="w-full text-left px-3 py-2 font-mono text-sm text-terminal-primary hover:bg-terminal-bg-elevated transition-colors"
                  onClick={() => handleRestart('rolling')}
                >
                  Rolling Restart
                </button>
                <button
                  className="w-full text-left px-3 py-2 font-mono text-sm text-terminal-primary hover:bg-terminal-bg-elevated transition-colors border-t border-terminal-border"
                  onClick={() => handleRestart('hard')}
                >
                  Hard Restart
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <TerminalDivider variant="double" color="green" />

      {/* Port Mismatch Warning Banner */}
      {service.port_mismatch && service.detected_port && (
        <div className="border-2 border-terminal-yellow bg-terminal-yellow/10 p-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-terminal-yellow font-mono text-lg">!</span>
                <span className="font-mono text-sm text-terminal-yellow uppercase tracking-wide">
                  Port Mismatch Detected
                </span>
              </div>
              <p className="font-mono text-sm text-terminal-primary mb-2">
                Dockerfile exposes port <span className="text-terminal-cyan">{service.detected_port}</span> but service is configured for port <span className="text-terminal-cyan">{service.port}</span>.
              </p>
              <p className="font-mono text-xs text-terminal-muted">
                This may cause 502 Bad Gateway errors. Click "Fix Port" to update the service configuration without triggering a rebuild.
              </p>
            </div>
            <TerminalButton
              variant="primary"
              onClick={handleFixPort}
              disabled={fixingPort}
            >
              {fixingPort ? '[ FIXING... ]' : `[ FIX PORT -> ${service.detected_port} ]`}
            </TerminalButton>
          </div>
        </div>
      )}

      {/* Build Logs Section - shown when deployment is active or user has toggled it */}
      {(showBuildLogs || hasActiveDeployment()) && latestDeploymentId && (
        <>
          <TerminalSection
            title="BUILD LOGS"
            collapsed={buildLogsCollapsed}
            onToggle={() => setBuildLogsCollapsed(!buildLogsCollapsed)}
            color="cyan"
          />

          {!buildLogsCollapsed && (
            <div className="mt-4">
              <BuildLogViewer
                deploymentId={latestDeploymentId}
                enabled={!buildLogsCollapsed}
                onComplete={(status) => {
                  // Refresh deployments when build completes
                  loadServiceData()
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Dockerfile Validation Section */}
      {validation && (
        <>
          <TerminalSection
            title="DOCKERFILE VALIDATION"
            collapsed={validationCollapsed}
            onToggle={() => setValidationCollapsed(!validationCollapsed)}
            color={validation.valid ? (validation.warnings.length > 0 ? 'amber' : 'green') : 'red'}
          />

          {!validationCollapsed && (
            <TerminalCard
              title={`Validation Results - ${validation.dockerfile_path}`}
              variant={validation.valid ? (validation.warnings.length > 0 ? 'amber' : 'green') : 'red'}
              className="mt-4"
            >
              {/* Summary */}
              <div className="flex items-center gap-4 mb-4 pb-3 border-b border-terminal-border">
                <span className={`font-mono text-sm ${validation.valid ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {validation.valid ? '✓ Syntax valid' : '✗ Validation failed'}
                </span>
                {validation.summary.errorCount > 0 && (
                  <span className="font-mono text-xs text-terminal-red">
                    {validation.summary.errorCount} error(s)
                  </span>
                )}
                {validation.summary.warningCount > 0 && (
                  <span className="font-mono text-xs text-terminal-yellow">
                    {validation.summary.warningCount} warning(s)
                  </span>
                )}
                {validation.summary.securityWarnings > 0 && (
                  <span className="font-mono text-xs text-terminal-red">
                    {validation.summary.securityWarnings} security
                  </span>
                )}
              </div>

              {/* Errors */}
              {validation.errors.length > 0 && (
                <div className="mb-4">
                  <div className="font-mono text-xs text-terminal-red uppercase mb-2">Errors</div>
                  <div className="space-y-2">
                    {validation.errors.map((error, idx) => (
                      <div key={idx} className="font-mono text-sm text-terminal-red flex gap-2">
                        <span className="text-terminal-muted">
                          {error.line ? `Line ${error.line}:` : '•'}
                        </span>
                        <span>{error.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div>
                  <div className="font-mono text-xs text-terminal-yellow uppercase mb-2">Warnings</div>
                  <div className="space-y-2">
                    {validation.warnings.map((warning, idx) => (
                      <div key={idx} className="font-mono text-sm flex gap-2">
                        <span className="text-terminal-muted">
                          {warning.line ? `Line ${warning.line}:` : '•'}
                        </span>
                        <span className={warning.severity === 'security' ? 'text-terminal-red' : 'text-terminal-yellow'}>
                          {warning.severity === 'security' && '[SECURITY] '}
                          {warning.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All good message */}
              {validation.valid && validation.errors.length === 0 && validation.warnings.length === 0 && (
                <div className="font-mono text-sm text-terminal-green">
                  No issues found. Dockerfile is ready for deployment.
                </div>
              )}

              {/* Action buttons */}
              {!validation.valid && (
                <div className="mt-4 pt-3 border-t border-terminal-border">
                  <span className="font-mono text-xs text-terminal-muted">
                    Fix errors before deploying. Deployment is blocked until validation passes.
                  </span>
                </div>
              )}
              {validation.valid && validation.warnings.length > 0 && (
                <div className="mt-4 pt-3 border-t border-terminal-border flex items-center justify-between">
                  <span className="font-mono text-xs text-terminal-muted">
                    Warnings found but deployment is allowed.
                  </span>
                  <TerminalButton
                    variant="primary"
                    onClick={handleTriggerDeploy}
                    disabled={deploying}
                  >
                    {deploying ? '[ DEPLOYING... ]' : '[ DEPLOY ANYWAY ]'}
                  </TerminalButton>
                </div>
              )}
            </TerminalCard>
          )}
        </>
      )}

      {/* Configuration Section */}
      <TerminalSection
        title="Configuration"
        collapsed={configCollapsed}
        onToggle={() => setConfigCollapsed(!configCollapsed)}
        color="cyan"
        commandFlags={['--show-config', '--format=table']}
      />

      {!configCollapsed && (
        <TerminalCard title="Service Config" variant="cyan" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between border-b border-terminal-border pb-2">
              <span className="font-mono text-xs text-terminal-muted uppercase">PORT:</span>
              <span className="font-mono text-sm text-terminal-primary">{service.port}</span>
            </div>
            <div className="flex items-center justify-between border-b border-terminal-border pb-2">
              <span className="font-mono text-xs text-terminal-muted uppercase">BRANCH:</span>
              <span className="font-mono text-sm text-terminal-primary">{service.branch || 'main'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-terminal-border pb-2">
              <span className="font-mono text-xs text-terminal-muted uppercase">DOCKERFILE:</span>
              <span className="font-mono text-sm text-terminal-primary">{service.dockerfile_path || 'Dockerfile'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-terminal-border pb-2">
              <span className="font-mono text-xs text-terminal-muted uppercase">REPLICAS:</span>
              <span className="font-mono text-sm text-terminal-primary">{service.replicas || 1}</span>
            </div>
            {service.storage_gb && (
              <div className="flex items-center justify-between border-b border-terminal-border pb-2">
                <span className="font-mono text-xs text-terminal-muted uppercase">STORAGE:</span>
                <span className="font-mono text-sm text-terminal-primary">{service.storage_gb} GB</span>
              </div>
            )}
            {service.health_check_path && (
              <div className="flex items-center justify-between border-b border-terminal-border pb-2">
                <span className="font-mono text-xs text-terminal-muted uppercase">HEALTH CHECK:</span>
                <span className="font-mono text-sm text-terminal-primary">{service.health_check_path}</span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-terminal-border">
            <span className="font-mono text-xs text-terminal-muted">REPO: </span>
            <span className="font-mono text-sm text-terminal-secondary break-all">{service.repo_url}</span>
          </div>
        </TerminalCard>
      )}

      {/* Resource Usage Section */}
      <TerminalSection
        title="Resource Usage"
        collapsed={resourcesCollapsed}
        onToggle={() => setResourcesCollapsed(!resourcesCollapsed)}
        color="cyan"
        commandFlags={['--show-metrics', '--refresh=5s']}
      />

      {!resourcesCollapsed && (
        <div className="mt-4">
          <ResourceMetrics
            serviceId={serviceId}
            fetchMetrics={fetchServiceMetrics}
            refreshInterval={5000}
          />
        </div>
      )}

      {/* Health Status Section */}
      {service.health_check_path && (
        <>
          <TerminalSection
            title="HEALTH STATUS"
            collapsed={healthCollapsed}
            onToggle={() => setHealthCollapsed(!healthCollapsed)}
            color="green"
          />

          {!healthCollapsed && (
            <div className="mt-4">
              <HealthStatus
                serviceId={serviceId}
                fetchHealth={fetchServiceHealth}
                refreshInterval={30000}
              />
            </div>
          )}
        </>
      )}

      {/* Container Logs Section */}
      <TerminalSection
        title="CONTAINER LOGS"
        collapsed={containerLogsCollapsed}
        onToggle={() => setContainerLogsCollapsed(!containerLogsCollapsed)}
        color="cyan"
      />

      {!containerLogsCollapsed && (
        <div className="mt-4">
          <LogViewer
            serviceId={serviceId}
            enabled={!containerLogsCollapsed}
          />
        </div>
      )}

      {/* Environment Variables Section */}
      <TerminalSection
        title="Environment Variables"
        collapsed={envCollapsed}
        onToggle={() => setEnvCollapsed(!envCollapsed)}
        color="amber"
        commandFlags={['--show-env', '--masked']}
      />

      {!envCollapsed && (
        <div className="mt-4">
          <div className="flex justify-end mb-3">
            <TerminalButton variant="secondary" onClick={() => setShowAddEnvModal(true)}>
              [ ADD VARIABLE ]
            </TerminalButton>
          </div>

          {envVars.length === 0 ? (
            <div className="text-center py-8 border border-terminal-border bg-terminal-bg-secondary">
              <p className="font-mono text-terminal-muted">No environment variables configured.</p>
            </div>
          ) : (
            <div className="border border-terminal-border bg-terminal-bg-secondary">
              {/* Table Header */}
              <div className="font-mono text-xs text-terminal-muted border-b border-terminal-border p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">KEY</div>
                  <div className="col-span-5">VALUE</div>
                  <div className="col-span-3">ACTIONS</div>
                </div>
              </div>

              {/* Environment Variable Rows */}
              {envVars.map((env, index) => (
                <div
                  key={env.id}
                  className={`font-mono text-sm p-3 ${
                    index < envVars.length - 1 ? 'border-b border-terminal-border' : ''
                  }`}
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4 text-terminal-secondary truncate">
                      {env.key}
                    </div>
                    <div className="col-span-5 text-terminal-primary truncate">
                      {revealedSecrets[env.id] || maskValue()}
                    </div>
                    <div className="col-span-3 flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleRevealEnvVar(env)}
                        className="text-terminal-muted hover:text-terminal-primary text-xs"
                      >
                        {revealedSecrets[env.id] ? '[HIDE]' : '[SHOW]'}
                      </button>
                      {revealedSecrets[env.id] && (
                        <button
                          onClick={() => handleCopy(revealedSecrets[env.id], env.id)}
                          className="text-terminal-muted hover:text-terminal-primary text-xs"
                        >
                          {copied === env.id ? '[OK]' : '[COPY]'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowEditEnvModal(env)
                          setEditEnvValue('')
                        }}
                        className="text-terminal-secondary hover:text-terminal-primary text-xs"
                      >
                        [EDIT]
                      </button>
                      <button
                        onClick={() => setShowDeleteEnvModal(env)}
                        className="text-terminal-red hover:text-terminal-red/80 text-xs"
                      >
                        [DEL]
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Webhooks Section */}
      <TerminalSection
        title="WEBHOOK"
        collapsed={webhooksCollapsed}
        onToggle={() => setWebhooksCollapsed(!webhooksCollapsed)}
        color="green"
      />

      {!webhooksCollapsed && (
        <TerminalCard title="GitHub Webhook" variant="green" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs text-terminal-muted">WEBHOOK URL:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-terminal-primary truncate max-w-[300px]">
                  {service.webhook_url}
                </span>
                <button
                  onClick={() => handleCopy(service.webhook_url, 'webhook_url')}
                  className="text-terminal-muted hover:text-terminal-primary text-xs"
                >
                  {copied === 'webhook_url' ? '[OK]' : '[COPY]'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs text-terminal-muted">SECRET:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-terminal-secondary">
                  {webhookRevealed && webhookSecret ? webhookSecret.webhook_secret : maskValue()}
                </span>
                <button
                  onClick={handleRevealWebhookSecret}
                  className="text-terminal-muted hover:text-terminal-primary text-xs"
                >
                  {webhookRevealed ? '[HIDE]' : '[SHOW]'}
                </button>
                {webhookRevealed && webhookSecret && (
                  <button
                    onClick={() => handleCopy(webhookSecret.webhook_secret, 'webhook_secret')}
                    className="text-terminal-muted hover:text-terminal-primary text-xs"
                  >
                    {copied === 'webhook_secret' ? '[OK]' : '[COPY]'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </TerminalCard>
      )}

      {/* Custom Domains Section */}
      <TerminalSection
        title="CUSTOM DOMAINS"
        collapsed={domainsCollapsed}
        onToggle={() => setDomainsCollapsed(!domainsCollapsed)}
        color="cyan"
      />

      {!domainsCollapsed && (
        <div className="mt-4">
          <DomainManager serviceId={serviceId} />
        </div>
      )}

      {/* Deployment History Section */}
      <TerminalSection
        title="DEPLOYMENT HISTORY"
        collapsed={historyCollapsed}
        onToggle={() => setHistoryCollapsed(!historyCollapsed)}
        color="amber"
      />

      {!historyCollapsed && (
        <div className="mt-4">
          {deployments.length === 0 ? (
            <div className="text-center py-8 border border-terminal-border bg-terminal-bg-secondary">
              <p className="font-mono text-terminal-muted mb-4">No deployments yet.</p>
              <TerminalButton variant="primary" onClick={handleTriggerDeploy} disabled={deploying}>
                {deploying ? '[ DEPLOYING... ]' : '[ TRIGGER FIRST DEPLOY ]'}
              </TerminalButton>
            </div>
          ) : (
            <div className="border border-terminal-border bg-terminal-bg-secondary">
              {/* Table Header */}
              <div className="font-mono text-xs text-terminal-muted border-b border-terminal-border p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-1">STS</div>
                  <div className="col-span-2">COMMIT</div>
                  <div className="col-span-4">TIMESTAMP</div>
                  <div className="col-span-5">STATUS</div>
                </div>
              </div>

              {/* Deployment Rows */}
              {deployments.map((deployment, index) => (
                <div
                  key={deployment.id}
                  className={`font-mono text-sm p-3 hover:bg-terminal-bg-elevated transition-colors ${
                    index < deployments.length - 1 ? 'border-b border-terminal-border' : ''
                  }`}
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1">
                      {deployment.rollback_to ? (
                        <span className="text-terminal-cyan" title="Rollback deployment">↩</span>
                      ) : (
                        <StatusIndicator
                          status={getDeploymentStatusIndicator(deployment.status)}
                          showLabel={false}
                          size="sm"
                        />
                      )}
                    </div>
                    <div className="col-span-2 text-terminal-primary truncate">
                      {deployment.commit_sha?.substring(0, 7) || 'N/A'}
                    </div>
                    <div className="col-span-4 text-terminal-muted">
                      {formatDate(deployment.created_at)}
                    </div>
                    <div className="col-span-5 flex items-center gap-2">
                      {index === 0 && deployment.status === 'live' ? (
                        <span className="text-terminal-primary text-xs">[CURRENT]</span>
                      ) : deployment.rollback_to ? (
                        <span className="text-terminal-cyan text-xs">ROLLBACK</span>
                      ) : (
                        <span className="text-terminal-muted text-xs">{getStatusText(deployment.status)}</span>
                      )}
                      {isRollbackCandidate(deployment) && (
                        <button
                          onClick={() => setShowRollbackModal(deployment)}
                          className="text-terminal-cyan hover:text-terminal-primary text-xs ml-auto"
                          disabled={rollingBack || hasActiveDeployment()}
                        >
                          [ROLLBACK]
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Service Info */}
      <TerminalDivider variant="single" color="muted" className="my-6" />

      <TerminalCard title="Service Info" variant="green">
        <div className="grid grid-cols-1 gap-4">
          {service.url && (
            <div className="flex justify-between font-mono text-sm items-center">
              <span className="text-terminal-muted">URL:</span>
              <div className="flex items-center gap-2">
                <a
                  href={service.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terminal-cyan hover:text-terminal-primary hover:underline transition-colors"
                >
                  {service.url}
                </a>
                <button
                  onClick={() => handleCopy(service.url, 'info_url')}
                  className="text-terminal-muted hover:text-terminal-primary text-xs"
                >
                  {copied === 'info_url' ? '[OK]' : '[COPY]'}
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-between font-mono text-sm">
            <span className="text-terminal-muted">SUBDOMAIN:</span>
            <span className="text-terminal-secondary">{service.subdomain}</span>
          </div>
          <div className="flex justify-between font-mono text-sm">
            <span className="text-terminal-muted">CREATED:</span>
            <span className="text-terminal-secondary">{formatDate(service.created_at)}</span>
          </div>
        </div>
      </TerminalCard>

      {/* Add Env Var Modal */}
      {showAddEnvModal && (
        <TerminalModal
          title="ADD ENVIRONMENT VARIABLE"
          variant="green"
          onClose={() => {
            setShowAddEnvModal(false)
            setNewEnvKey('')
            setNewEnvValue('')
          }}
        >
          <form onSubmit={handleAddEnvVar}>
            <div className="mb-4">
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                Key
              </label>
              <TerminalInput
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                placeholder="MY_VARIABLE"
                className="w-full"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                Value
              </label>
              <TerminalInput
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder="value"
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-3">
              <TerminalButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowAddEnvModal(false)
                  setNewEnvKey('')
                  setNewEnvValue('')
                }}
                disabled={envSubmitting}
              >
                [ CANCEL ]
              </TerminalButton>
              <TerminalButton
                type="submit"
                variant="primary"
                disabled={envSubmitting || !newEnvKey.trim() || !newEnvValue.trim()}
              >
                {envSubmitting ? '[ ADDING... ]' : '[ ADD ]'}
              </TerminalButton>
            </div>
          </form>
        </TerminalModal>
      )}

      {/* Edit Env Var Modal */}
      {showEditEnvModal && (
        <TerminalModal
          title="EDIT ENVIRONMENT VARIABLE"
          variant="amber"
          onClose={() => {
            setShowEditEnvModal(null)
            setEditEnvValue('')
          }}
        >
          <form onSubmit={handleUpdateEnvVar}>
            <div className="mb-4">
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                Key
              </label>
              <div className="font-mono text-terminal-secondary py-2">
                {showEditEnvModal.key}
              </div>
            </div>
            <div className="mb-6">
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                New Value
              </label>
              <TerminalInput
                value={editEnvValue}
                onChange={(e) => setEditEnvValue(e.target.value)}
                placeholder="new value"
                className="w-full"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <TerminalButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowEditEnvModal(null)
                  setEditEnvValue('')
                }}
                disabled={envSubmitting}
              >
                [ CANCEL ]
              </TerminalButton>
              <TerminalButton
                type="submit"
                variant="primary"
                disabled={envSubmitting || !editEnvValue.trim()}
              >
                {envSubmitting ? '[ UPDATING... ]' : '[ UPDATE ]'}
              </TerminalButton>
            </div>
          </form>
        </TerminalModal>
      )}

      {/* Delete Env Var Modal */}
      {showDeleteEnvModal && (
        <TerminalModal
          title="CONFIRM DELETE"
          variant="red"
          onClose={() => setShowDeleteEnvModal(null)}
        >
          <p className="font-mono text-terminal-primary mb-2">
            Delete environment variable "{showDeleteEnvModal.key}"?
          </p>
          <p className="font-mono text-xs text-terminal-muted mb-6">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <TerminalButton
              variant="secondary"
              onClick={() => setShowDeleteEnvModal(null)}
              disabled={envSubmitting}
            >
              [ CANCEL ]
            </TerminalButton>
            <TerminalButton
              variant="danger"
              onClick={() => handleDeleteEnvVar(showDeleteEnvModal)}
              disabled={envSubmitting}
            >
              {envSubmitting ? '[ DELETING... ]' : '[ DELETE ]'}
            </TerminalButton>
          </div>
        </TerminalModal>
      )}

      {/* Clone Service Modal */}
      {showCloneModal && (
        <CloneServiceModal
          service={service}
          onClose={() => setShowCloneModal(false)}
          onCloned={(newService) => {
            setShowCloneModal(false)
            toast.success(`Service "${newService.name}" cloned successfully. Navigate to the project to view it.`)
          }}
        />
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackModal && (
        <TerminalModal
          title="CONFIRM ROLLBACK"
          variant="cyan"
          onClose={() => setShowRollbackModal(null)}
        >
          <p className="font-mono text-terminal-primary mb-2">
            Rollback to deployment {showRollbackModal.commit_sha?.substring(0, 7)}?
          </p>
          <p className="font-mono text-xs text-terminal-muted mb-2">
            This will redeploy the image from this deployment without rebuilding.
          </p>
          <p className="font-mono text-xs text-terminal-muted mb-6">
            Deployed: {formatDate(showRollbackModal.created_at)}
          </p>
          <div className="flex justify-end gap-3">
            <TerminalButton
              variant="secondary"
              onClick={() => setShowRollbackModal(null)}
              disabled={rollingBack}
            >
              [ CANCEL ]
            </TerminalButton>
            <TerminalButton
              variant="primary"
              onClick={() => handleRollback(showRollbackModal)}
              disabled={rollingBack}
            >
              {rollingBack ? '[ ROLLING BACK... ]' : '[ ROLLBACK ]'}
            </TerminalButton>
          </div>
        </TerminalModal>
      )}
    </div>
  )
}

export default ServiceDetail
