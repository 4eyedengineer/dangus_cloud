import { useState, useEffect } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider, AsciiSectionDivider } from '../components/AsciiDivider'
import { StatusIndicator } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'
import TerminalInput from '../components/TerminalInput'
import TerminalSpinner from '../components/TerminalSpinner'
import { useToast } from '../components/Toast'
import { BuildLogViewer } from '../components/BuildLogViewer'
import { ResourceMetrics } from '../components/ResourceMetrics'
import { fetchService, triggerDeploy, fetchWebhookSecret, restartService, fetchServiceMetrics } from '../api/services'
import { fetchEnvVars, createEnvVar, updateEnvVar, deleteEnvVar, revealEnvVar } from '../api/envVars'
import { fetchDeployments } from '../api/deployments'
import { ApiError } from '../api/utils'

export function ServiceDetail({ serviceId, onBack }) {
  const [service, setService] = useState(null)
  const [envVars, setEnvVars] = useState([])
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [configCollapsed, setConfigCollapsed] = useState(false)
  const [resourcesCollapsed, setResourcesCollapsed] = useState(false)
  const [envCollapsed, setEnvCollapsed] = useState(false)
  const [webhooksCollapsed, setWebhooksCollapsed] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [buildLogsCollapsed, setBuildLogsCollapsed] = useState(false)
  const [showBuildLogs, setShowBuildLogs] = useState(false)

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

  const toast = useToast()

  // Check if any deployment is in progress
  const hasActiveDeployment = () => {
    if (!deployments.length) return false
    const latestStatus = deployments[0]?.status
    return ['pending', 'building', 'deploying'].includes(latestStatus)
  }

  // Get the latest deployment ID for log streaming
  const latestDeploymentId = deployments[0]?.id

  // Auto-show build logs when a deployment is active
  useEffect(() => {
    if (hasActiveDeployment()) {
      setShowBuildLogs(true)
      setBuildLogsCollapsed(false)
    }
  }, [deployments])

  // Initial load
  useEffect(() => {
    if (serviceId) {
      loadServiceData()
    }
  }, [serviceId])

  // Real-time polling when deployment is in progress
  useEffect(() => {
    if (!serviceId || loading) return

    const shouldPoll = hasActiveDeployment()
    if (!shouldPoll) return

    const pollInterval = setInterval(async () => {
      try {
        const [serviceData, deploymentsData] = await Promise.all([
          fetchService(serviceId),
          fetchDeployments(serviceId)
        ])
        setService(serviceData)

        const newDeployments = deploymentsData.deployments || []
        const latestDeploymentId = newDeployments[0]?.id
        const latestStatus = newDeployments[0]?.status

        // Only notify once per status change per deployment
        const notifyKey = `${latestDeploymentId}-${latestStatus}`
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
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [serviceId, loading, deployments, lastNotifiedStatus])

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
      await navigator.clipboard.writeText(text)
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
                AUTO-REFRESHING
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
          <TerminalButton
            variant="primary"
            onClick={handleTriggerDeploy}
            disabled={deploying}
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

      <AsciiDivider variant="double" color="green" />

      {/* Build Logs Section - shown when deployment is active or user has toggled it */}
      {(showBuildLogs || hasActiveDeployment()) && latestDeploymentId && (
        <>
          <AsciiSectionDivider
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

      {/* Configuration Section */}
      <AsciiSectionDivider
        title="CONFIGURATION"
        collapsed={configCollapsed}
        onToggle={() => setConfigCollapsed(!configCollapsed)}
        color="cyan"
      />

      {!configCollapsed && (
        <AsciiBox title="Service Config" variant="cyan" className="mt-4">
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
        </AsciiBox>
      )}

      {/* Resource Usage Section */}
      <AsciiSectionDivider
        title="RESOURCE USAGE"
        collapsed={resourcesCollapsed}
        onToggle={() => setResourcesCollapsed(!resourcesCollapsed)}
        color="cyan"
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

      {/* Environment Variables Section */}
      <AsciiSectionDivider
        title="ENVIRONMENT VARIABLES"
        collapsed={envCollapsed}
        onToggle={() => setEnvCollapsed(!envCollapsed)}
        color="amber"
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
      <AsciiSectionDivider
        title="WEBHOOK"
        collapsed={webhooksCollapsed}
        onToggle={() => setWebhooksCollapsed(!webhooksCollapsed)}
        color="green"
      />

      {!webhooksCollapsed && (
        <AsciiBox title="GitHub Webhook" variant="green" className="mt-4">
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
        </AsciiBox>
      )}

      {/* Deployment History Section */}
      <AsciiSectionDivider
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
                  <div className="col-span-3">COMMIT</div>
                  <div className="col-span-5">TIMESTAMP</div>
                  <div className="col-span-3">STATUS</div>
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
                      <StatusIndicator
                        status={getDeploymentStatusIndicator(deployment.status)}
                        showLabel={false}
                        size="sm"
                      />
                    </div>
                    <div className="col-span-3 text-terminal-primary truncate">
                      {deployment.commit_sha?.substring(0, 7) || 'N/A'}
                    </div>
                    <div className="col-span-5 text-terminal-muted">
                      {formatDate(deployment.created_at)}
                    </div>
                    <div className="col-span-3">
                      {index === 0 && deployment.status === 'live' ? (
                        <span className="text-terminal-primary text-xs">[CURRENT]</span>
                      ) : (
                        <span className="text-terminal-muted text-xs">{getStatusText(deployment.status)}</span>
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
      <AsciiDivider variant="single" color="muted" className="my-6" />

      <AsciiBox title="Service Info" variant="green">
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
      </AsciiBox>

      {/* Add Env Var Modal */}
      {showAddEnvModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <div className="font-mono whitespace-pre text-terminal-muted select-none">
              +-- ADD ENVIRONMENT VARIABLE ---------------+
            </div>
            <div className="border-l border-r border-terminal-muted bg-terminal-bg-secondary px-6 py-6">
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
            </div>
            <div className="font-mono whitespace-pre text-terminal-muted select-none">
              +--------------------------------------------+
            </div>
          </div>
        </div>
      )}

      {/* Edit Env Var Modal */}
      {showEditEnvModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <div className="font-mono whitespace-pre text-terminal-muted select-none">
              +-- EDIT ENVIRONMENT VARIABLE --------------+
            </div>
            <div className="border-l border-r border-terminal-muted bg-terminal-bg-secondary px-6 py-6">
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
            </div>
            <div className="font-mono whitespace-pre text-terminal-muted select-none">
              +--------------------------------------------+
            </div>
          </div>
        </div>
      )}

      {/* Delete Env Var Modal */}
      {showDeleteEnvModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <div className="font-mono whitespace-pre text-terminal-red select-none">
              +-- CONFIRM DELETE -------------------------+
            </div>
            <div className="border-l border-r border-terminal-red bg-terminal-bg-secondary px-6 py-6">
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
            </div>
            <div className="font-mono whitespace-pre text-terminal-red select-none">
              +--------------------------------------------+
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServiceDetail
