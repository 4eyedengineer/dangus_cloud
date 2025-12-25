import { useState } from 'react'
import { TerminalSection, TerminalModal } from '../../components/TerminalCard'
import { StatusIndicator } from '../../components/StatusIndicator'
import TerminalButton from '../../components/TerminalButton'
import { useToast } from '../../components/Toast'
import { rollbackService } from '../../api/services'
import { ApiError } from '../../api/utils'
import { formatDate, getStatusText, getStatusIndicator } from '../../utils'

export function ServiceHistory({
  serviceId,
  deployments,
  hasActiveDeployment,
  onDeploy,
  deploying,
  onRefresh
}) {
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [showRollbackModal, setShowRollbackModal] = useState(null)
  const [rollingBack, setRollingBack] = useState(false)

  const toast = useToast()

  // Find the latest live deployment for rollback comparison
  const latestLiveDeployment = deployments.find(d => d.status === 'live')

  const isRollbackCandidate = (deployment) => {
    return deployment.status === 'live' &&
           deployment.image_tag &&
           deployment.id !== latestLiveDeployment?.id
  }

  const handleRollback = async (deployment) => {
    setRollingBack(true)
    try {
      await rollbackService(serviceId, deployment.id)
      toast.success('Rollback initiated')
      setShowRollbackModal(null)
      onRefresh?.()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to rollback'
      toast.error(message)
    } finally {
      setRollingBack(false)
    }
  }

  return (
    <>
      {/* Deployment History Section */}
      <TerminalSection
        title="DEPLOYMENT HISTORY"
        collapsed={historyCollapsed}
        onToggle={() => setHistoryCollapsed(!historyCollapsed)}
        color="amber"
      />

      {!historyCollapsed && (
        <div className="mt-4">
          {deployments.length === 0 ? (
            <div className="text-center py-8 border border-terminal-border bg-terminal-bg-secondary">
              <p className="font-mono text-terminal-muted mb-4">No deployments yet.</p>
              <TerminalButton variant="primary" onClick={onDeploy} disabled={deploying}>
                {deploying ? '[ DEPLOYING... ]' : '[ TRIGGER FIRST DEPLOY ]'}
              </TerminalButton>
            </div>
          ) : (
            <div className="border border-terminal-border bg-terminal-bg-secondary">
              {/* Table Header */}
              <div className="font-mono text-xs text-terminal-muted border-b border-terminal-border p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-1">STS</div>
                  <div className="col-span-2">COMMIT</div>
                  <div className="col-span-4">TIMESTAMP</div>
                  <div className="col-span-5">STATUS</div>
                </div>
              </div>

              {/* Deployment Rows */}
              {deployments.map((deployment, index) => (
                <div
                  key={deployment.id}
                  className={`font-mono text-sm p-3 hover:bg-terminal-bg-elevated transition-colors ${
                    index < deployments.length - 1 ? 'border-b border-terminal-border' : ''
                  }`}
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1">
                      {deployment.rollback_to ? (
                        <span className="text-terminal-cyan" title="Rollback deployment">↩</span>
                      ) : (
                        <StatusIndicator
                          status={getStatusIndicator(deployment.status)}
                          showLabel={false}
                          size="sm"
                        />
                      )}
                    </div>
                    <div className="col-span-2 text-terminal-primary truncate">
                      {deployment.commit_sha?.substring(0, 7) || 'N/A'}
                    </div>
                    <div className="col-span-4 text-terminal-muted">
                      {formatDate(deployment.created_at)}
                    </div>
                    <div className="col-span-5 flex items-center gap-2">
                      {index === 0 && deployment.status === 'live' ? (
                        <span className="text-terminal-primary text-xs">[CURRENT]</span>
                      ) : deployment.rollback_to ? (
                        <span className="text-terminal-cyan text-xs">ROLLBACK</span>
                      ) : (
                        <span className="text-terminal-muted text-xs">{getStatusText(deployment.status)}</span>
                      )}
                      {isRollbackCandidate(deployment) && (
                        <button
                          onClick={() => setShowRollbackModal(deployment)}
                          className="text-terminal-cyan hover:text-terminal-primary text-xs ml-auto"
                          disabled={rollingBack || hasActiveDeployment}
                        >
                          [ROLLBACK]
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackModal && (
        <TerminalModal
          title="CONFIRM ROLLBACK"
          variant="cyan"
          onClose={() => setShowRollbackModal(null)}
        >
          <p className="font-mono text-terminal-primary mb-2">
            Rollback to deployment {showRollbackModal.commit_sha?.substring(0, 7)}?
          </p>
          <p className="font-mono text-xs text-terminal-muted mb-2">
            This will redeploy the image from this deployment without rebuilding.
          </p>
          <p className="font-mono text-xs text-terminal-muted mb-6">
            Deployed: {formatDate(showRollbackModal.created_at)}
          </p>
          <div className="flex justify-end gap-3">
            <TerminalButton
              variant="secondary"
              onClick={() => setShowRollbackModal(null)}
              disabled={rollingBack}
            >
              [ CANCEL ]
            </TerminalButton>
            <TerminalButton
              variant="primary"
              onClick={() => handleRollback(showRollbackModal)}
              disabled={rollingBack}
            >
              {rollingBack ? '[ ROLLING BACK... ]' : '[ ROLLBACK ]'}
            </TerminalButton>
          </div>
        </TerminalModal>
      )}
    </>
  )
}

export default ServiceHistory
