import { Component } from 'react'
import TerminalButton from './TerminalButton'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-terminal-primary terminal-grid-bg flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="font-mono whitespace-pre text-terminal-red select-none">
              +-- SYSTEM ERROR ----------------------------+
            </div>
            <div className="border-l border-r border-terminal-red bg-terminal-bg-secondary px-6 py-6">
              <div className="text-center">
                <p className="font-mono text-terminal-red text-xl mb-4">
                  ! FATAL ERROR
                </p>
                <p className="font-mono text-terminal-muted text-sm mb-6">
                  An unexpected error has occurred. The application encountered a critical failure.
                </p>
                {this.state.error && (
                  <div className="bg-terminal-bg-elevated p-4 mb-6 text-left overflow-auto max-h-40">
                    <p className="font-mono text-xs text-terminal-red break-all">
                      {this.state.error.toString()}
                    </p>
                  </div>
                )}
                <div className="flex justify-center gap-3">
                  <TerminalButton variant="secondary" onClick={this.handleReset}>
                    [ TRY AGAIN ]
                  </TerminalButton>
                  <TerminalButton
                    variant="primary"
                    onClick={() => window.location.reload()}
                  >
                    [ RELOAD PAGE ]
                  </TerminalButton>
                </div>
              </div>
            </div>
            <div className="font-mono whitespace-pre text-terminal-red select-none">
              +--------------------------------------------+
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
