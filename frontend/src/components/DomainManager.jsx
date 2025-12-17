import { useState, useEffect, useRef, useCallback } from 'react'
import { AsciiBox } from './AsciiBox'
import TerminalButton from './TerminalButton'
import TerminalInput from './TerminalInput'
import { useToast } from './Toast'
import { fetchDomains, addDomain, verifyDomain, deleteDomain, getDomain } from '../api/domains'
import { ApiError } from '../api/utils'
import { useWebSocket } from '../hooks/useWebSocket'

export function DomainManager({ serviceId }) {
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)

  const [verifying, setVerifying] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(null)
  const [showVerifyInfo, setShowVerifyInfo] = useState(null)

  const [copied, setCopied] = useState(null)

  const toast = useToast()
  const { connectionState, subscribe, isConnected } = useWebSocket()
  const pollIntervalRef = useRef(null)

  useEffect(() => {
    if (serviceId) {
      loadDomains()
    }
  }, [serviceId])

  // WebSocket subscriptions for domain certificate updates
  useEffect(() => {
    if (!domains.length) return

    const unsubscribes = []

    // Subscribe to certificate updates for each domain
    for (const domain of domains) {
      const channel = `domain:${domain.id}:certificate`

      const unsubscribe = subscribe(channel, (event) => {
        const { payload, timestamp } = event

        setDomains(prev => prev.map(d => {
          if (d.id === domain.id && payload.status !== d.certificate_status) {
            if (payload.status === 'issued') {
              toast.success(`TLS certificate issued for ${d.domain}`)
            }
            return { ...d, certificate_status: payload.status }
          }
          return d
        }))
      })

      unsubscribes.push(unsubscribe)
    }

    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [domains, subscribe, toast])

  // Fallback polling for certificate status updates when WebSocket is not connected
  useEffect(() => {
    const pendingDomains = domains.filter(d => d.verified && d.certificate_status === 'pending')
    if (pendingDomains.length === 0 || isConnected()) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    // Only use polling as fallback when WebSocket is not connected
    if (!pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(async () => {
        for (const domain of pendingDomains) {
          try {
            const updated = await getDomain(serviceId, domain.id)
            if (updated.certificate_status !== domain.certificate_status) {
              setDomains(prev => prev.map(d =>
                d.id === domain.id ? { ...d, certificate_status: updated.certificate_status } : d
              ))
              if (updated.certificate_status === 'issued') {
                toast.success(`TLS certificate issued for ${domain.domain}`)
              }
            }
          } catch (err) {
            console.error('Failed to check certificate status:', err)
          }
        }
      }, 10000) // Poll every 10 seconds as fallback
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [domains, serviceId, connectionState, isConnected, toast])

  const loadDomains = async () => {
    setLoading(true)
    try {
      const data = await fetchDomains(serviceId)
      setDomains(data)
    } catch (err) {
      toast.error('Failed to load domains')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
      toast.success('Copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newDomain.trim()) return

    setAddSubmitting(true)
    try {
      const result = await addDomain(serviceId, newDomain.trim())
      setDomains(prev => [result, ...prev])
      setNewDomain('')
      setShowAddModal(false)
      setShowVerifyInfo(result.id)
      toast.success(`Domain "${newDomain}" added. Configure DNS to verify.`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to add domain'
      toast.error(message)
    } finally {
      setAddSubmitting(false)
    }
  }

  const handleVerify = async (domain) => {
    setVerifying(domain.id)
    try {
      const result = await verifyDomain(serviceId, domain.id)
      setDomains(prev => prev.map(d =>
        d.id === domain.id
          ? { ...d, verified: result.verified, tls_enabled: result.tls_enabled, certificate_status: result.certificate_status }
          : d
      ))
      toast.success(result.message || 'Domain verified!')
      setShowVerifyInfo(null)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Verification failed'
      toast.error(message)
    } finally {
      setVerifying(null)
    }
  }

  const handleDelete = async (domain) => {
    setDeleting(domain.id)
    try {
      await deleteDomain(serviceId, domain.id)
      setDomains(prev => prev.filter(d => d.id !== domain.id))
      setShowDeleteModal(null)
      toast.success(`Domain "${domain.domain}" removed`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete domain'
      toast.error(message)
    } finally {
      setDeleting(null)
    }
  }

  const getCertStatusBadge = (domain) => {
    if (!domain.verified) {
      return <span className="text-terminal-warning">PENDING VERIFICATION</span>
    }
    if (domain.certificate_status === 'issued') {
      return <span className="text-terminal-success">TLS ACTIVE</span>
    }
    if (domain.certificate_status === 'pending') {
      return <span className="text-terminal-info">TLS PENDING</span>
    }
    if (domain.certificate_status === 'failed') {
      return <span className="text-terminal-error">TLS FAILED</span>
    }
    return null
  }

  return (
    <AsciiBox
      title="CUSTOM DOMAINS"
      collapsible
      collapsed={collapsed}
      onToggle={() => setCollapsed(!collapsed)}
    >
      {loading ? (
        <div className="text-terminal-muted">Loading domains...</div>
      ) : (
        <>
          <div className="mb-4">
            <TerminalButton onClick={() => setShowAddModal(true)}>
              [+] ADD DOMAIN
            </TerminalButton>
          </div>

          {domains.length === 0 ? (
            <div className="text-terminal-muted text-sm">
              No custom domains configured. Add a domain to enable custom URLs with TLS.
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map(domain => (
                <div
                  key={domain.id}
                  className="border border-terminal-border p-3 rounded"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-mono text-terminal-primary font-bold">
                        {domain.domain}
                      </div>
                      <div className="text-sm mt-1">
                        {domain.verified ? (
                          <span className="text-terminal-success mr-3">VERIFIED</span>
                        ) : (
                          <span className="text-terminal-warning mr-3">UNVERIFIED</span>
                        )}
                        {getCertStatusBadge(domain)}
                      </div>
                    </div>
                    <TerminalButton
                      variant="danger"
                      size="sm"
                      onClick={() => setShowDeleteModal(domain)}
                    >
                      [DELETE]
                    </TerminalButton>
                  </div>

                  {!domain.verified && (
                    <div className="mt-3 p-2 bg-terminal-surface rounded text-sm">
                      <div className="text-terminal-muted mb-2">
                        Add this CNAME record to your DNS:
                      </div>
                      <div className="font-mono flex items-center gap-2">
                        <span className="text-terminal-text">{domain.domain}</span>
                        <span className="text-terminal-muted">-&gt;</span>
                        <span className="text-terminal-accent">
                          {domain.verification_target || 'Loading...'}
                        </span>
                        {domain.verification_target && (
                          <button
                            onClick={() => handleCopy(domain.verification_target, `target-${domain.id}`)}
                            className="text-terminal-muted hover:text-terminal-text text-xs ml-2"
                          >
                            {copied === `target-${domain.id}` ? '[COPIED]' : '[COPY]'}
                          </button>
                        )}
                      </div>
                      <div className="mt-3">
                        <TerminalButton
                          size="sm"
                          onClick={() => handleVerify(domain)}
                          disabled={verifying === domain.id}
                        >
                          {verifying === domain.id ? 'VERIFYING...' : '[VERIFY NOW]'}
                        </TerminalButton>
                      </div>
                    </div>
                  )}

                  {domain.verified && domain.certificate_status === 'issued' && (
                    <div className="mt-2 text-sm text-terminal-muted">
                      <span className="mr-2">URL:</span>
                      <a
                        href={`https://${domain.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-terminal-link hover:underline"
                      >
                        https://{domain.domain}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-terminal-bg/80 flex items-center justify-center z-50">
          <div className="bg-terminal-surface border border-terminal-border p-6 rounded max-w-md w-full mx-4">
            <h3 className="text-terminal-primary font-bold mb-4">Add Custom Domain</h3>
            <form onSubmit={handleAdd}>
              <div className="mb-4">
                <label className="block text-terminal-muted text-sm mb-1">Domain</label>
                <TerminalInput
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="api.example.com"
                  autoFocus
                />
                <p className="text-terminal-muted text-xs mt-1">
                  Enter the full domain name (e.g., api.example.com)
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <TerminalButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAddModal(false)
                    setNewDomain('')
                  }}
                >
                  [CANCEL]
                </TerminalButton>
                <TerminalButton
                  type="submit"
                  disabled={!newDomain.trim() || addSubmitting}
                >
                  {addSubmitting ? 'ADDING...' : '[ADD]'}
                </TerminalButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-terminal-bg/80 flex items-center justify-center z-50">
          <div className="bg-terminal-surface border border-terminal-border p-6 rounded max-w-md w-full mx-4">
            <h3 className="text-terminal-primary font-bold mb-4">Delete Domain</h3>
            <p className="text-terminal-text mb-4">
              Are you sure you want to delete <span className="font-mono text-terminal-accent">{showDeleteModal.domain}</span>?
              {showDeleteModal.verified && ' This will also remove the TLS certificate.'}
            </p>
            <div className="flex gap-2 justify-end">
              <TerminalButton
                variant="secondary"
                onClick={() => setShowDeleteModal(null)}
              >
                [CANCEL]
              </TerminalButton>
              <TerminalButton
                variant="danger"
                onClick={() => handleDelete(showDeleteModal)}
                disabled={deleting === showDeleteModal.id}
              >
                {deleting === showDeleteModal.id ? 'DELETING...' : '[DELETE]'}
              </TerminalButton>
            </div>
          </div>
        </div>
      )}
    </AsciiBox>
  )
}
