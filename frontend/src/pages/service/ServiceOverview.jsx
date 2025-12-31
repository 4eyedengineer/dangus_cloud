import { useState } from 'react'
import { TerminalCard, TerminalSection } from '../../components/TerminalCard'
import { BuildLogViewer } from '../../components/BuildLogViewer'
import { DebugSessionViewer } from '../../components/DebugSessionViewer'
import TerminalButton from '../../components/TerminalButton'

export function ServiceOverview({
  service,
  latestDeployment,
  latestDeploymentId,
  showBuildLogs,
  hasActiveDeployment,
  validation,
  onFixPort,
  fixingPort,
  onDeploy,
  deploying,
  onRefresh,
  // Debug session props
  activeDebugSession,
  onStartDebug,
  startingDebug,
  onDebugRetry,
}) {
  const [buildLogsCollapsed, setBuildLogsCollapsed] = useState(false)
  const [validationCollapsed, setValidationCollapsed] = useState(true)

  return (
    <>
      {/* Port Mismatch Warning Banner */}
      {service.port_mismatch && service.detected_port && (
        <div className="border-2 border-terminal-yellow bg-terminal-yellow/10 p-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-terminal-yellow font-mono text-lg">!</span>
                <span className="font-mono text-sm text-terminal-yellow uppercase tracking-wide">
                  Port Mismatch Detected
                </span>
              </div>
              <p className="font-mono text-sm text-terminal-primary mb-2">
                Dockerfile exposes port <span className="text-terminal-cyan">{service.detected_port}</span> but service is configured for port <span className="text-terminal-cyan">{service.port}</span>.
              </p>
              <p className="font-mono text-xs text-terminal-muted">
                This may cause 502 Bad Gateway errors. Click "Fix Port" to update the service configuration without triggering a rebuild.
              </p>
            </div>
            <TerminalButton
              variant="primary"
              onClick={onFixPort}
              disabled={fixingPort}
            >
              {fixingPort ? '[ FIXING... ]' : `[ FIX PORT -> ${service.detected_port} ]`}
            </TerminalButton>
          </div>
        </div>
      )}

      {/* AI Debug Session - shown when active */}
      {activeDebugSession && (
        <div className="mb-6">
          <DebugSessionViewer
            sessionId={activeDebugSession.id}
            serviceUrl={service.url}
            onRetry={onDebugRetry}
            onComplete={() => onRefresh?.()}
          />
        </div>
      )}

      {/* Build Failed - FIX WITH AI button */}
      {latestDeployment?.status === 'failed' && !activeDebugSession && !hasActiveDeployment && (
        <TerminalCard title="BUILD FAILED" variant="red" className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-sm text-terminal-red mb-2">
                The last build failed. AI can attempt to fix the issue automatically.
              </p>
              <p className="font-mono text-xs text-terminal-muted">
                The AI will analyze build logs, modify Dockerfile and configs, and retry up to 10 times.
              </p>
            </div>
            <TerminalButton
              variant="primary"
              onClick={onStartDebug}
              disabled={startingDebug}
            >
              {startingDebug ? '[ STARTING... ]' : '[ FIX WITH AI ]'}
            </TerminalButton>
          </div>
        </TerminalCard>
      )}

      {/* Build Logs Section - shown when deployment is active or user has toggled it */}
      {(showBuildLogs || hasActiveDeployment) && latestDeploymentId && (
        <>
          <TerminalSection
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
                  onRefresh?.()
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Dockerfile Validation Section */}
      {validation && (
        <>
          <TerminalSection
            title="DOCKERFILE VALIDATION"
            collapsed={validationCollapsed}
            onToggle={() => setValidationCollapsed(!validationCollapsed)}
            color={validation.valid ? (validation.warnings.length > 0 ? 'amber' : 'green') : 'red'}
          />

          {!validationCollapsed && (
            <TerminalCard
              title={`Validation Results - ${validation.dockerfile_path}`}
              variant={validation.valid ? (validation.warnings.length > 0 ? 'amber' : 'green') : 'red'}
              className="mt-4"
            >
              {/* Summary */}
              <div className="flex items-center gap-4 mb-4 pb-3 border-b border-terminal-border">
                <span className={`font-mono text-sm ${validation.valid ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {validation.valid ? '✓ Syntax valid' : '✗ Validation failed'}
                </span>
                {validation.summary.errorCount > 0 && (
                  <span className="font-mono text-xs text-terminal-red">
                    {validation.summary.errorCount} error(s)
                  </span>
                )}
                {validation.summary.warningCount > 0 && (
                  <span className="font-mono text-xs text-terminal-yellow">
                    {validation.summary.warningCount} warning(s)
                  </span>
                )}
                {validation.summary.securityWarnings > 0 && (
                  <span className="font-mono text-xs text-terminal-red">
                    {validation.summary.securityWarnings} security
                  </span>
                )}
              </div>

              {/* Errors */}
              {validation.errors.length > 0 && (
                <div className="mb-4">
                  <div className="font-mono text-xs text-terminal-red uppercase mb-2">Errors</div>
                  <div className="space-y-2">
                    {validation.errors.map((error, idx) => (
                      <div key={idx} className="font-mono text-sm text-terminal-red flex gap-2">
                        <span className="text-terminal-muted">
                          {error.line ? `Line ${error.line}:` : '•'}
                        </span>
                        <span>{error.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div>
                  <div className="font-mono text-xs text-terminal-yellow uppercase mb-2">Warnings</div>
                  <div className="space-y-2">
                    {validation.warnings.map((warning, idx) => (
                      <div key={idx} className="font-mono text-sm flex gap-2">
                        <span className="text-terminal-muted">
                          {warning.line ? `Line ${warning.line}:` : '•'}
                        </span>
                        <span className={warning.severity === 'security' ? 'text-terminal-red' : 'text-terminal-yellow'}>
                          {warning.severity === 'security' && '[SECURITY] '}
                          {warning.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All good message */}
              {validation.valid && validation.errors.length === 0 && validation.warnings.length === 0 && (
                <div className="font-mono text-sm text-terminal-green">
                  No issues found. Dockerfile is ready for deployment.
                </div>
              )}

              {/* Action buttons */}
              {!validation.valid && (
                <div className="mt-4 pt-3 border-t border-terminal-border">
                  <span className="font-mono text-xs text-terminal-muted">
                    Fix errors before deploying. Deployment is blocked until validation passes.
                  </span>
                </div>
              )}
              {validation.valid && validation.warnings.length > 0 && (
                <div className="mt-4 pt-3 border-t border-terminal-border flex items-center justify-between">
                  <span className="font-mono text-xs text-terminal-muted">
                    Warnings found but deployment is allowed.
                  </span>
                  <TerminalButton
                    variant="primary"
                    onClick={onDeploy}
                    disabled={deploying}
                  >
                    {deploying ? '[ DEPLOYING... ]' : '[ DEPLOY ANYWAY ]'}
                  </TerminalButton>
                </div>
              )}
            </TerminalCard>
          )}
        </>
      )}
    </>
  )
}

export default ServiceOverview
