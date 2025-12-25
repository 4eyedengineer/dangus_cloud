import { useState, useEffect, useCallback } from 'react'
import { TerminalCard, TerminalDivider } from '../components/TerminalCard'
import { StatusIndicator } from '../components/StatusIndicator'
import { ErrorDisplay } from '../components/ErrorDisplay'
import TerminalButton from '../components/TerminalButton'
import TerminalSpinner from '../components/TerminalSpinner'
import TerminalTabs from '../components/TerminalTabs'
import { useToast } from '../components/Toast'
import { CloneServiceModal } from '../components/CloneServiceModal'
import {
  fetchService,
  triggerDeploy,
  restartService,
  validateDockerfile,
  fetchSuggestedPort,
  fixServicePort,
  startService,
  stopService
} from '../api/services'
import { fetchEnvVars } from '../api/envVars'
import { fetchDeployments } from '../api/deployments'
import { ApiError } from '../api/utils'
import { useDeploymentStatus } from '../hooks/useDeploymentStatus'
import { useWebSocket } from '../hooks/useWebSocket'
import { useCopyToClipboard, formatDate, getStatusText } from '../utils'

// Sub-components
import { ServiceOverview } from './service/ServiceOverview'
import { ServiceConfig } from './service/ServiceConfig'
import { ServiceEnvironment } from './service/ServiceEnvironment'
import { ServiceLogs } from './service/ServiceLogs'
import { ServiceHistory } from './service/ServiceHistory'

const SERVICE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'config', label: 'Config' },
  { id: 'env', label: 'Environment' },
  { id: 'logs', label: 'Logs' },
  { id: 'history', label: 'History' }
]

