import { useState } from 'react'
import { TerminalSection, TerminalModal } from '../../components/TerminalCard'
import TerminalButton from '../../components/TerminalButton'
import TerminalInput from '../../components/TerminalInput'
import { useToast } from '../../components/Toast'
import { createEnvVar, updateEnvVar, deleteEnvVar, revealEnvVar } from '../../api/envVars'
import { ApiError } from '../../api/utils'
import { useCopyToClipboard } from '../../utils'

export function ServiceEnvironment({ serviceId, envVars, setEnvVars }) {
  const [envCollapsed, setEnvCollapsed] = useState(false)
  const [revealedSecrets, setRevealedSecrets] = useState({})

  const [showAddEnvModal, setShowAddEnvModal] = useState(false)
  const [showEditEnvModal, setShowEditEnvModal] = useState(null)
  const [showDeleteEnvModal, setShowDeleteEnvModal] = useState(null)

  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')
  const [editEnvValue, setEditEnvValue] = useState('')
  const [envSubmitting, setEnvSubmitting] = useState(false)

  const toast = useToast()
  const { copy, copied } = useCopyToClipboard()

  const maskValue = (length = 20) => '*'.repeat(length)

  const handleRevealEnvVar = async (envVar) => {
    if (revealedSecrets[envVar.id]) {
      setRevealedSecrets(prev => {
        const next = { ...prev }
        delete next[envVar.id]
        return next
      })
      return
    }

    try {
      const revealed = await revealEnvVar(serviceId, envVar.id)
      setRevealedSecrets(prev => ({
        ...prev,
        [envVar.id]: revealed.value
      }))
    } catch (err) {
      toast.error('Failed to reveal value')
    }
  }

  const handleAddEnvVar = async (e) => {
    e.preventDefault()
    if (!newEnvKey.trim() || !newEnvValue.trim()) return

    setEnvSubmitting(true)
    try {
      const created = await createEnvVar(serviceId, newEnvKey.trim(), newEnvValue)
      setEnvVars(prev => [...prev, created])
      setNewEnvKey('')
      setNewEnvValue('')
      setShowAddEnvModal(false)
      toast.success(`Environment variable "${newEnvKey}" added`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to add environment variable'
      toast.error(message)
    } finally {
      setEnvSubmitting(false)
    }
  }

  const handleUpdateEnvVar = async (e) => {
    e.preventDefault()
    if (!editEnvValue.trim()) return

    setEnvSubmitting(true)
    try {
      await updateEnvVar(serviceId, showEditEnvModal.id, editEnvValue)
      setRevealedSecrets(prev => {
        const next = { ...prev }
        delete next[showEditEnvModal.id]
        return next
      })
      setEditEnvValue('')
      setShowEditEnvModal(null)
      toast.success(`Environment variable "${showEditEnvModal.key}" updated`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update environment variable'
      toast.error(message)
    } finally {
      setEnvSubmitting(false)
    }
  }

  const handleDeleteEnvVar = async (envVar) => {
    setEnvSubmitting(true)
    try {
      await deleteEnvVar(serviceId, envVar.id)
      setEnvVars(prev => prev.filter(e => e.id !== envVar.id))
      setShowDeleteEnvModal(null)
      toast.success(`Environment variable "${envVar.key}" deleted`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete environment variable'
      toast.error(message)
    } finally {
      setEnvSubmitting(false)
    }
  }

  return (
    <>
      {/* Environment Variables Section */}
      <TerminalSection
        title="Environment Variables"
        collapsed={envCollapsed}
        onToggle={() => setEnvCollapsed(!envCollapsed)}
        color="amber"
        commandFlags={['--show-env', '--masked']}
      />

      {!envCollapsed && (
        <div className="mt-4">
          <div className="flex justify-end mb-3">
            <TerminalButton variant="secondary" onClick={() => setShowAddEnvModal(true)}>
              [ ADD VARIABLE ]
            </TerminalButton>
          </div>

          {envVars.length === 0 ? (
            <div className="text-center py-8 border border-terminal-border bg-terminal-bg-secondary">
              <p className="font-mono text-terminal-muted">No environment variables configured.</p>
            </div>
          ) : (
            <div className="border border-terminal-border bg-terminal-bg-secondary">
              {/* Table Header */}
              <div className="font-mono text-xs text-terminal-muted border-b border-terminal-border p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">KEY</div>
                  <div className="col-span-5">VALUE</div>
                  <div className="col-span-3">ACTIONS</div>
                </div>
              </div>

              {/* Environment Variable Rows */}
              {envVars.map((env, index) => (
                <div
                  key={env.id}
                  className={`font-mono text-sm p-3 ${
                    index < envVars.length - 1 ? 'border-b border-terminal-border' : ''
                  }`}
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4 text-terminal-secondary truncate">
                      {env.key}
                    </div>
                    <div className="col-span-5 text-terminal-primary truncate">
                      {revealedSecrets[env.id] || maskValue()}
                    </div>
                    <div className="col-span-3 flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleRevealEnvVar(env)}
                        className="text-terminal-muted hover:text-terminal-primary text-xs"
                      >
                        {revealedSecrets[env.id] ? '[HIDE]' : '[SHOW]'}
                      </button>
                      {revealedSecrets[env.id] && (
                        <button
                          onClick={() => copy(revealedSecrets[env.id], env.id)}
                          className="text-terminal-muted hover:text-terminal-primary text-xs"
                        >
                          {copied === env.id ? '[OK]' : '[COPY]'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowEditEnvModal(env)
                          setEditEnvValue('')
                        }}
                        className="text-terminal-secondary hover:text-terminal-primary text-xs"
                      >
                        [EDIT]
                      </button>
                      <button
                        onClick={() => setShowDeleteEnvModal(env)}
                        className="text-terminal-red hover:text-terminal-red/80 text-xs"
                      >
                        [DEL]
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Env Var Modal */}
      {showAddEnvModal && (
        <TerminalModal
          title="ADD ENVIRONMENT VARIABLE"
          variant="green"
          onClose={() => {
            setShowAddEnvModal(false)
            setNewEnvKey('')
            setNewEnvValue('')
          }}
        >
          <form onSubmit={handleAddEnvVar}>
            <div className="mb-4">
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                Key
              </label>
              <TerminalInput
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                placeholder="MY_VARIABLE"
                className="w-full"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                Value
              </label>
              <TerminalInput
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder="value"
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-3">
              <TerminalButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowAddEnvModal(false)
                  setNewEnvKey('')
                  setNewEnvValue('')
                }}
                disabled={envSubmitting}
              >
                [ CANCEL ]
              </TerminalButton>
              <TerminalButton
                type="submit"
                variant="primary"
                disabled={envSubmitting || !newEnvKey.trim() || !newEnvValue.trim()}
              >
                {envSubmitting ? '[ ADDING... ]' : '[ ADD ]'}
              </TerminalButton>
            </div>
          </form>
        </TerminalModal>
      )}

      {/* Edit Env Var Modal */}
      {showEditEnvModal && (
        <TerminalModal
          title="EDIT ENVIRONMENT VARIABLE"
          variant="amber"
          onClose={() => {
            setShowEditEnvModal(null)
            setEditEnvValue('')
          }}
        >
          <form onSubmit={handleUpdateEnvVar}>
            <div className="mb-4">
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                Key
              </label>
              <div className="font-mono text-terminal-secondary py-2">
                {showEditEnvModal.key}
              </div>
            </div>
            <div className="mb-6">
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                New Value
              </label>
              <TerminalInput
                value={editEnvValue}
                onChange={(e) => setEditEnvValue(e.target.value)}
                placeholder="new value"
                className="w-full"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <TerminalButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowEditEnvModal(null)
                  setEditEnvValue('')
                }}
                disabled={envSubmitting}
              >
                [ CANCEL ]
              </TerminalButton>
              <TerminalButton
                type="submit"
                variant="primary"
                disabled={envSubmitting || !editEnvValue.trim()}
              >
                {envSubmitting ? '[ UPDATING... ]' : '[ UPDATE ]'}
              </TerminalButton>
            </div>
          </form>
        </TerminalModal>
      )}

      {/* Delete Env Var Modal */}
      {showDeleteEnvModal && (
        <TerminalModal
          title="CONFIRM DELETE"
          variant="red"
          onClose={() => setShowDeleteEnvModal(null)}
        >
          <p className="font-mono text-terminal-primary mb-2">
            Delete environment variable "{showDeleteEnvModal.key}"?
          </p>
          <p className="font-mono text-xs text-terminal-muted mb-6">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <TerminalButton
              variant="secondary"
              onClick={() => setShowDeleteEnvModal(null)}
              disabled={envSubmitting}
            >
              [ CANCEL ]
            </TerminalButton>
            <TerminalButton
              variant="danger"
              onClick={() => handleDeleteEnvVar(showDeleteEnvModal)}
              disabled={envSubmitting}
            >
              {envSubmitting ? '[ DELETING... ]' : '[ DELETE ]'}
            </TerminalButton>
          </div>
        </TerminalModal>
      )}
    </>
  )
}

export default ServiceEnvironment
