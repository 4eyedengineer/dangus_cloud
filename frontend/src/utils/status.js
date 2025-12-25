/**
 * Map of status values to display text
 */
const STATUS_TEXT_MAP = {
  online: 'RUNNING',
  offline: 'STOPPED',
  warning: 'DEGRADED',
  error: 'FAILED',
  pending: 'PENDING',
  success: 'SUCCESS',
  failed: 'FAILED',
  live: 'LIVE',
  building: 'BUILDING',
  deploying: 'DEPLOYING',
  starting: 'STARTING',
  stopping: 'STOPPING',
  idle: 'IDLE',
  unknown: 'UNKNOWN'
}

/**
 * Get display text for a status value
 * @param {string} status - The status value
 * @returns {string} Display text
 */
export function getStatusText(status) {
  if (!status) return 'UNKNOWN'
  return STATUS_TEXT_MAP[status.toLowerCase()] || status.toUpperCase()
}

/**
 * Map deployment status to indicator status
 * @param {string} deploymentStatus - Deployment status from API
 * @returns {'online' | 'offline' | 'pending' | 'error' | 'warning' | 'idle'}
 */
export function getStatusIndicator(deploymentStatus) {
  if (!deploymentStatus) return 'idle'

  switch (deploymentStatus.toLowerCase()) {
    case 'live':
    case 'success':
    case 'running':
    case 'online':
      return 'online'
    case 'failed':
    case 'error':
      return 'error'
    case 'warning':
    case 'degraded':
      return 'warning'
    case 'pending':
    case 'building':
    case 'deploying':
    case 'starting':
      return 'pending'
    case 'stopped':
    case 'offline':
      return 'offline'
    default:
      return 'idle'
  }
}

/**
 * Get CSS color class for a status
 * @param {string} status - Status value
 * @returns {string} Tailwind text color class
 */
export function getStatusColor(status) {
  const indicator = getStatusIndicator(status)
  switch (indicator) {
    case 'online': return 'text-terminal-green'
    case 'error': return 'text-terminal-red'
    case 'warning': return 'text-terminal-yellow'
    case 'pending': return 'text-terminal-cyan'
    case 'offline': return 'text-terminal-muted'
    default: return 'text-terminal-muted'
  }
}

/**
 * Check if a status represents an active/in-progress state
 * @param {string} status
 * @returns {boolean}
 */
export function isActiveStatus(status) {
  if (!status) return false
  return ['pending', 'building', 'deploying', 'starting'].includes(status.toLowerCase())
}

/**
 * Check if a status represents a healthy state
 * @param {string} status
 * @returns {boolean}
 */
export function isHealthyStatus(status) {
  if (!status) return false
  return ['live', 'success', 'running', 'online'].includes(status.toLowerCase())
}

/**
 * Check if a status represents an error state
 * @param {string} status
 * @returns {boolean}
 */
export function isErrorStatus(status) {
  if (!status) return false
  return ['failed', 'error'].includes(status.toLowerCase())
}