export function ServiceDetail({ serviceId, activeTab = 'overview', onTabChange, onBack }) {
  // Core state
  const [service, setService] = useState(null)
  const [envVars, setEnvVars] = useState([])
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // UI state
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [showBuildLogs, setShowBuildLogs] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [showRestartMenu, setShowRestartMenu] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState(null)
  const [fixingPort, setFixingPort] = useState(false)
  const [changingState, setChangingState] = useState(false)
  const [lastNotifiedStatus, setLastNotifiedStatus] = useState(null)

  const toast = useToast()
  const { copy, copied } = useCopyToClipboard()
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
    const latestStatus = wsDeploymentStatus || deployments[0]?.status
    return ['pending', 'building', 'deploying'].includes(latestStatus)
  }, [deployments, wsDeploymentStatus])

  // Auto-show build logs when a deployment is active
  useEffect(() => {
    if (hasActiveDeployment()) {
      setShowBuildLogs(true)
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

    setDeployments(prev => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      if (updated[0]?.id === latestDeploymentId) {
        updated[0] = { ...updated[0], status: wsDeploymentStatus }
      }
      return updated
    })

    const notifyKey = `${latestDeploymentId}-${wsDeploymentStatus}`
    if (notifyKey !== lastNotifiedStatus) {
      if (wsDeploymentStatus === 'live') {
        toast.success('Deployment completed successfully!')
        setLastNotifiedStatus(notifyKey)
        loadServiceData()
      } else if (wsDeploymentStatus === 'failed') {
        toast.error('Deployment failed')
        setLastNotifiedStatus(notifyKey)
        loadServiceData()
      }
    }
  }, [wsDeploymentStatus, latestDeploymentId, lastNotifiedStatus, toast])

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (!serviceId || loading) return
    if (wsIsConnected()) return

    const hasActive = hasActiveDeployment()
    if (!hasActive) return

    const interval = setInterval(() => {
      loadServiceData()
    }, 5000)

    return () => clearInterval(interval)
  }, [serviceId, loading, hasActiveDeployment, wsIsConnected])

  const loadServiceData = async () => {
    try {
      // Use Promise.allSettled for partial failure resilience
      const [serviceResult, envResult, deploymentsResult] = await Promise.allSettled([
        fetchService(serviceId),
        fetchEnvVars(serviceId),
        fetchDeployments(serviceId)
      ])

      // Service data is critical - if it fails, show error
      if (serviceResult.status === 'rejected') {
        const err = serviceResult.reason
        setError(err instanceof ApiError ? err.message : 'Failed to load service')
        toast.error('Failed to load service data')
        return
      }

      setService(serviceResult.value)
      setError(null)

      // Env vars - graceful degradation with warning
      if (envResult.status === 'fulfilled') {
        setEnvVars(envResult.value)
      } else {
        setEnvVars([])
        toast.warning('Failed to load environment variables')
      }

      // Deployments - graceful degradation with warning
      if (deploymentsResult.status === 'fulfilled') {
        setDeployments(deploymentsResult.value.deployments || [])
      } else {
        setDeployments([])
        toast.warning('Failed to load deployment history')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load service')
      toast.error('Failed to load service data')
    } finally {
      setLoading(false)
    }
  }

  const handleTriggerDeploy = async () => {
    setDeploying(true)
    try {
      const result = await triggerDeploy(serviceId)
      toast.success('Deployment triggered')
      setShowBuildLogs(true)
      await loadServiceData()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to trigger deployment'
      toast.error(message)
    } finally {
      setDeploying(false)
    }
  }

  const handleRestart = async () => {
    setRestarting(true)
    try {
      await restartService(serviceId)
      toast.success('Service restarted')
      await loadServiceData()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to restart service'
      toast.error(message)
    } finally {
      setRestarting(false)
      setShowRestartMenu(false)
    }
  }

  const handleValidate = async () => {
    setValidating(true)
    setValidation(null)
    try {
      const result = await validateDockerfile(serviceId)
      setValidation(result)
      if (result.valid) {
        toast.success('Dockerfile validated successfully')
      } else {
        toast.warning('Dockerfile has issues')
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
      await fixServicePort(serviceId)
      toast.success('Port updated successfully')
      await loadServiceData()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fix port'
      toast.error(message)
    } finally {
      setFixingPort(false)
    }
  }

  const handleToggleState = async () => {
    if (changingState) return

    const isRunning = service?.latest_deployment?.status === 'live'
    setChangingState(true)

    try {
      if (isRunning) {
        await stopService(serviceId)
        toast.success('Service stopped')
      } else {
        await startService(serviceId)
        toast.success('Service started')
      }
      await loadServiceData()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to change service state'
      toast.error(message)
    } finally {
      setChangingState(false)
    }
  }

  const getServiceStatusIndicator = () => {
    if (service?.latest_deployment) {
      const status = service.latest_deployment.status
      if (status === 'live') return 'online'
      if (status === 'failed') return 'error'
      if (['building', 'deploying', 'pending'].includes(status)) return 'pending'
    }
    return 'offline'
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
      <ErrorDisplay
        error={error}
        onRetry={loadServiceData}
        onBack={onBack}
        title="Service Error"
      />
    )
  }

  if (!service) {
    return null
  }

  const isRunning = service?.latest_deployment?.status === 'live'

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
              label={getStatusText(wsDeploymentStatus || service.latest_deployment?.status || 'pending')}
            />
            {hasActiveDeployment() && (
              <span className="font-mono text-xs text-terminal-cyan animate-pulse flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-terminal-cyan rounded-full animate-ping" />
                {wsIsConnected() ? 'DEPLOYING (LIVE)' : 'DEPLOYING'}
              </span>
            )}
            {service.url && (
              <a
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-terminal-green hover:underline"
              >
                {service.url}
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <TerminalButton
            variant="secondary"
            onClick={handleValidate}
            disabled={validating}
          >
            {validating ? '[ VALIDATING... ]' : '[ VALIDATE ]'}
          </TerminalButton>
          <TerminalButton
            variant="secondary"
            onClick={() => setShowCloneModal(true)}
          >
            [ CLONE ]
          </TerminalButton>
          <TerminalButton
            variant={isRunning ? 'danger' : 'secondary'}
            onClick={handleToggleState}
            disabled={changingState || hasActiveDeployment()}
          >
            {changingState ? '[ ... ]' : isRunning ? '[ STOP ]' : '[ START ]'}
          </TerminalButton>
          <TerminalButton
            variant="primary"
            onClick={handleTriggerDeploy}
            disabled={deploying || hasActiveDeployment()}
          >
            {deploying ? '[ DEPLOYING... ]' : '[ DEPLOY ]'}
          </TerminalButton>
          <div className="relative">
            <TerminalButton
              variant="secondary"
              onClick={() => setShowRestartMenu(!showRestartMenu)}
              disabled={restarting}
            >
              {restarting ? '[ RESTARTING... ]' : '[ RESTART ]'}
            </TerminalButton>
            {showRestartMenu && (
              <div className="absolute right-0 mt-1 z-10 border border-terminal-border bg-terminal-bg-secondary p-2">
                <button
                  onClick={handleRestart}
                  className="font-mono text-xs text-terminal-primary hover:text-terminal-green whitespace-nowrap"
                >
                  Confirm Restart?
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <TerminalDivider variant="double" color="green" />

      {/* Tab Navigation */}
      {onTabChange && (
        <TerminalTabs
          tabs={SERVICE_TABS}
          activeTab={activeTab}
          onTabChange={onTabChange}
          className="mb-6"
        />
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <ServiceOverview
          service={service}
          latestDeploymentId={latestDeploymentId}
          showBuildLogs={showBuildLogs}
          hasActiveDeployment={hasActiveDeployment()}
          validation={validation}
          onFixPort={handleFixPort}
          fixingPort={fixingPort}
          onDeploy={handleTriggerDeploy}
          deploying={deploying}
          onRefresh={loadServiceData}
        />
      )}

      {activeTab === 'config' && (
        <ServiceConfig
          service={service}
          serviceId={serviceId}
        />
      )}

      {activeTab === 'env' && (
        <ServiceEnvironment
          serviceId={serviceId}
          envVars={envVars}
          setEnvVars={setEnvVars}
        />
      )}

      {activeTab === 'logs' && (
        <ServiceLogs
          serviceId={serviceId}
          latestDeploymentId={latestDeploymentId}
          onRefresh={loadServiceData}
        />
      )}

      {activeTab === 'history' && (
        <ServiceHistory
          serviceId={serviceId}
          deployments={deployments}
          hasActiveDeployment={hasActiveDeployment()}
          onDeploy={handleTriggerDeploy}
          deploying={deploying}
          onRefresh={loadServiceData}
        />
      )}

      {/* Service Info - Always visible */}
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
                  onClick={() => copy(service.url, 'info_url')}
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
    </div>
  )
}

export default ServiceDetail
