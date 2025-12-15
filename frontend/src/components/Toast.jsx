import { useState, useEffect, useCallback, createContext, useContext } from 'react'

// Toast Context for global toast management
const ToastContext = createContext(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, duration }])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((message, duration) => addToast(message, 'success', duration), [addToast])
  const error = useCallback((message, duration) => addToast(message, 'error', duration), [addToast])
  const warning = useCallback((message, duration) => addToast(message, 'warning', duration), [addToast])
  const info = useCallback((message, duration) => addToast(message, 'info', duration), [addToast])

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div
      className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => onRemove(toast.id)}
        />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(onDismiss, 200)
      }, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration, onDismiss])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(onDismiss, 200)
  }

  const typeConfig = {
    success: {
      icon: '✓',
      borderColor: 'border-terminal-primary',
      textColor: 'text-terminal-primary',
      glowColor: 'shadow-[var(--glow-green)]',
      label: 'SUCCESS'
    },
    error: {
      icon: '✗',
      borderColor: 'border-terminal-red',
      textColor: 'text-terminal-red',
      glowColor: 'shadow-[var(--glow-red)]',
      label: 'ERROR'
    },
    warning: {
      icon: '!',
      borderColor: 'border-terminal-secondary',
      textColor: 'text-terminal-secondary',
      glowColor: 'shadow-[var(--glow-amber)]',
      label: 'WARNING'
    },
    info: {
      icon: 'i',
      borderColor: 'border-terminal-cyan',
      textColor: 'text-terminal-cyan',
      glowColor: 'shadow-[var(--glow-cyan)]',
      label: 'INFO'
    }
  }

  const config = typeConfig[toast.type] || typeConfig.info

  return (
    <div
      className={`
        bg-terminal-bg-secondary border ${config.borderColor} ${config.glowColor}
        transform transition-all duration-200
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Top border with type label */}
      <div className={`font-mono text-xs ${config.textColor} border-b ${config.borderColor} px-3 py-1`}>
        <span className="select-none" aria-hidden="true">┌─</span>
        <span className="mx-1">{config.label}</span>
        <span className="select-none" aria-hidden="true">─</span>
      </div>

      {/* Content */}
      <div className="px-3 py-3 flex items-start gap-3">
        {/* Icon */}
        <span
          className={`font-mono text-lg ${config.textColor} flex-shrink-0`}
          aria-hidden="true"
        >
          [{config.icon}]
        </span>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-terminal-primary">
            {toast.message}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="font-mono text-terminal-muted hover:text-terminal-primary transition-colors flex-shrink-0"
          aria-label="Dismiss notification"
        >
          [×]
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {toast.duration > 0 && (
        <div className="h-0.5 bg-terminal-border overflow-hidden">
          <div
            className={`h-full ${config.textColor.replace('text-', 'bg-')}`}
            style={{
              animation: `shrink ${toast.duration}ms linear forwards`
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}

// Standalone Toast Component for direct use
export function StandaloneToast({
  message,
  type = 'info',
  onDismiss,
  duration = 5000
}) {
  return (
    <Toast
      toast={{ id: 'standalone', message, type, duration }}
      onDismiss={onDismiss}
    />
  )
}

export default ToastProvider
