import { useState } from 'react'
import { TerminalCard, TerminalSection } from '../../components/TerminalCard'
import { ResourceMetrics } from '../../components/ResourceMetrics'
import { HealthStatus } from '../../components/HealthStatus'
import { DomainManager } from '../../components/DomainManager'
import { fetchServiceMetrics, fetchServiceHealth, fetchWebhookSecret } from '../../api/services'
import { useCopyToClipboard } from '../../utils'

export function ServiceConfig({ service, serviceId }) {
  const [configCollapsed, setConfigCollapsed] = useState(false)
  const [resourcesCollapsed, setResourcesCollapsed] = useState(false)
  const [healthCollapsed, setHealthCollapsed] = useState(false)
  const [webhooksCollapsed, setWebhooksCollapsed] = useState(false)
  const [domainsCollapsed, setDomainsCollapsed] = useState(false)

  const [webhookSecret, setWebhookSecret] = useState(null)
  const [webhookRevealed, setWebhookRevealed] = useState(false)

  const { copy, copied } = useCopyToClipboard()

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
      console.error('Failed to reveal webhook secret:', err)
    }
  }

  const maskValue = (length = 20) => '*'.repeat(length)

  return (
    <>
      {/* Configuration Section */}
      <TerminalSection
        title="Configuration"
        collapsed={configCollapsed}
        onToggle={() => setConfigCollapsed(!configCollapsed)}
        color="cyan"
        commandFlags={['--show-config', '--format=table']}
      />

      {!configCollapsed && (
        <TerminalCard title="Service Config" variant="cyan" className="mt-4">
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
        </TerminalCard>
      )}

      {/* Resource Usage Section */}
      <TerminalSection
        title="Resource Usage"
        collapsed={resourcesCollapsed}
        onToggle={() => setResourcesCollapsed(!resourcesCollapsed)}
        color="cyan"
        commandFlags={['--show-metrics', '--refresh=5s']}
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

      {/* Health Status Section */}
      {service.health_check_path && (
        <>
          <TerminalSection
            title="HEALTH STATUS"
            collapsed={healthCollapsed}
            onToggle={() => setHealthCollapsed(!healthCollapsed)}
            color="green"
          />

          {!healthCollapsed && (
            <div className="mt-4">
              <HealthStatus
                serviceId={serviceId}
                fetchHealth={fetchServiceHealth}
                refreshInterval={30000}
              />
            </div>
          )}
        </>
      )}

      {/* Webhooks Section */}
      <TerminalSection
        title="WEBHOOK"
        collapsed={webhooksCollapsed}
        onToggle={() => setWebhooksCollapsed(!webhooksCollapsed)}
        color="green"
      />

      {!webhooksCollapsed && (
        <TerminalCard title="GitHub Webhook" variant="green" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs text-terminal-muted">WEBHOOK URL:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-terminal-primary truncate max-w-[300px]">
                  {service.webhook_url}
                </span>
                <button
                  onClick={() => copy(service.webhook_url, 'webhook_url')}
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
                    onClick={() => copy(webhookSecret.webhook_secret, 'webhook_secret')}
                    className="text-terminal-muted hover:text-terminal-primary text-xs"
                  >
                    {copied === 'webhook_secret' ? '[OK]' : '[COPY]'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </TerminalCard>
      )}

      {/* Custom Domains Section */}
      <TerminalSection
        title="CUSTOM DOMAINS"
        collapsed={domainsCollapsed}
        onToggle={() => setDomainsCollapsed(!domainsCollapsed)}
        color="cyan"
      />

      {!domainsCollapsed && (
        <div className="mt-4">
          <DomainManager serviceId={serviceId} />
        </div>
      )}
    </>
  )
}

export default ServiceConfig
