import { useState } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider, AsciiSectionDivider } from '../components/AsciiDivider'
import { StatusIndicator, ProgressGauge } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'

export function ProjectDetail({ project, onServiceClick, onNewService, onBack }) {
  const [servicesCollapsed, setServicesCollapsed] = useState(false)
  const [discoveryCollapsed, setDiscoveryCollapsed] = useState(false)
  const [copied, setCopied] = useState(null)

  // Mock data for demonstration
  const mockProject = project || {
    id: '1',
    name: 'web-frontend',
    status: 'online',
    createdAt: '2024-12-01T08:00:00Z',
    description: 'Production frontend application',
    services: [
      {
        id: 's1',
        name: 'nginx-proxy',
        type: 'container',
        status: 'online',
        port: 80,
        replicas: 3,
        image: 'nginx:1.25-alpine'
      },
      {
        id: 's2',
        name: 'react-app',
        type: 'container',
        status: 'online',
        port: 3000,
        replicas: 2,
        image: 'node:20-alpine'
      },
      {
        id: 's3',
        name: 'redis-cache',
        type: 'database',
        status: 'warning',
        port: 6379,
        replicas: 1,
        image: 'redis:7-alpine'
      }
    ],
    endpoints: {
      public: 'https://app.dangus.cloud',
      internal: 'http://web-frontend.internal:8080',
      healthcheck: 'https://app.dangus.cloud/health'
    }
  }

  const handleCopy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
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
      pending: 'STARTING'
    }
    return statusMap[status] || 'UNKNOWN'
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
              ◄ BACK
            </button>
            <h1 className="font-mono text-xl text-terminal-primary text-glow-green uppercase tracking-terminal-wide">
              {mockProject.name}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <StatusIndicator
              status={mockProject.status}
              label={getStatusText(mockProject.status)}
            />
            <span className="font-mono text-xs text-terminal-muted">
              Created: {formatDate(mockProject.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <TerminalButton variant="secondary" onClick={() => {}}>
            [ SETTINGS ]
          </TerminalButton>
          <TerminalButton variant="primary" onClick={onNewService}>
            [ ADD SERVICE ]
          </TerminalButton>
        </div>
      </div>

      <AsciiDivider variant="double" color="green" />

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
            {Object.entries(mockProject.endpoints).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-terminal-muted uppercase w-20">
                    {key}:
                  </span>
                  <span className="font-mono text-sm text-terminal-primary truncate">
                    {value}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(value, key)}
                  className="font-mono text-xs text-terminal-secondary hover:text-terminal-primary transition-colors flex-shrink-0"
                >
                  {copied === key ? '[COPIED]' : '[COPY]'}
                </button>
              </div>
            ))}
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
          {/* Table Header */}
          <div className="font-mono text-xs text-terminal-muted border-b border-terminal-border pb-2 mb-2">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-1">STS</div>
              <div className="col-span-3">SERVICE</div>
              <div className="col-span-2">TYPE</div>
              <div className="col-span-2">PORT</div>
              <div className="col-span-2">REPLICAS</div>
              <div className="col-span-2">ACTION</div>
            </div>
          </div>

          {/* Service Rows */}
          <div className="space-y-1">
            {mockProject.services.map((service) => (
              <div
                key={service.id}
                className="font-mono text-sm hover:bg-terminal-bg-secondary transition-colors cursor-pointer py-2"
                onClick={() => onServiceClick?.(service)}
              >
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-1">
                    <StatusIndicator
                      status={service.status}
                      showLabel={false}
                      size="sm"
                    />
                  </div>
                  <div className="col-span-3 text-terminal-primary truncate">
                    {service.name}
                  </div>
                  <div className="col-span-2 text-terminal-muted uppercase">
                    {service.type}
                  </div>
                  <div className="col-span-2 text-terminal-secondary">
                    :{service.port}
                  </div>
                  <div className="col-span-2 text-terminal-muted">
                    {service.replicas}x
                  </div>
                  <div className="col-span-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onServiceClick?.(service)
                      }}
                      className="text-terminal-secondary hover:text-terminal-primary transition-colors text-xs"
                    >
                      [VIEW]
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Table Footer */}
          <div className="font-mono text-xs text-terminal-muted border-t border-terminal-border pt-2 mt-2">
            Total: {mockProject.services.length} service(s)
          </div>
        </div>
      )}

      {/* Resource Overview */}
      <AsciiDivider variant="single" color="muted" className="my-6" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AsciiBox title="Resource Usage" variant="green">
          <div className="space-y-3">
            <ProgressGauge value={45} label="CPU ALLOCATION" width={18} />
            <ProgressGauge value={62} label="MEMORY USAGE" width={18} />
            <ProgressGauge value={28} label="STORAGE" width={18} />
            <ProgressGauge value={15} label="NETWORK I/O" width={18} />
          </div>
        </AsciiBox>

        <AsciiBox title="Recent Activity" variant="amber">
          <div className="space-y-2 font-mono text-xs">
            <ActivityLogEntry
              time="10:45:23"
              action="DEPLOY"
              target="react-app"
              status="success"
            />
            <ActivityLogEntry
              time="10:42:15"
              action="SCALE"
              target="nginx-proxy"
              status="success"
            />
            <ActivityLogEntry
              time="10:30:00"
              action="RESTART"
              target="redis-cache"
              status="warning"
            />
            <ActivityLogEntry
              time="09:15:00"
              action="CONFIG"
              target="nginx-proxy"
              status="success"
            />
          </div>
        </AsciiBox>
      </div>
    </div>
  )
}

function ActivityLogEntry({ time, action, target, status }) {
  const statusColors = {
    success: 'text-terminal-primary',
    warning: 'text-terminal-secondary',
    error: 'text-terminal-red'
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-terminal-muted">[{time}]</span>
      <span className={`uppercase ${statusColors[status]}`}>{action}</span>
      <span className="text-terminal-muted">→</span>
      <span className="text-terminal-secondary">{target}</span>
    </div>
  )
}

export default ProjectDetail
