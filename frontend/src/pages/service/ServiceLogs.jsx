import { useState } from 'react'
import { TerminalSection } from '../../components/TerminalCard'
import { BuildLogViewer } from '../../components/BuildLogViewer'
import { LogViewer } from '../../components/LogViewer'

export function ServiceLogs({ serviceId, latestDeploymentId, onRefresh }) {
  const [containerLogsCollapsed, setContainerLogsCollapsed] = useState(false)
  const [buildLogsCollapsed, setBuildLogsCollapsed] = useState(false)

  return (
    <>
      {/* Container Logs Section */}
      <TerminalSection
        title="CONTAINER LOGS"
        collapsed={containerLogsCollapsed}
        onToggle={() => setContainerLogsCollapsed(!containerLogsCollapsed)}
        color="cyan"
      />

      {!containerLogsCollapsed && (
        <div className="mt-4">
          <LogViewer
            serviceId={serviceId}
            enabled={!containerLogsCollapsed}
          />
        </div>
      )}

      {/* Build Logs Section */}
      {latestDeploymentId && (
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
    </>
  )
}

export default ServiceLogs
