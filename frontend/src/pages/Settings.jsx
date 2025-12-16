import { useState, useEffect } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider, AsciiSectionDivider } from '../components/AsciiDivider'
import { StatusIndicator } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'
import TerminalInput from '../components/TerminalInput'
import TerminalToggle from '../components/TerminalToggle'
import { useToast } from '../components/Toast'
import { getCurrentUser, logout, getLoginUrl } from '../api/auth'

const PREFERENCES_KEY = 'dangus_cloud_preferences'

const defaultPreferences = {
  defaultBranch: 'main',
  defaultDockerfilePath: 'Dockerfile',
  notifications: true,
}

export function Settings({ user, onLogout }) {
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    // Load preferences from localStorage
    const stored = localStorage.getItem(PREFERENCES_KEY)
    if (stored) {
      try {
        setPreferences({ ...defaultPreferences, ...JSON.parse(stored) })
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }
  }, [])

  const savePreferences = (newPrefs) => {
    setPreferences(newPrefs)
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPrefs))
    toast.success('Preferences saved')
  }

  const handlePreferenceChange = (key, value) => {
    const newPrefs = { ...preferences, [key]: value }
    savePreferences(newPrefs)
  }

  const handleReauthenticate = () => {
    window.location.href = getLoginUrl()
  }

  const handleLogoutAll = async () => {
    try {
      await logout()
      toast.success('Logged out from all devices')
      setShowLogoutAllModal(false)
      onLogout?.()
    } catch (err) {
      toast.error('Failed to logout')
    }
  }

  const handleExportData = async () => {
    try {
      const userData = await getCurrentUser()
      const exportData = {
        user: userData,
        preferences,
        exportedAt: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dangus-cloud-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Data exported successfully')
    } catch (err) {
      toast.error('Failed to export data')
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm')
      return
    }

    // Note: Backend endpoint for account deletion would need to be implemented
    toast.info('Account deletion is not yet implemented')
    setShowDeleteModal(false)
    setDeleteConfirmText('')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toISOString().replace('T', ' ').substring(0, 19)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-mono text-xl text-terminal-primary text-glow-green uppercase tracking-terminal-wide">
          SETTINGS
        </h1>
        <p className="font-mono text-sm text-terminal-muted mt-1">
          Manage your account and preferences
        </p>
      </div>

      <AsciiDivider variant="double" color="green" />

      {/* Account Section */}
      <AsciiSectionDivider title="ACCOUNT" color="amber" />

      <div className="mt-4 space-y-4">
        <AsciiBox title="GitHub Connection" variant="green">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs text-terminal-muted">STATUS: </span>
                <StatusIndicator status="online" label="CONNECTED" size="sm" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-terminal-muted">USERNAME:</span>
                <span className="font-mono text-sm text-terminal-primary">{user?.github_username || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-terminal-muted">USER ID:</span>
                <span className="font-mono text-sm text-terminal-secondary">{user?.hash || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-terminal-muted">MEMBER SINCE:</span>
                <span className="font-mono text-sm text-terminal-secondary">{formatDate(user?.created_at)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-terminal-border">
              <TerminalButton variant="secondary" onClick={handleReauthenticate}>
                [ RE-AUTHENTICATE ]
              </TerminalButton>
            </div>
          </div>
        </AsciiBox>

        <AsciiBox title="Session Management" variant="amber">
          <div className="space-y-3">
            <p className="font-mono text-xs text-terminal-muted">
              Logout from all devices and sessions.
            </p>
            <TerminalButton variant="secondary" onClick={() => setShowLogoutAllModal(true)}>
              [ LOGOUT ALL DEVICES ]
            </TerminalButton>
          </div>
        </AsciiBox>
      </div>

      <AsciiDivider variant="single" color="muted" className="my-6" />

      {/* Preferences Section */}
      <AsciiSectionDivider title="PREFERENCES" color="amber" />

      <div className="mt-4 space-y-4">
        <AsciiBox title="Default Settings" variant="green">
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                Default Branch Name
              </label>
              <TerminalInput
                value={preferences.defaultBranch}
                onChange={(e) => handlePreferenceChange('defaultBranch', e.target.value)}
                placeholder="main"
                className="w-full max-w-xs"
              />
              <p className="font-mono text-xs text-terminal-muted mt-1">
                Used when creating new services
              </p>
            </div>

            <div>
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                Default Dockerfile Path
              </label>
              <TerminalInput
                value={preferences.defaultDockerfilePath}
                onChange={(e) => handlePreferenceChange('defaultDockerfilePath', e.target.value)}
                placeholder="Dockerfile"
                className="w-full max-w-xs"
              />
              <p className="font-mono text-xs text-terminal-muted mt-1">
                Path to Dockerfile in repository
              </p>
            </div>
          </div>
        </AsciiBox>

        <AsciiBox title="Notifications" variant="green">
          <div className="space-y-3">
            <TerminalToggle
              checked={preferences.notifications}
              onChange={(e) => handlePreferenceChange('notifications', e.target.checked)}
              label="Enable deployment notifications"
              id="notifications-toggle"
            />
            <p className="font-mono text-xs text-terminal-muted">
              Receive in-app notifications for deployment events
            </p>
          </div>
        </AsciiBox>
      </div>

      <AsciiDivider variant="single" color="muted" className="my-6" />

      {/* Danger Zone */}
      <AsciiSectionDivider title="DANGER ZONE" color="red" />

      <div className="mt-4">
        <div className="border border-terminal-red p-4 bg-terminal-bg-secondary">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-terminal-primary">Export All Data</p>
                <p className="font-mono text-xs text-terminal-muted">
                  Download all your data as JSON
                </p>
              </div>
              <TerminalButton variant="secondary" onClick={handleExportData}>
                [ EXPORT ]
              </TerminalButton>
            </div>

            <div className="border-t border-terminal-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-terminal-red">Delete Account</p>
                  <p className="font-mono text-xs text-terminal-muted">
                    Permanently delete your account and all data
                  </p>
                </div>
                <TerminalButton variant="danger" onClick={() => setShowDeleteModal(true)}>
                  [ DELETE ACCOUNT ]
                </TerminalButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logout All Modal */}
      {showLogoutAllModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <div className="font-mono whitespace-pre text-terminal-amber select-none">
              +-- LOGOUT ALL DEVICES ---------------------+
            </div>
            <div className="border-l border-r border-terminal-amber bg-terminal-bg-secondary px-6 py-6">
              <p className="font-mono text-terminal-primary mb-2">
                Logout from all devices?
              </p>
              <p className="font-mono text-xs text-terminal-muted mb-6">
                This will end all active sessions including this one.
              </p>
              <div className="flex justify-end gap-3">
                <TerminalButton
                  variant="secondary"
                  onClick={() => setShowLogoutAllModal(false)}
                >
                  [ CANCEL ]
                </TerminalButton>
                <TerminalButton
                  variant="primary"
                  onClick={handleLogoutAll}
                >
                  [ CONFIRM ]
                </TerminalButton>
              </div>
            </div>
            <div className="font-mono whitespace-pre text-terminal-amber select-none">
              +--------------------------------------------+
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <div className="font-mono whitespace-pre text-terminal-red select-none">
              +-- DELETE ACCOUNT -------------------------+
            </div>
            <div className="border-l border-r border-terminal-red bg-terminal-bg-secondary px-6 py-6">
              <p className="font-mono text-terminal-red mb-2">
                ! WARNING: This action cannot be undone
              </p>
              <p className="font-mono text-xs text-terminal-muted mb-4">
                All your projects, services, and data will be permanently deleted.
              </p>
              <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                Type DELETE to confirm
              </label>
              <TerminalInput
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full mb-4"
              />
              <div className="flex justify-end gap-3">
                <TerminalButton
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteConfirmText('')
                  }}
                >
                  [ CANCEL ]
                </TerminalButton>
                <TerminalButton
                  variant="danger"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE'}
                >
                  [ DELETE FOREVER ]
                </TerminalButton>
              </div>
            </div>
            <div className="font-mono whitespace-pre text-terminal-red select-none">
              +--------------------------------------------+
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
