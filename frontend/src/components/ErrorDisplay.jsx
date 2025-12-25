import TerminalButton from './TerminalButton'
import { ApiError } from '../api/utils'

/**
 * Consistent error display component with retry and back actions
 */
export function ErrorDisplay({
  error,
  onRetry,
  onBack,
  retryLabel = '[ RETRY ]',
  backLabel = '[ BACK ]',
  title = 'Error',
  className = ''
}) {
  // Extract error message
  const getMessage = () => {
    if (!error) return 'An unexpected error occurred'
    if (typeof error === 'string') return error
    if (error instanceof ApiError) {
      if (error.isNetworkError) {
        return 'Network error - check your connection'
      }
      return error.message
    }
    if (error instanceof Error) return error.message
    return 'An unexpected error occurred'
  }

  // Get error type for styling
  const getErrorType = () => {
    if (!error) return 'unknown'
    if (error instanceof ApiError) {
      if (error.isNetworkError) return 'network'
      if (error.isServerError) return 'server'
      if (error.isNotFound) return 'not-found'
      if (error.isUnauthorized) return 'auth'
      if (error.isValidationError) return 'validation'
    }
    return 'unknown'
  }

  const errorType = getErrorType()
  const message = getMessage()

  // Error type specific icons and hints
  const typeConfig = {
    network: {
      icon: '⚡',
      hint: 'Check your internet connection and try again.'
    },
    server: {
      icon: '!',
      hint: 'The server encountered an error. Try again later.'
    },
    'not-found': {
      icon: '?',
      hint: 'The requested resource could not be found.'
    },
    auth: {
      icon: '🔒',
      hint: 'Your session may have expired. Try logging in again.'
    },
    validation: {
      icon: '✗',
      hint: 'Please check your input and try again.'
    },
    unknown: {
      icon: '!',
      hint: null
    }
  }

  const config = typeConfig[errorType] || typeConfig.unknown

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      {/* Error icon */}
      <div className="font-mono text-4xl text-terminal-red mb-4">
        [{config.icon}]
      </div>

      {/* Title */}
      <h2 className="font-mono text-lg text-terminal-red uppercase tracking-wide mb-2">
        {title}
      </h2>

      {/* Message */}
      <p className="font-mono text-sm text-terminal-primary text-center max-w-md mb-2">
        {message}
      </p>

      {/* Hint */}
      {config.hint && (
        <p className="font-mono text-xs text-terminal-muted text-center max-w-md mb-6">
          {config.hint}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        {onBack && (
          <TerminalButton variant="secondary" onClick={onBack}>
            {backLabel}
          </TerminalButton>
        )}
        {onRetry && (
          <TerminalButton variant="primary" onClick={onRetry}>
            {retryLabel}
          </TerminalButton>
        )}
      </div>
    </div>
  )
}

/**
 * Inline error message for partial failures
 */
export function InlineError({ message, onRetry, className = '' }) {
  return (
    <div className={`flex items-center gap-3 p-3 border border-terminal-red/50 bg-terminal-red/10 ${className}`}>
      <span className="font-mono text-terminal-red">[!]</span>
      <span className="font-mono text-sm text-terminal-primary flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="font-mono text-xs text-terminal-red hover:text-terminal-primary transition-colors"
        >
          [RETRY]
        </button>
      )}
    </div>
  )
}

/**
 * Empty state component with optional action
 */
export function EmptyState({
  icon = '📦',
  title,
  description,
  action,
  className = ''
}) {
  return (
    <div className={`text-center py-12 border border-terminal-border bg-terminal-bg-secondary ${className}`}>
      <div className="font-mono text-3xl mb-4">{icon}</div>
      <p className="font-mono text-terminal-primary mb-2">{title}</p>
      {description && (
        <p className="font-mono text-xs text-terminal-muted mb-4">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export default ErrorDisplay
