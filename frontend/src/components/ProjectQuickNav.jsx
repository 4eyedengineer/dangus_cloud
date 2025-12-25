import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { StatusIndicator } from './StatusIndicator'
import { fetchProjects } from '../api/projects'
import { useWebSocket } from '../hooks/useWebSocket'

const COLLAPSED_KEY = 'dangus_project_nav_collapsed'

export function ProjectQuickNav({ className = '' }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY)
    return stored === 'true'
  })

  const navigate = useNavigate()
  const location = useLocation()
  const { subscribe, isConnected } = useWebSocket()

  // Get current project ID from URL
  const getCurrentProjectId = useCallback(() => {
    const match = location.pathname.match(/^\/projects\/([^/]+)/)
    if (match && match[1] !== 'new') {
      return match[1]
    }
    return null
  }, [location.pathname])

  const currentProjectId = getCurrentProjectId()

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  // Subscribe to project updates
  useEffect(() => {
    if (!isConnected()) return

    const unsubscribe = subscribe('projects:update', () => {
      loadProjects()
    })

    return () => unsubscribe?.()
  }, [subscribe, isConnected])

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed))
  }, [collapsed])

  const loadProjects = async () => {
    try {
      const data = await fetchProjects()
      setProjects(data)
    } catch (err) {
      console.error('Failed to load projects for nav:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleProjectClick = (project) => {
    navigate(`/projects/${project.id}`)
  }

  const handleNewProject = () => {
    navigate('/projects/new')
  }

  const getProjectStatus = (project) => {
    if (project.service_count === 0) return 'offline'
    // Could enhance with real status from services
    return 'online'
  }

  if (loading) {
    return (
      <div className={`h-full bg-terminal-bg-secondary border-r border-terminal-border ${collapsed ? 'w-10' : 'w-48'} ${className}`}>
        <div className="p-2 font-mono text-xs text-terminal-muted">
          {collapsed ? '...' : 'Loading...'}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`
        h-full bg-terminal-bg-secondary border-r border-terminal-border
        flex flex-col transition-all duration-200
        ${collapsed ? 'w-10' : 'w-48'}
        ${className}
      `}
    >
      {/* Header with toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="
          flex items-center justify-between px-2 py-2
          border-b border-terminal-border
          text-terminal-muted hover:text-terminal-primary
          transition-colors font-mono text-xs
        "
        title={collapsed ? 'Expand projects' : 'Collapse projects'}
      >
        {!collapsed && <span className="uppercase tracking-wider">Projects</span>}
        <span className="text-xs">{collapsed ? '[+]' : '[-]'}</span>
      </button>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 ? (
          !collapsed && (
            <div className="px-2 py-2 font-mono text-xs text-terminal-muted">
              No projects yet
            </div>
          )
        ) : (
          projects.map((project) => {
            const isActive = currentProjectId === String(project.id)
            const status = getProjectStatus(project)

            return (
              <button
                key={project.id}
                onClick={() => handleProjectClick(project)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5
                  font-mono text-xs transition-colors
                  ${isActive
                    ? 'bg-terminal-bg-elevated text-terminal-primary'
                    : 'text-terminal-secondary hover:text-terminal-primary hover:bg-terminal-bg-elevated'
                  }
                `}
                title={project.name}
              >
                <StatusIndicator
                  status={status}
                  showLabel={false}
                  size="sm"
                />
                {!collapsed && (
                  <span className="truncate flex-1 text-left">
                    {project.name}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* New project button */}
      <button
        onClick={handleNewProject}
        className="
          flex items-center justify-center gap-1 px-2 py-2
          border-t border-terminal-border
          text-terminal-secondary hover:text-terminal-primary
          transition-colors font-mono text-xs
        "
        title="New Project"
      >
        {collapsed ? '[+]' : '[ + NEW ]'}
      </button>
    </div>
  )
}

export default ProjectQuickNav
