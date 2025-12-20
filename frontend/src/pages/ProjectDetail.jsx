import { useState, useEffect, useCallback, useRef } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider, AsciiSectionDivider } from '../components/AsciiDivider'
import { StatusIndicator, ProgressGauge } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'
import TerminalSpinner from '../components/TerminalSpinner'
import { useToast } from '../components/Toast'
import { fetchProject } from '../api/projects'
import { deleteService } from '../api/services'
import { ApiError } from '../api/utils'
import { useWebSocket } from '../hooks/useWebSocket'

export function ProjectDetail({ projectId, onServiceClick, onNewService, onBack }) {
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [servicesCollapsed, setServicesCollapsed] = useState(false)
  const [discoveryCollapsed, setDiscoveryCollapsed] = useState(false)
  const [copied, setCopied] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)
  // Track real-time service statuses from WebSocket
  const [serviceStatuses, setServiceStatuses] = useState({})
  const toast = useToast()
  const { connectionState, subscribe, isConnected } = useWebSocket()
  const unsubscribesRef = useRef([])

  // Check if any service has an active deployment
  const hasActiveDeployments = () => {
    if (!project?.services?.length) return false
    return project.services.some(s =>
      ['pending', 'building', 'deploying'].includes(s.current_status)
    )
  }

  // Initial load
  useEffect(() => {
    if (projectId) {
      loadProject()
    }
  }, [projectId])

  // Subscribe to deployment status updates for all services
  useEffect(() => {
    if (!project?.services?.length) return

    // Clean up previous subscriptions
    unsubscribesRef.current.forEach(unsub => unsub())
    unsubscribesRef.current = []

    // Subscribe to each service's latest deployment status
    for (const service of project.services) {
      if (service.latest_deployment_id) {
        const channel = `deployment:${service.latest_deployment_id}:status`

        const unsubscribe = subscribe(channel, (event) => {
          const { payload } = event

          // Update the service status in our local state
          setServiceStatuses(prev => ({
            ...prev,
            [service.id]: payload.status
          }))

          // Show toast for significant status changes
          if (payload.status === 'live') {
            toast.success(`Service "${service.name}" is now live`)
          } else if (payload.status === 'failed') {
            toast.error(`Deployment failed for "${service.name}"`)
          }
        })

        unsubscribesRef.current.push(unsubscribe)
      }
    }

    return () => {
      unsubscribesRef.current.forEach(unsub => unsub())
      unsubscribesRef.current = []
    }
  }, [project?.services, subscribe, toast])

  // Helper to get the current status (WebSocket status takes precedence)
  const getRealtimeStatus = useCallback((service) => {
    return serviceStatuses[service.id] || service.current_status
  }, [serviceStatuses])

  // Check if any service has an active deployment
  const hasActiveDeployments = useCallback(() => {
    if (!project?.services) return false
    return project.services.some(service => {
      const status = getRealtimeStatus(service)
      return ['pending', 'building', 'deploying'].includes(status)
    })
  }, [project?.services, getRealtimeStatus])

  const loadProject = async () => {
    setLoading(true)
    setError(null)
    setProject(null) // Clear stale data when loading new project
    try {
      const data = await fetchProject(projectId)
      setProject(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load project')
      toast.error('Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteService = async (service) => {
    setDeleting(true)
    try {
      await deleteService(service.id)
      // Refresh project to get updated services list
      await loadProject()
      setShowDeleteModal(null)
      toast.success(`Service "${service.name}" deleted successfully`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete service'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  const handleCopy = async (text, key) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for HTTP contexts
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
      pending: 'STARTING',
      live: 'LIVE',
      building: 'BUILDING',
      deploying: 'DEPLOYING'
    }
    return statusMap[status] || status?.toUpperCase() || 'UNKNOWN'
  }

  const getServiceStatus = useCallback((service) => {
    // Use real-time status from WebSocket if available
    const currentStatus = getRealtimeStatus(service)
    if (currentStatus) {
      if (currentStatus === 'live') return 'online'
      if (currentStatus === 'failed') return 'error'
      if (currentStatus === 'building' || currentStatus === 'deploying') return 'pending'
      return currentStatus
    }
    return 'offline'
  }, [getRealtimeStatus])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <TerminalSpinner className="text-2xl" />
          <p className="font-mono text-terminal-muted mt-4">Loading project...</p>
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
          <TerminalButton variant="secondary" onClick={loadProject}>
            [ RETRY ]
          </TerminalButton>
        </div>
      </div>
    )
  }

  if (!project) {
    return null
  }

  // Build endpoints from project data
  const endpoints = {
    namespace: project.namespace,
    internal: `http://${project.name}.${project.namespace}.svc.cluster.local`
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
              {project.name}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <StatusIndicator
              status={project.services?.length > 0 ? 'online' : 'offline'}
              label={project.services?.length > 0 ? 'ACTIVE' : 'NO SERVICES'}
            />
            {hasActiveDeployments() && (
              <span className="font-mono text-xs text-terminal-cyan animate-pulse flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-terminal-cyan rounded-full animate-ping" />
                {isConnected() ? 'DEPLOYING (LIVE)' : 'DEPLOYING'}
              </span>
            )}
            <span className="font-mono text-xs text-terminal-muted">
              Created: {formatDate(project.created_at)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <TerminalButton variant="primary" onClick={onNewService}>
            [ ADD SERVICE ]
          </TerminalButton>
        </div>
      </div>

      <AsciiDivider variant="double" color="green" />

      {/* Live Service URLs - Prominent Display */}
      {project.services?.some(s => s.url && s.current_status === 'live') && (
        <AsciiBox title="Live URLs" variant="green" className="border-terminal-green/50 bg-terminal-bg-secondary">
          <div className="space-y-3">
            {project.services
              .filter(s => s.url && s.current_status === 'live')
              .map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIndicator status="online" showLabel={false} size="sm" />
                    <span className="font-mono text-xs text-terminal-muted uppercase w-20 flex-shrink-0">
                      {service.name}:
                    </span>
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-terminal-green hover:text-terminal-green/80 underline truncate"
                    >
                      {service.url}
                    </a>
                  </div>
                  <button
                    onClick={() => handleCopy(service.url, `url-${service.id}`)}
                    className="font-mono text-xs text-terminal-secondary hover:text-terminal-primary transition-colors flex-shrink-0"
                  >
                    {copied === `url-${service.id}` ? '[COPIED]' : '[COPY]'}
                  </button>
                </div>
              ))}
          </div>
        </AsciiBox>
      )}

      {/* Service Discovery Panel */}
      <AsciiSectionDivider
        title="SERVICE DISCOVERY"
        collapsed={discoveryCollapsed}
        onToggle={() => setDiscoveryCollapsed(!discoveryCollapsed)}
        color="cyan"
      />

      {!discoveryCollapsed && (
        <AsciiBox title="Endpoints" variant="cyan" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-terminal-muted uppercase w-24">
                  NAMESPACE:
                </span>
                <span className="font-mono text-sm text-terminal-primary truncate">
                  {endpoints.namespace}
                </span>
              </div>
              <button
                onClick={() => handleCopy(endpoints.namespace, 'namespace')}
                className="font-mono text-xs text-terminal-secondary hover:text-terminal-primary transition-colors flex-shrink-0"
              >
                {copied === 'namespace' ? '[COPIED]' : '[COPY]'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-terminal-muted uppercase w-24">
                  INTERNAL:
                </span>
                <span className="font-mono text-sm text-terminal-primary truncate">
                  {endpoints.internal}
                </span>
              </div>
              <button
                onClick={() => handleCopy(endpoints.internal, 'internal')}
                className="font-mono text-xs text-terminal-secondary hover:text-terminal-primary transition-colors flex-shrink-0"
              >
                {copied === 'internal' ? '[COPIED]' : '[COPY]'}
              </button>
            </div>
          </div>
        </AsciiBox>
      )}

      {/* Services List */}
      <AsciiSectionDivider
        title="SERVICES"
        collapsed={servicesCollapsed}
        onToggle={() => setServicesCollapsed(!servicesCollapsed)}
        color="amber"
      />

      {!servicesCollapsed && (
        <div className="mt-4">
          {project.services?.length === 0 ? (
            <div className="text-center py-12 border border-terminal-border bg-terminal-bg-secondary">
              <p className="font-mono text-terminal-muted mb-4">No services in this project.</p>
              <TerminalButton variant="primary" onClick={onNewService}>
                [ ADD YOUR FIRST SERVICE ]
              </TerminalButton>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="font-mono text-xs text-terminal-muted border-b border-terminal-border pb-2 mb-2">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-1">STS</div>
                  <div className="col-span-3">SERVICE</div>
                  <div className="col-span-2">PORT</div>
                  <div className="col-span-2">BRANCH</div>
                  <div className="col-span-2">STATUS</div>
                  <div className="col-span-2">ACTION</div>
                </div>
              </div>

              {/* Service Rows */}
              <div className="space-y-1">
                {project.services.map((service) => {
                  const status = getServiceStatus(service)
                  return (
                    <div
                      key={service.id}
                      className="font-mono text-sm hover:bg-terminal-bg-secondary transition-colors cursor-pointer py-2"
                      onClick={() => onServiceClick?.(service)}
                    >
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-1">
                          <StatusIndicator
                            status={status}
                            showLabel={false}
                            size="sm"
                          />
                        </div>
                        <div className="col-span-3 text-terminal-primary truncate">
                          {service.name}
                        </div>
                        <div className="col-span-2 text-terminal-secondary">
                          :{service.port}
                        </div>
                        <div className="col-span-2 text-terminal-muted">
                          {service.branch || 'main'}
                        </div>
                        <div className="col-span-2 text-terminal-muted">
                          {getStatusText(getRealtimeStatus(service) || 'pending')}
                        </div>
                        <div className="col-span-2 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onServiceClick?.(service)
                            }}
                            className="text-terminal-secondary hover:text-terminal-primary transition-colors text-xs"
                          >
                            [VIEW]
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowDeleteModal(service)
                            }}
                            className="text-terminal-red hover:text-terminal-red/80 transition-colors text-xs"
                          >
                            [DEL]
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Table Footer */}
              <div className="font-mono text-xs text-terminal-muted border-t border-terminal-border pt-2 mt-2 flex justify-between items-center">
                <span>Total: {project.services.length} service(s)</span>
                {isConnected() ? (
                  <span className="flex items-center gap-1 text-terminal-green">
                    <span className="inline-block w-1.5 h-1.5 bg-terminal-green rounded-full" />
                    Live updates
                  </span>
                ) : (
                  <span className="text-terminal-muted">Refresh for updates</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Project Info */}
      <AsciiDivider variant="single" color="muted" className="my-6" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AsciiBox title="Project Info" variant="green">
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-terminal-muted">NAME:</span>
              <span className="text-terminal-primary">{project.name}</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-terminal-muted">NAMESPACE:</span>
              <span className="text-terminal-secondary">{project.namespace}</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-terminal-muted">SERVICES:</span>
              <span className="text-terminal-secondary">{project.services?.length || 0}</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-terminal-muted">CREATED:</span>
              <span className="text-terminal-secondary">{formatDate(project.created_at)}</span>
            </div>
          </div>
        </AsciiBox>

        <AsciiBox title="Quick Actions" variant="amber">
          <div className="space-y-3">
            <TerminalButton
              variant="primary"
              onClick={onNewService}
              className="w-full justify-center"
            >
              [ ADD SERVICE ]
            </TerminalButton>
            <TerminalButton
              variant="secondary"
              onClick={loadProject}
              className="w-full justify-center"
            >
              [ REFRESH ]
            </TerminalButton>
          </div>
        </AsciiBox>
      </div>

      {/* Delete Service Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <div className="font-mono whitespace-pre text-terminal-red select-none">
              +-- CONFIRM DELETE -------------------------+
            </div>
            <div className="border-l border-r border-terminal-red bg-terminal-bg-secondary px-6 py-6">
              <p className="font-mono text-terminal-primary mb-2">
                Delete service "{showDeleteModal.name}"?
              </p>
              <p className="font-mono text-xs text-terminal-muted mb-6">
                This will delete the service, its environment variables, and deployment history.
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <TerminalButton
                  variant="secondary"
                  onClick={() => setShowDeleteModal(null)}
                  disabled={deleting}
                >
                  [ CANCEL ]
                </TerminalButton>
                <TerminalButton
                  variant="danger"
                  onClick={() => handleDeleteService(showDeleteModal)}
                  disabled={deleting}
                >
                  {deleting ? '[ DELETING... ]' : '[ DELETE ]'}
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

export default ProjectDetail
