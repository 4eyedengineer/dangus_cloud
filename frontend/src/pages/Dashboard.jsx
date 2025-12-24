import { useState, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { TerminalCard, TerminalDivider, TerminalSection, TerminalModal } from '../components/TerminalCard'
import { StatusIndicator, StatusBar, ProgressGauge } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'
import TerminalInput from '../components/TerminalInput'
import TerminalSelect from '../components/TerminalSelect'
import TerminalSpinner from '../components/TerminalSpinner'
import { useToast } from '../components/Toast'
import { fetchProjects, createProject, deleteProject } from '../api/projects'
import { ApiError } from '../api/utils'

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
  { value: 'services_desc', label: 'Most Services' },
  { value: 'services_asc', label: 'Least Services' }
]

export function Dashboard({ onProjectClick, onNewProject }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewCollapsed, setViewCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_desc')
  const [selectedProjects, setSelectedProjects] = useState(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(null)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
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
      setSelectedProjects(prev => {
        const next = new Set(prev)
        next.delete(project.id)
        return next
      })
      setShowDeleteModal(null)
      toast.success(`Project "${project.name}" deleted successfully`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete project'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    setDeleting(true)
    const toDelete = Array.from(selectedProjects)
    let deleted = 0
    let failed = 0

    for (const id of toDelete) {
      try {
        await deleteProject(id)
        setProjects(prev => prev.filter(p => p.id !== id))
        deleted++
      } catch {
        failed++
      }
    }

    setSelectedProjects(new Set())
    setShowBulkDeleteModal(false)
    setDeleting(false)

    if (deleted > 0) {
      toast.success(`Deleted ${deleted} project(s)`)
    }
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} project(s)`)
    }
  }

  const toggleProjectSelection = (projectId) => {
    setSelectedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.namespace?.toLowerCase().includes(query)
      )
    }

    // Apply status filter
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

    // Apply sorting
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
        case 'services_asc':
          return (a.service_count || 0) - (b.service_count || 0)
        case 'services_desc':
          return (b.service_count || 0) - (a.service_count || 0)
        default:
          return 0
      }
    })

    return result
  }, [projects, searchQuery, filter, sortBy])

  const toggleSelectAll = () => {
    if (selectedProjects.size === filteredAndSortedProjects.length) {
      setSelectedProjects(new Set())
    } else {
      setSelectedProjects(new Set(filteredAndSortedProjects.map(p => p.id)))
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
            {filteredAndSortedProjects.length} of {projects.length} project(s)
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

      <TerminalDivider variant="double" color="green" />

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <TerminalInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full"
          />
        </div>
        <div className="w-full lg:w-48">
          <TerminalSelect
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="w-full lg:w-48">
          <TerminalSelect
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedProjects.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-terminal-bg-secondary border border-terminal-border">
          <span className="font-mono text-sm text-terminal-primary">
            {selectedProjects.size} selected
          </span>
          <TerminalButton
            variant="danger"
            size="sm"
            onClick={() => setShowBulkDeleteModal(true)}
          >
            [ DELETE SELECTED ]
          </TerminalButton>
          <TerminalButton
            variant="secondary"
            size="sm"
            onClick={() => setSelectedProjects(new Set())}
          >
            [ CLEAR ]
          </TerminalButton>
        </div>
      )}

      {/* Projects Section */}
      <TerminalSection
        title="Projects"
        collapsed={viewCollapsed}
        onToggle={() => setViewCollapsed(!viewCollapsed)}
        color="amber"
      />

      {!viewCollapsed && (
        <div className="mt-4">
          {filteredAndSortedProjects.length === 0 ? (
            <div className="text-center py-12 border border-terminal-border bg-terminal-bg-secondary">
              <p className="font-mono text-terminal-muted mb-4">
                {searchQuery || filter !== 'all'
                  ? 'No projects match your filters.'
                  : 'No projects yet.'}
              </p>
              {!searchQuery && filter === 'all' && (
                <TerminalButton variant="primary" onClick={onNewProject}>
                  [ CREATE YOUR FIRST PROJECT ]
                </TerminalButton>
              )}
            </div>
          ) : (
            <>
              {/* Select All Header */}
              <div className="flex items-center gap-3 mb-4 pb-2 border-b border-terminal-border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProjects.size === filteredAndSortedProjects.length && filteredAndSortedProjects.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-terminal-primary"
                  />
                  <span className="font-mono text-xs text-terminal-muted uppercase">
                    Select All
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredAndSortedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    selected={selectedProjects.has(project.id)}
                    onSelect={() => toggleProjectSelection(project.id)}
                    onClick={() => onProjectClick?.(project)}
                    onDelete={() => setShowDeleteModal(project)}
                    formatDate={formatDate}
                    getStatus={getProjectStatus}
                    getStatusText={getProjectStatusText}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <TerminalDivider variant="single" color="muted" className="my-6" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TerminalCard title="Total Services" variant="green">
          <div className="text-center">
            <span className="font-mono text-3xl text-terminal-primary text-glow-green">
              {projects.reduce((acc, p) => acc + (p.service_count || 0), 0)}
            </span>
            <p className="font-mono text-xs text-terminal-muted mt-1">ACTIVE SERVICES</p>
          </div>
        </TerminalCard>

        <TerminalCard title="Active Projects" variant="amber">
          <div className="text-center">
            <span className="font-mono text-3xl text-terminal-secondary text-glow-amber">
              {projects.filter(p => p.service_count > 0).length}
            </span>
            <p className="font-mono text-xs text-terminal-muted mt-1">WITH SERVICES</p>
          </div>
        </TerminalCard>

        <TerminalCard title="Total Projects" variant="green">
          <div className="text-center">
            <span className="font-mono text-3xl text-terminal-primary text-glow-green">
              {projects.length}
            </span>
            <p className="font-mono text-xs text-terminal-muted mt-1">PROJECTS</p>
          </div>
        </TerminalCard>
      </div>

      {/* Delete Confirmation Modal */}
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

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <TerminalModal title="CONFIRM BULK DELETE" variant="red">
          <p className="font-mono text-terminal-primary mb-2">
            Delete {selectedProjects.size} project(s)?
          </p>
          <p className="font-mono text-xs text-terminal-muted mb-6">
            This will delete all services and deployments for these projects. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <TerminalButton
              variant="secondary"
              onClick={() => setShowBulkDeleteModal(false)}
              disabled={deleting}
            >
              [ CANCEL ]
            </TerminalButton>
            <TerminalButton
              variant="danger"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? '[ DELETING... ]' : '[ DELETE ALL ]'}
            </TerminalButton>
          </div>
        </TerminalModal>
      )}
    </div>
  )
}

function ProjectCard({ project, selected, onSelect, onClick, onDelete, formatDate, getStatus, getStatusText }) {
  const status = getStatus(project)

  return (
    <div className="relative">
      {/* Selection Checkbox */}
      <div className="absolute top-0 left-0 z-10 p-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 accent-terminal-primary cursor-pointer"
        />
      </div>

      <div
        className={`cursor-pointer transition-all duration-150 hover:shadow-[var(--glow-green)] ${
          selected ? 'ring-2 ring-terminal-primary' : ''
        }`}
        onClick={onClick}
      >
        <div className="font-mono whitespace-pre text-terminal-muted select-none text-sm">
          +-- {(project.name || 'UNNAMED').toUpperCase().padEnd(36, '-')}--+
        </div>

        <div className="border-l border-r border-terminal-muted px-4 py-3 bg-terminal-bg-secondary">
          {/* Status Row */}
          <div className="flex items-center justify-between mb-3 pl-6">
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
          <div className="mb-3 pl-6">
            <span className="font-mono text-xs text-terminal-muted">NAMESPACE: </span>
            <span className="font-mono text-xs text-terminal-secondary">{project.namespace}</span>
          </div>

          {/* Created Date */}
          <div className="flex items-center justify-between font-mono text-xs pl-6">
            <span className="text-terminal-muted">CREATED:</span>
            <span className="text-terminal-secondary">{formatDate(project.created_at)}</span>
          </div>

          {/* Delete Button */}
          <div className="mt-3 pt-3 border-t border-terminal-border pl-6">
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
    </div>
  )
}

Dashboard.propTypes = {
  onProjectClick: PropTypes.func.isRequired,
  onNewProject: PropTypes.func.isRequired
}

ProjectCard.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    namespace: PropTypes.string,
    service_count: PropTypes.number,
    created_at: PropTypes.string
  }).isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onClick: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
  getStatus: PropTypes.func.isRequired,
  getStatusText: PropTypes.func.isRequired
}

export default Dashboard
