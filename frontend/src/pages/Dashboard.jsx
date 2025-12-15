import { useState } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider, AsciiSectionDivider } from '../components/AsciiDivider'
import { StatusIndicator, StatusBar, ProgressGauge } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'

export function Dashboard({ projects = [], onNewProject, onProjectClick }) {
  const [viewCollapsed, setViewCollapsed] = useState(false)

  // Mock data for demonstration
  const mockProjects = projects.length > 0 ? projects : [
    {
      id: '1',
      name: 'web-frontend',
      status: 'online',
      services: 3,
      lastDeployed: '2024-12-15T10:30:00Z',
      resourceUsage: { cpu: 45, memory: 62, storage: 28 }
    },
    {
      id: '2',
      name: 'api-backend',
      status: 'online',
      services: 5,
      lastDeployed: '2024-12-14T15:45:00Z',
      resourceUsage: { cpu: 72, memory: 58, storage: 45 }
    },
    {
      id: '3',
      name: 'data-pipeline',
      status: 'warning',
      services: 2,
      lastDeployed: '2024-12-13T08:00:00Z',
      resourceUsage: { cpu: 88, memory: 91, storage: 67 }
    },
    {
      id: '4',
      name: 'staging-env',
      status: 'offline',
      services: 4,
      lastDeployed: '2024-12-10T12:00:00Z',
      resourceUsage: { cpu: 0, memory: 0, storage: 15 }
    }
  ]

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toISOString().replace('T', ' ').substring(0, 19)
  }

  const getProjectStatusText = (status) => {
    const statusMap = {
      online: 'RUNNING',
      offline: 'STOPPED',
      warning: 'DEGRADED',
      error: 'FAILED',
      pending: 'DEPLOYING'
    }
    return statusMap[status] || 'UNKNOWN'
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl text-terminal-primary text-glow-green uppercase tracking-terminal-wide">
            ═══ PROJECTS DASHBOARD ═══
          </h1>
          <p className="font-mono text-sm text-terminal-muted mt-1">
            {mockProjects.length} project(s) deployed
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
        title="ACTIVE PROJECTS"
        collapsed={viewCollapsed}
        onToggle={() => setViewCollapsed(!viewCollapsed)}
        color="amber"
      />

      {!viewCollapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {mockProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onProjectClick?.(project)}
              formatDate={formatDate}
              getStatusText={getProjectStatusText}
            />
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <AsciiDivider variant="single" color="muted" className="my-6" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AsciiBox title="Total Services" variant="green">
          <div className="text-center">
            <span className="font-mono text-3xl text-terminal-primary text-glow-green">
              {mockProjects.reduce((acc, p) => acc + p.services, 0)}
            </span>
            <p className="font-mono text-xs text-terminal-muted mt-1">ACTIVE SERVICES</p>
          </div>
        </AsciiBox>

        <AsciiBox title="Deployments Today" variant="amber">
          <div className="text-center">
            <span className="font-mono text-3xl text-terminal-secondary text-glow-amber">
              7
            </span>
            <p className="font-mono text-xs text-terminal-muted mt-1">SUCCESSFUL DEPLOYS</p>
          </div>
        </AsciiBox>

        <AsciiBox title="System Health" variant="green">
          <div className="text-center">
            <span className="font-mono text-3xl text-terminal-primary text-glow-green">
              98%
            </span>
            <p className="font-mono text-xs text-terminal-muted mt-1">UPTIME THIS MONTH</p>
          </div>
        </AsciiBox>
      </div>
    </div>
  )
}

function ProjectCard({ project, onClick, formatDate, getStatusText }) {
  return (
    <div
      className="cursor-pointer transition-all duration-150 hover:shadow-[var(--glow-green)]"
      onClick={onClick}
    >
      <div className="font-mono whitespace-pre text-terminal-muted select-none text-sm">
        ┌─ {project.name.toUpperCase().padEnd(36, '─')}─┐
      </div>

      <div className="border-l border-r border-terminal-muted px-4 py-3 bg-terminal-bg-secondary">
        {/* Status Row */}
        <div className="flex items-center justify-between mb-3">
          <StatusIndicator
            status={project.status}
            label={getStatusText(project.status)}
            size="sm"
          />
          <span className="font-mono text-xs text-terminal-muted">
            {project.services} service(s)
          </span>
        </div>

        {/* Resource Gauges */}
        <div className="space-y-2 mb-3">
          <ProgressGauge
            value={project.resourceUsage.cpu}
            label="CPU"
            width={15}
          />
          <ProgressGauge
            value={project.resourceUsage.memory}
            label="MEM"
            width={15}
          />
        </div>

        {/* Last Deploy */}
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-terminal-muted">LAST DEPLOY:</span>
          <span className="text-terminal-secondary">{formatDate(project.lastDeployed)}</span>
        </div>
      </div>

      <div className="font-mono whitespace-pre text-terminal-muted select-none text-sm">
        └{'─'.repeat(40)}┘
      </div>
    </div>
  )
}

export default Dashboard
