import { useState } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider, AsciiSectionDivider } from '../components/AsciiDivider'
import { StatusIndicator, ProgressGauge } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'

export function ServiceDetail({ service, onBack }) {
  const [configCollapsed, setConfigCollapsed] = useState(false)
  const [envCollapsed, setEnvCollapsed] = useState(false)
  const [webhooksCollapsed, setWebhooksCollapsed] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [copied, setCopied] = useState(null)
  const [secretsRevealed, setSecretsRevealed] = useState({})

  // Mock data for demonstration
  const mockService = service || {
    id: 's1',
    name: 'nginx-proxy',
    type: 'container',
    status: 'online',
    port: 80,
    replicas: 3,
    image: 'nginx:1.25-alpine',
    createdAt: '2024-12-01T08:00:00Z',
    config: {
      cpu_limit: '500m',
      memory_limit: '512Mi',
      restart_policy: 'always',
      health_check: '/health',
      timeout: '30s'
    },
    envVars: [
      { key: 'NODE_ENV', value: 'production', secret: false },
      { key: 'API_URL', value: 'https://api.dangus.cloud', secret: false },
      { key: 'DB_PASSWORD', value: 'sk_live_xxxxx', secret: true },
      { key: 'JWT_SECRET', value: 'jwt_secret_key', secret: true }
    ],
    webhooks: [
      { id: 'wh1', event: 'deploy', url: 'https://hooks.slack.com/xxxx', secret: 'whsec_xxxxx', enabled: true },
      { id: 'wh2', event: 'failure', url: 'https://api.pagerduty.com/xxxx', secret: 'pdkey_xxxxx', enabled: true }
    ],
    deployments: [
      { id: 'd1', version: 'v1.2.5', status: 'success', timestamp: '2024-12-15T10:45:00Z', duration: '45s' },
      { id: 'd2', version: 'v1.2.4', status: 'success', timestamp: '2024-12-14T15:30:00Z', duration: '52s' },
      { id: 'd3', version: 'v1.2.3', status: 'failed', timestamp: '2024-12-14T14:00:00Z', duration: '12s' },
      { id: 'd4', version: 'v1.2.2', status: 'success', timestamp: '2024-12-13T09:15:00Z', duration: '48s' },
      { id: 'd5', version: 'v1.2.1', status: 'success', timestamp: '2024-12-12T11:00:00Z', duration: '51s' }
    ]
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

  const toggleSecret = (key) => {
    setSecretsRevealed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const maskValue = (value) => {
    return '*'.repeat(Math.min(value.length, 20))
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
      success: 'SUCCESS',
      failed: 'FAILED'
    }
    return statusMap[status] || 'UNKNOWN'
  }

  const getDeploymentStatus = (status) => {
    switch (status) {
      case 'success': return 'online'
      case 'failed': return 'error'
      case 'pending': return 'pending'
      default: return 'idle'
    }
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
              {mockService.name}
            </h1>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <StatusIndicator
              status={mockService.status}
              label={getStatusText(mockService.status)}
            />
            <span className="font-mono text-xs text-terminal-muted">
              Type: <span className="text-terminal-secondary uppercase">{mockService.type}</span>
            </span>
            <span className="font-mono text-xs text-terminal-muted">
              Port: <span className="text-terminal-secondary">:{mockService.port}</span>
            </span>
            <span className="font-mono text-xs text-terminal-muted">
              Replicas: <span className="text-terminal-secondary">{mockService.replicas}x</span>
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <TerminalButton variant="secondary" onClick={() => {}}>
            [ LOGS ]
          </TerminalButton>
          <TerminalButton variant="secondary" onClick={() => {}}>
            [ RESTART ]
          </TerminalButton>
          <TerminalButton variant="danger" onClick={() => {}}>
            [ STOP ]
          </TerminalButton>
        </div>
      </div>

      <AsciiDivider variant="double" color="green" />

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
            {Object.entries(mockService.config).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between border-b border-terminal-border pb-2">
                <span className="font-mono text-xs text-terminal-muted uppercase">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="font-mono text-sm text-terminal-primary">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-terminal-border">
            <span className="font-mono text-xs text-terminal-muted">IMAGE: </span>
            <span className="font-mono text-sm text-terminal-secondary">{mockService.image}</span>
          </div>
        </AsciiBox>
      )}

      {/* Environment Variables Section */}
      <AsciiSectionDivider
        title="ENVIRONMENT VARIABLES"
        collapsed={envCollapsed}
        onToggle={() => setEnvCollapsed(!envCollapsed)}
        color="amber"
      />

      {!envCollapsed && (
        <div className="mt-4 border border-terminal-border bg-terminal-bg-secondary">
          {/* Table Header */}
          <div className="font-mono text-xs text-terminal-muted border-b border-terminal-border p-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-4">KEY</div>
              <div className="col-span-5">VALUE</div>
              <div className="col-span-3">ACTIONS</div>
            </div>
          </div>

          {/* Environment Variable Rows */}
          {mockService.envVars.map((env, index) => (
            <div
              key={env.key}
              className={`font-mono text-sm p-3 ${
                index < mockService.envVars.length - 1 ? 'border-b border-terminal-border' : ''
              }`}
            >
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4 text-terminal-secondary">
                  {env.key}
                  {env.secret && (
                    <span className="ml-2 text-xs text-terminal-red">[SECRET]</span>
                  )}
                </div>
                <div className="col-span-5 text-terminal-primary truncate">
                  {env.secret && !secretsRevealed[env.key]
                    ? maskValue(env.value)
                    : env.value}
                </div>
                <div className="col-span-3 flex gap-2">
                  {env.secret && (
                    <button
                      onClick={() => toggleSecret(env.key)}
                      className="text-terminal-muted hover:text-terminal-primary text-xs"
                    >
                      {secretsRevealed[env.key] ? '[HIDE]' : '[SHOW]'}
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(env.value, env.key)}
                    className="text-terminal-muted hover:text-terminal-primary text-xs"
                  >
                    {copied === env.key ? '[OK]' : '[COPY]'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Webhooks Section */}
      <AsciiSectionDivider
        title="WEBHOOKS"
        collapsed={webhooksCollapsed}
        onToggle={() => setWebhooksCollapsed(!webhooksCollapsed)}
        color="green"
      />

      {!webhooksCollapsed && (
        <div className="mt-4 space-y-3">
          {mockService.webhooks.map((webhook) => (
            <AsciiBox key={webhook.id} title={`${webhook.event.toUpperCase()} HOOK`} variant="green">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-terminal-muted">URL:</span>
                  <span className="font-mono text-sm text-terminal-primary truncate max-w-[300px]">
                    {webhook.url}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-terminal-muted">SECRET:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-terminal-secondary">
                      {secretsRevealed[webhook.id] ? webhook.secret : maskValue(webhook.secret)}
                    </span>
                    <button
                      onClick={() => toggleSecret(webhook.id)}
                      className="text-terminal-muted hover:text-terminal-primary text-xs"
                    >
                      {secretsRevealed[webhook.id] ? '[HIDE]' : '[SHOW]'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-terminal-muted">STATUS:</span>
                  <StatusIndicator
                    status={webhook.enabled ? 'online' : 'offline'}
                    label={webhook.enabled ? 'ENABLED' : 'DISABLED'}
                    size="sm"
                  />
                </div>
              </div>
            </AsciiBox>
          ))}
        </div>
      )}

      {/* Deployment History Section */}
      <AsciiSectionDivider
        title="DEPLOYMENT HISTORY"
        collapsed={historyCollapsed}
        onToggle={() => setHistoryCollapsed(!historyCollapsed)}
        color="amber"
      />

      {!historyCollapsed && (
        <div className="mt-4 border border-terminal-border bg-terminal-bg-secondary">
          {/* Table Header */}
          <div className="font-mono text-xs text-terminal-muted border-b border-terminal-border p-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-1">STS</div>
              <div className="col-span-2">VERSION</div>
              <div className="col-span-5">TIMESTAMP</div>
              <div className="col-span-2">DURATION</div>
              <div className="col-span-2">ACTION</div>
            </div>
          </div>

          {/* Deployment Rows */}
          {mockService.deployments.map((deployment, index) => (
            <div
              key={deployment.id}
              className={`font-mono text-sm p-3 hover:bg-terminal-bg-elevated transition-colors ${
                index < mockService.deployments.length - 1 ? 'border-b border-terminal-border' : ''
              }`}
            >
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-1">
                  <StatusIndicator
                    status={getDeploymentStatus(deployment.status)}
                    showLabel={false}
                    size="sm"
                  />
                </div>
                <div className="col-span-2 text-terminal-primary">
                  {deployment.version}
                </div>
                <div className="col-span-5 text-terminal-muted">
                  {formatDate(deployment.timestamp)}
                </div>
                <div className="col-span-2 text-terminal-secondary">
                  {deployment.duration}
                </div>
                <div className="col-span-2">
                  {index === 0 ? (
                    <span className="text-terminal-primary text-xs">[CURRENT]</span>
                  ) : (
                    <button className="text-terminal-muted hover:text-terminal-secondary text-xs">
                      [ROLLBACK]
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resource Metrics */}
      <AsciiDivider variant="single" color="muted" className="my-6" />

      <AsciiBox title="Resource Metrics" variant="green">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <ProgressGauge value={35} label="CPU USAGE" width={15} />
            <ProgressGauge value={48} label="MEMORY" width={15} />
          </div>
          <div className="space-y-3">
            <ProgressGauge value={12} label="NETWORK IN" width={15} variant="cyan" />
            <ProgressGauge value={8} label="NETWORK OUT" width={15} variant="cyan" />
          </div>
        </div>
      </AsciiBox>
    </div>
  )
}

export default ServiceDetail
