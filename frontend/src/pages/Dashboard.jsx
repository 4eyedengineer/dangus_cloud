import { useState, useEffect } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider, AsciiSectionDivider } from '../components/AsciiDivider'
import { StatusIndicator, StatusBar, ProgressGauge } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'
import TerminalInput from '../components/TerminalInput'
import TerminalSpinner from '../components/TerminalSpinner'
import { useToast } from '../components/Toast'
import { fetchProjects, createProject, deleteProject } from '../api/projects'
import { ApiError } from '../api/utils'

export function Dashboard({ onProjectClick, onNewProject }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewCollapsed, setViewCollapsed] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProjects()
      setProjects(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load projects')
      toast.error('Failed to load projects')
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
      toast.success(`Project "${project.name}" deleted successfully`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete project'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toISOString().replace('T', ' ').substring(0, 19)
  }

  const getProjectStatus = (project) => {
    // Derive status from service_count or other factors
    if (project.service_count === 0) return 'offline'
    return 'online'
  }

  const getProjectStatusText = (status) => {
    const statusMap = {
      online: 'RUNNING',
      offline: 'NO SERVICES',
      warning: 'DEGRADED',
      error: 'FAILED',
      pending: 'DEPLOYING'
    }
    return statusMap[status] || 'UNKNOWN'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <TerminalSpinner className="text-2xl" />
          <p className="font-mono text-terminal-muted mt-4">Loading projects...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="font-mono text-terminal-red mb-4">! {error}</p>
        <TerminalButton variant="secondary" onClick={loadProjects}>
          [ RETRY ]
        </TerminalButton>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl text-terminal-primary text-glow-green uppercase tracking-terminal-wide">
            PROJECTS DASHBOARD
          </h1>
          <p className="font-mono text-sm text-terminal-muted mt-1">
            {projects.length} project(s) deployed
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
        className="mb-4"
      />

      <AsciiDivider variant="double" color="green" />

      {/* Projects Section */}
      <AsciiSectionDivider
        title="Active Projects"
        collapsed={viewCollapsed}
        onToggle={() => setViewCollapsed(!viewCollapsed)}
        color="amber"
        commandFlags={['--show-projects', '--view=grid']}
        showLeftBorder={true}
      />

      {!viewCollapsed && (
        <div className="mt-4">
          {projects.length === 0 ? (
            <div className="text-center py-12 border border-terminal-border bg-terminal-bg-secondary">
              <p className="font-mono text-terminal-muted mb-4">No projects yet.</p>
              <TerminalButton variant="primary" onClick={onNewProject}>
                [ CREATE YOUR FIRST PROJECT ]
              </TerminalButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => onProjectClick?.(project)}
                  onDelete={() => setShowDeleteModal(project)}
                  formatDate={formatDate}
                  getStatus={getProjectStatus}
                  getStatusText={getProjectStatusText}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <AsciiDivider variant="single" color="muted" className="my-6" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AsciiBox title="Total Services.." variant="green">
          <div className="text-center">
            <span className="font-mono text-3xl text-terminal-primary text-glow-green">
              {projects.reduce((acc, p) => acc + (p.service_count || 0), 0)}
            </span>
            <p className="font-mono text-xs text-terminal-muted mt-1">ACTIVE SERVICES</p>
          </div>
        </AsciiBox>

        <AsciiBox title="Total Projects.." variant="amber">
          <div className="text-center">
            <span className="font-mono text-3xl text-terminal-secondary text-glow-amber">
              {projects.length}
            </span>
            <p className="font-mono text-xs text-terminal-muted mt-1">PROJECTS</p>
          </div>
        </AsciiBox>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <div className="font-mono whitespace-pre text-terminal-red select-none">
              +-- CONFIRM DELETE -------------------------+
            </div>
            <div className="border-l border-r border-terminal-red bg-terminal-bg-secondary px-6 py-6">
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

function ProjectCard({ project, onClick, onDelete, formatDate, getStatus, getStatusText }) {
  const status = getStatus(project)

  return (
    <div
      className="cursor-pointer transition-all duration-150 hover:shadow-[var(--glow-green)]"
      onClick={onClick}
    >
      <div className="font-mono whitespace-pre text-terminal-muted select-none text-sm">
        +-- {(project.name || 'UNNAMED').toUpperCase().padEnd(36, '-')}--+
      </div>

      <div className="border-l border-r border-terminal-muted px-4 py-3 bg-terminal-bg-secondary">
        {/* Status Row */}
        <div className="flex items-center justify-between mb-3">
          <StatusIndicator
            status={status}
            label={getStatusText(status)}
            size="sm"
          />
          <span className="font-mono text-xs text-terminal-muted">
            {project.service_count || 0} service(s)
          </span>
        </div>

        {/* Namespace */}
        <div className="mb-3">
          <span className="font-mono text-xs text-terminal-muted">NAMESPACE: </span>
          <span className="font-mono text-xs text-terminal-secondary">{project.namespace}</span>
        </div>

        {/* Created Date */}
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-terminal-muted">CREATED:</span>
          <span className="text-terminal-secondary">{formatDate(project.created_at)}</span>
        </div>

        {/* Delete Button */}
        <div className="mt-3 pt-3 border-t border-terminal-border">
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

      <div className="font-mono whitespace-pre text-terminal-muted select-none text-sm">
        +{'--'.repeat(21)}+
      </div>
    </div>
  )
}

export default Dashboard
