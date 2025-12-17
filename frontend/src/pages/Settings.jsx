import { useState, useEffect } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider, AsciiSectionDivider } from '../components/AsciiDivider'
import { StatusIndicator } from '../components/StatusIndicator'
import TerminalButton from '../components/TerminalButton'
import TerminalInput from '../components/TerminalInput'
import TerminalToggle from '../components/TerminalToggle'
import { useToast } from '../components/Toast'
import { getCurrentUser, logout, getLoginUrl } from '../api/auth'
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  getNotificationHistory
} from '../api/notifications'

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

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    email_enabled: false,
    email_address: '',
    webhook_enabled: false,
    webhook_url: '',
    webhook_secret: null,
    notify_on_success: true,
    notify_on_failure: true,
  })
  const [notificationHistory, setNotificationHistory] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [testingNotifications, setTestingNotifications] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)

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

    // Load notification settings from server
    loadNotificationSettings()
  }, [])

  const loadNotificationSettings = async () => {
    try {
      setLoadingNotifications(true)
      const [settings, history] = await Promise.all([
        getNotificationSettings(),
        getNotificationHistory({ limit: 10 })
      ])
      setNotificationSettings({
        email_enabled: settings.email_enabled || false,
        email_address: settings.email_address || '',
        webhook_enabled: settings.webhook_enabled || false,
        webhook_url: settings.webhook_url || '',
        webhook_secret: settings.webhook_secret || null,
        notify_on_success: settings.notify_on_success ?? true,
        notify_on_failure: settings.notify_on_failure ?? true,
      })
      setNotificationHistory(history.notifications || [])
    } catch (err) {
      // Settings might not exist yet, use defaults
      console.log('Could not load notification settings:', err.message)
    } finally {
      setLoadingNotifications(false)
    }
  }

  const handleSaveNotificationSettings = async () => {
    try {
      setSavingNotifications(true)
      const result = await updateNotificationSettings(notificationSettings)
      setNotificationSettings(prev => ({
        ...prev,
        webhook_secret: result.webhook_secret || prev.webhook_secret,
      }))
      toast.success('Notification settings saved')
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`)
    } finally {
      setSavingNotifications(false)
    }
  }

  const handleTestNotification = async () => {
    try {
      setTestingNotifications(true)
      const result = await sendTestNotification()
      const messages = []
      if (result.results?.webhook) {
        messages.push(result.results.webhook.success
          ? 'Webhook: sent'
          : `Webhook: ${result.results.webhook.error}`)
      }
      if (result.results?.email) {
        messages.push(result.results.email.success
          ? 'Email: sent'
          : `Email: ${result.results.email.error}`)
      }
      if (messages.length > 0) {
        toast.success(messages.join(' | '))
      } else {
        toast.info('No notification channels enabled')
      }
    } catch (err) {
      toast.error(`Test failed: ${err.message}`)
    } finally {
      setTestingNotifications(false)
    }
  }

  const handleRegenerateSecret = async () => {
    try {
      setSavingNotifications(true)
      const result = await updateNotificationSettings({
        ...notificationSettings,
        regenerate_secret: true,
      })
      setNotificationSettings(prev => ({
        ...prev,
        webhook_secret: result.webhook_secret,
      }))
      setShowWebhookSecret(true)
      toast.success('Webhook secret regenerated')
    } catch (err) {
      toast.error(`Failed to regenerate: ${err.message}`)
    } finally {
      setSavingNotifications(false)
    }
  }

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

        <AsciiBox title="Deployment Notifications" variant="green">
          {loadingNotifications ? (
            <p className="font-mono text-xs text-terminal-muted">Loading...</p>
          ) : (
            <div className="space-y-6">
              {/* Email Settings */}
              <div className="space-y-3">
                <TerminalToggle
                  checked={notificationSettings.email_enabled}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    email_enabled: e.target.checked
                  }))}
                  label="Email notifications"
                  id="email-notifications-toggle"
                />
                {notificationSettings.email_enabled && (
                  <div>
                    <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                      Email Address
                    </label>
                    <TerminalInput
                      type="email"
                      value={notificationSettings.email_address}
                      onChange={(e) => setNotificationSettings(prev => ({
                        ...prev,
                        email_address: e.target.value
                      }))}
                      placeholder="your@email.com"
                      className="w-full max-w-xs"
                    />
                  </div>
                )}
              </div>

              {/* Webhook Settings */}
              <div className="space-y-3">
                <TerminalToggle
                  checked={notificationSettings.webhook_enabled}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    webhook_enabled: e.target.checked
                  }))}
                  label="Webhook notifications"
                  id="webhook-notifications-toggle"
                />
                {notificationSettings.webhook_enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
                        Webhook URL
                      </label>
                      <TerminalInput
                        type="url"
                        value={notificationSettings.webhook_url}
                        onChange={(e) => setNotificationSettings(prev => ({
                          ...prev,
                          webhook_url: e.target.value
                        }))}
                        placeholder="https://your-server.com/webhook"
                        className="w-full"
                      />
                    </div>
                    {notificationSettings.webhook_secret && (
                      <div className="p-3 bg-terminal-bg border border-terminal-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs text-terminal-muted uppercase">
                            Webhook Secret
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                              className="font-mono text-xs text-terminal-secondary hover:text-terminal-primary"
                            >
                              [{showWebhookSecret ? 'HIDE' : 'SHOW'}]
                            </button>
                            <button
                              onClick={handleRegenerateSecret}
                              disabled={savingNotifications}
                              className="font-mono text-xs text-terminal-amber hover:text-terminal-primary"
                            >
                              [REGENERATE]
                            </button>
                          </div>
                        </div>
                        <code className="font-mono text-xs text-terminal-green break-all">
                          {showWebhookSecret
                            ? notificationSettings.webhook_secret
                            : '••••••••••••••••••••••••••••••••'}
                        </code>
                        <p className="font-mono text-xs text-terminal-muted mt-2">
                          Use this to verify webhook signatures (X-Dangus-Signature header)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notification Types */}
              <div className="space-y-3 pt-3 border-t border-terminal-border">
                <p className="font-mono text-xs text-terminal-muted uppercase">
                  Notify On
                </p>
                <TerminalToggle
                  checked={notificationSettings.notify_on_success}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    notify_on_success: e.target.checked
                  }))}
                  label="Successful deployments"
                  id="notify-success-toggle"
                />
                <TerminalToggle
                  checked={notificationSettings.notify_on_failure}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    notify_on_failure: e.target.checked
                  }))}
                  label="Failed deployments"
                  id="notify-failure-toggle"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-terminal-border">
                <TerminalButton
                  variant="primary"
                  onClick={handleSaveNotificationSettings}
                  disabled={savingNotifications}
                >
                  {savingNotifications ? '[ SAVING... ]' : '[ SAVE ]'}
                </TerminalButton>
                <TerminalButton
                  variant="secondary"
                  onClick={handleTestNotification}
                  disabled={testingNotifications || (!notificationSettings.email_enabled && !notificationSettings.webhook_enabled)}
                >
                  {testingNotifications ? '[ SENDING... ]' : '[ SEND TEST ]'}
                </TerminalButton>
              </div>
            </div>
          )}
        </AsciiBox>

        {/* Notification History */}
        {notificationHistory.length > 0 && (
          <AsciiBox title="Recent Notifications" variant="amber">
            <div className="space-y-2">
              {notificationHistory.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center justify-between p-2 bg-terminal-bg border border-terminal-border"
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-xs ${
                      notification.status === 'sent' ? 'text-terminal-green' : 'text-terminal-red'
                    }`}>
                      [{notification.status.toUpperCase()}]
                    </span>
                    <span className="font-mono text-xs text-terminal-secondary">
                      {notification.type}
                    </span>
                    <span className="font-mono text-xs text-terminal-muted">
                      {notification.service_name}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-terminal-muted">
                    {formatDate(notification.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </AsciiBox>
        )}
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
