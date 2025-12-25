import { useState, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { TerminalCard, TerminalDivider, TerminalSection, TerminalModal } from '../components/TerminalCard'
import { StatusIndicator, StatusBar } from '../components/StatusIndicator'
import { ErrorDisplay, EmptyState } from '../components/ErrorDisplay'
import TerminalButton from '../components/TerminalButton'
import TerminalInput from '../components/TerminalInput'
import TerminalSelect from '../components/TerminalSelect'
import TerminalSpinner from '../components/TerminalSpinner'
import { useToast } from '../components/Toast'
import { fetchProjects, deleteProject } from '../api/projects'
import { fetchHealthSummary } from '../api/health'
import { ApiError } from '../api/utils'
import { formatDate, formatRelativeTime } from '../utils'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Projects' },
  { value: 'active', label: 'Active (with services)' },
  { value: 'empty', label: 'Empty (no services)' }
]

const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Newest First' },
  { value: 'created_asc', label: 'Oldest First' },
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'services_desc', label: 'Most Services' }
]

export function Dashboard({ onProjectClick, onNewProject, onServiceClick }) {
  const [projects, setProjects] = useState([])
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_desc')
  const [showDeleteModal, setShowDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [errorsCollapsed, setErrorsCollapsed] = useState(false)
  const [deploymentsCollapsed, setDeploymentsCollapsed] = useState(false)
  const [projectsCollapsed, setProjectsCollapsed] = useState(false)
  const toast = useToast()

  useEffect(() => {
    loadDashboardData()
    // Refresh health data every 30 seconds
    const interval = setInterval(() => {
      fetchHealthSummary().then(setHealthData).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectsData, health] = await Promise.all([
        fetchProjects(),
        fetchHealthSummary().catch(() => null)
      ])
      setProjects(projectsData)
      setHealthData(health)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard')
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async (project) => {
    setDeleting(true)
    try {
      await deleteProject(project.id)
      setProjects(prev => prev.filter(p => p.id !== project.id))
      setShowDeleteModal(null)
      toast.success(`Project "${project.name}" deleted`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete project')
    } finally {
      setDeleting(false)
    }
  }

  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.namespace?.toLowerCase().includes(query)
      )
    }

    switch (filter) {
      case 'active':
        result = result.filter(p => p.service_count > 0)
        break
      case 'empty':
        result = result.filter(p => !p.service_count || p.service_count === 0)
        break
      default:
        break
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name)
        case 'name_desc':
          return b.name.localeCompare(a.name)
        case 'created_asc':
          return new Date(a.created_at) - new Date(b.created_at)
        case 'created_desc':
          return new Date(b.created_at) - new Date(a.created_at)
        case 'services_desc':
          return (b.service_count || 0) - (a.service_count || 0)
        default:
          return 0
      }
    })

    return result
  }, [projects, searchQuery, filter, sortBy])

  const getProjectStatus = (project) => {
    if (project.service_count === 0) return 'offline'
    return 'online'
  }

  const getProjectStatusText = (status) => {
    const statusMap = {
      online: 'RUNNING',
      offline: 'NO SERVICES',
      warning: 'DEGRADED',
      error: 'FAILED'
    }
    return statusMap[status] || 'UNKNOWN'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <TerminalSpinner className="text-2xl" />
          <p className="font-mono text-terminal-muted mt-4">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={loadDashboardData}
        title="Dashboard Error"
      />
    )
  }

  const hasErrors = healthData?.errors?.length > 0
  const hasWarnings = healthData?.warnings?.length > 0
  const hasActiveDeployments = healthData?.activeDeployments?.length > 0
  const summary = healthData?.summary || { running: 0, deploying: 0, warning: 0, failed: 0 }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl text-terminal-primary text-glow-green uppercase tracking-terminal-wide">
            SYSTEM DASHBOARD
          </h1>
          <p className="font-mono text-sm text-terminal-muted mt-1">
            Health overview and system status
          </p>
        </div>
        <TerminalButton variant="primary" onClick={onNewProject}>
          [ NEW PROJECT ]
        </TerminalButton>
      </div>

      {/* System Status Bar */}
      <StatusBar
        items={[
          { status: 'online', label: 'CLUSTER' },
          { status: 'active', label: 'NETWORK' },
          { status: 'online', label: 'STORAGE' }
        ]}
      />

      {/* Service Health Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-terminal-green/50 bg-terminal-green/10 p-3 text-center">
          <div className="font-mono text-2xl text-terminal-green">{summary.running}</div>
          <div className="font-mono text-xs text-terminal-muted">RUNNING</div>
        </div>
        <div className={`border p-3 text-center ${summary.deploying > 0 ? 'border-terminal-cyan/50 bg-terminal-cyan/10' : 'border-terminal-border bg-terminal-bg-secondary'}`}>
          <div className={`font-mono text-2xl ${summary.deploying > 0 ? 'text-terminal-cyan animate-pulse' : 'text-terminal-muted'}`}>{summary.deploying}</div>
          <div className="font-mono text-xs text-terminal-muted">DEPLOYING</div>
        </div>
        <div className={`border p-3 text-center ${summary.warning > 0 ? 'border-terminal-amber/50 bg-terminal-amber/10' : 'border-terminal-border bg-terminal-bg-secondary'}`}>
          <div className={`font-mono text-2xl ${summary.warning > 0 ? 'text-terminal-amber' : 'text-terminal-muted'}`}>{summary.warning}</div>
          <div className="font-mono text-xs text-terminal-muted">WARNING</div>
        </div>
        <div className={`border p-3 text-center ${summary.failed > 0 ? 'border-terminal-red/50 bg-terminal-red/10' : 'border-terminal-border bg-terminal-bg-secondary'}`}>
          <div className={`font-mono text-2xl ${summary.failed > 0 ? 'text-terminal-red' : 'text-terminal-muted'}`}>{summary.failed}</div>
          <div className="font-mono text-xs text-terminal-muted">FAILED</div>
        </div>
      </div>

      <TerminalDivider variant="double" color="green" />

      {/* Errors & Warnings Section */}
      {(hasErrors || hasWarnings) && (
        <>
          <TerminalSection
            title="ERRORS & WARNINGS"
            collapsed={errorsCollapsed}
            onToggle={() => setErrorsCollapsed(!errorsCollapsed)}
            color="red"
          />

          {!errorsCollapsed && (
            <div className="space-y-2">
              {healthData.errors.map((err, idx) => (
                <div
                  key={`error-${idx}`}
                  className="flex items-start gap-3 p-3 border border-terminal-red/50 bg-terminal-red/10 cursor-pointer hover:bg-terminal-red/20 transition-colors"
                  onClick={() => onServiceClick?.(err.service.id)}
                >
                  <span className="font-mono text-terminal-red text-lg">[!]</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-terminal-primary">
                      <span className="text-terminal-red">{err.service.name}</span>
                      <span className="text-terminal-muted"> / {err.project.name}</span>
                    </div>
                    <p className="font-mono text-xs text-terminal-muted truncate mt-1">
                      {err.message}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onServiceClick?.(err.service.id, 'logs')
                      }}
                      className="font-mono text-xs text-terminal-cyan hover:text-terminal-primary"
                    >
                      [LOGS]
                    </button>
                  </div>
                </div>
              ))}

              {healthData.warnings.map((warn, idx) => (
                <div
                  key={`warning-${idx}`}
                  className="flex items-start gap-3 p-3 border border-terminal-amber/50 bg-terminal-amber/10 cursor-pointer hover:bg-terminal-amber/20 transition-colors"
                  onClick={() => onServiceClick?.(warn.service.id)}
                >
                  <span className="font-mono text-terminal-amber text-lg">[~]</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-terminal-primary">
                      <span className="text-terminal-amber">{warn.service.name}</span>
                      <span className="text-terminal-muted"> / {warn.project.name}</span>
                    </div>
                    <p className="font-mono text-xs text-terminal-muted truncate mt-1">
                      {warn.message || 'Health check failing'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onServiceClick?.(warn.service.id)
                    }}
                    className="font-mono text-xs text-terminal-cyan hover:text-terminal-primary"
                  >
                    [VIEW]
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Status Banner */}
      {!hasErrors && !hasWarnings && (
        summary.running > 0 ? (
          <div className="flex items-center gap-3 p-3 border border-terminal-green/50 bg-terminal-green/10">
            <span className="font-mono text-terminal-green text-lg">[OK]</span>
            <span className="font-mono text-sm text-terminal-primary">
              All systems operational - no issues detected
            </span>
          </div>
        ) : summary.deploying > 0 ? null : (
          <div className="flex items-center gap-3 p-3 border border-terminal-muted/50 bg-terminal-bg-secondary">
            <span className="font-mono text-terminal-muted text-lg">[~]</span>
            <span className="font-mono text-sm text-terminal-muted">
              No services running - deploy your first service to get started
            </span>
          </div>
        )
      )}

      {/* Active Deployments Section */}
      {hasActiveDeployments && (
        <>
          <TerminalSection
            title="ACTIVE DEPLOYMENTS"
            collapsed={deploymentsCollapsed}
            onToggle={() => setDeploymentsCollapsed(!deploymentsCollapsed)}
            color="cyan"
          />

          {!deploymentsCollapsed && (
            <div className="space-y-2">
              {healthData.activeDeployments.map((dep, idx) => (
                <div
                  key={`deploy-${idx}`}
                  className="flex items-center gap-3 p-3 border border-terminal-cyan/50 bg-terminal-cyan/10 cursor-pointer hover:bg-terminal-cyan/20 transition-colors"
                  onClick={() => onServiceClick?.(dep.service.id, 'logs')}
                >
                  <span className="font-mono text-terminal-cyan animate-pulse">[*]</span>
                  <div className="flex-1">
                    <span className="font-mono text-sm text-terminal-primary">
                      {dep.service.name}
                    </span>
                    <span className="font-mono text-sm text-terminal-muted"> / {dep.project.name}</span>
                  </div>
                  <span className="font-mono text-xs text-terminal-cyan uppercase">
                    {dep.status}...
                  </span>
                  <span className="font-mono text-xs text-terminal-muted">
                    {formatRelativeTime(dep.startedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Recent Activity */}
      {healthData?.recentActivity?.length > 0 && (
        <TerminalCard title="Recent Activity" variant="green">
          <div className="space-y-2">
            {healthData.recentActivity.map((activity, idx) => (
              <div
                key={`activity-${idx}`}
                className="flex items-center gap-3 font-mono text-sm cursor-pointer hover:bg-terminal-bg-secondary p-1 -mx-1 transition-colors"
                onClick={() => onServiceClick?.(activity.service.id)}
              >
                <span className="text-terminal-green">OK</span>
                <span className="text-terminal-primary">{activity.service.name}</span>
                <span className="text-terminal-muted">deployed</span>
                <span className="text-terminal-secondary ml-auto">{formatRelativeTime(activity.timestamp)}</span>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      <TerminalDivider variant="single" color="muted" />

      {/* Projects Section */}
      <TerminalSection
        title="PROJECTS"
        collapsed={projectsCollapsed}
        onToggle={() => setProjectsCollapsed(!projectsCollapsed)}
        color="amber"
        badge={`${filteredAndSortedProjects.length}`}
      />

      {!projectsCollapsed && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-3 mt-4">
            <div className="flex-1">
              <TerminalInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full"
              />
            </div>
            <div className="w-full lg:w-40">
              <TerminalSelect
                options={FILTER_OPTIONS}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div className="w-full lg:w-40">
              <TerminalSelect
                options={SORT_OPTIONS}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              />
            </div>
          </div>

          {filteredAndSortedProjects.length === 0 ? (
            <EmptyState
              icon="[+]"
              title={searchQuery || filter !== 'all' ? 'No projects match filters' : 'No projects yet'}
              description={!searchQuery && filter === 'all' ? 'Create your first project to get started' : null}
              action={!searchQuery && filter === 'all' && (
                <TerminalButton variant="primary" onClick={onNewProject}>
                  [ CREATE PROJECT ]
                </TerminalButton>
              )}
              className="mt-4"
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
              {filteredAndSortedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => onProjectClick?.(project)}
                  onDelete={() => setShowDeleteModal(project)}
                  getStatus={getProjectStatus}
                  getStatusText={getProjectStatusText}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <TerminalModal title="CONFIRM DELETE" variant="red">
          <p className="font-mono text-terminal-primary mb-2">
            Delete project "{showDeleteModal.name}"?
          </p>
          <p className="font-mono text-xs text-terminal-muted mb-6">
            This will delete all services and deployments. This action cannot be undone.
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
              onClick={() => handleDeleteProject(showDeleteModal)}
              disabled={deleting}
            >
              {deleting ? '[ DELETING... ]' : '[ DELETE ]'}
            </TerminalButton>
          </div>
        </TerminalModal>
      )}
    </div>
  )
}

function ProjectCard({ project, onClick, onDelete, getStatus, getStatusText }) {
  const status = getStatus(project)

  return (
    <div
      className="border border-terminal-border bg-terminal-bg-secondary p-4 cursor-pointer hover:border-terminal-primary hover:shadow-[var(--glow-green)] transition-all duration-150"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-mono text-sm text-terminal-primary uppercase truncate">
            {project.name}
          </h3>
          <p className="font-mono text-xs text-terminal-muted truncate">
            {project.namespace}
          </p>
        </div>
        <StatusIndicator
          status={status}
          label={getStatusText(status)}
          size="sm"
        />
      </div>

      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-terminal-secondary">
          {project.service_count || 0} service(s)
        </span>
        <span className="text-terminal-muted">
          {formatRelativeTime(project.created_at)}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-terminal-border flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="font-mono text-xs text-terminal-red hover:text-terminal-red/80 transition-colors"
        >
          [DELETE]
        </button>
      </div>
    </div>
  )
}

Dashboard.propTypes = {
  onProjectClick: PropTypes.func.isRequired,
  onNewProject: PropTypes.func.isRequired,
  onServiceClick: PropTypes.func
}

ProjectCard.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    namespace: PropTypes.string,
    service_count: PropTypes.number,
    created_at: PropTypes.string
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  getStatus: PropTypes.func.isRequired,
  getStatusText: PropTypes.func.isRequired
}

export default Dashboard
