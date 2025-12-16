import { useState, useEffect } from 'react'
import { AsciiLogo } from '../components/AsciiLogo'
import TerminalButton from '../components/TerminalButton'
import { TerminalTypewriter } from '../components/TerminalTypewriter'

export function Login({ onLogin }) {
  const [isInitializing, setIsInitializing] = useState(true)
  const [messages, setMessages] = useState([])

  const initMessages = [
    '> Initializing authentication module...',
    '> Establishing secure connection...',
    '> Loading credential handlers...',
    '> System ready.'
  ]

  useEffect(() => {
    let messageIndex = 0
    const interval = setInterval(() => {
      if (messageIndex < initMessages.length) {
        setMessages(prev => [...prev, initMessages[messageIndex]])
        messageIndex++
      } else {
        setIsInitializing(false)
        clearInterval(interval)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const handleGitHubLogin = () => {
    if (onLogin) {
      onLogin()
    }
  }

  return (
    <div className="min-h-screen bg-terminal-primary terminal-grid-bg flex flex-col items-center justify-center p-4">
      {/* ASCII Logo */}
      <div className="mb-8">
        <AsciiLogo
          variant="full"
          showBorder={true}
          showCloud={true}
          glowColor="green"
        />
      </div>

      {/* System Messages Box */}
      <div className="w-full max-w-lg mb-8">
        <div className="border border-terminal-border bg-terminal-bg-secondary p-4">
          <div className="font-mono text-sm space-y-1">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`${
                  msg?.includes('ready')
                    ? 'text-terminal-primary text-glow-green'
                    : 'text-terminal-muted'
                }`}
              >
                {msg}
              </div>
            ))}
            {isInitializing && (
              <div className="text-terminal-cyan animate-pulse">
                <span className="inline-block w-2 h-4 bg-terminal-primary animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Login Panel */}
      <div className="w-full max-w-lg">
        <div className="font-mono whitespace-pre text-terminal-muted select-none">
          ┌─ AUTHENTICATION ─────────────────────────┐
        </div>

        <div className="border-l border-r border-terminal-muted px-4 py-6">
          <div className="text-center space-y-6">
            <p className="text-terminal-secondary font-mono text-sm">
              ACCESS RESTRICTED - AUTHORIZED USERS ONLY
            </p>

            <div className="flex justify-center">
              <TerminalButton
                variant="primary"
                onClick={handleGitHubLogin}
                disabled={isInitializing}
                className="px-8"
              >
                [ SIGN IN WITH GITHUB ]
              </TerminalButton>
            </div>

            <div className="text-terminal-muted font-mono text-xs space-y-1">
              <p>┌──────────────────────────────────────┐</p>
              <p>│  Authentication via GitHub OAuth 2.0 │</p>
              <p>│  All sessions are encrypted (TLS 1.3) │</p>
              <p>└──────────────────────────────────────┘</p>
            </div>
          </div>
        </div>

        <div className="font-mono whitespace-pre text-terminal-muted select-none">
          └──────────────────────────────────────────┘
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 font-mono text-xs text-terminal-muted text-center">
        <p>DANGUS CLOUD v1.0</p>
        <p className="mt-1">[ SECURE TERMINAL INTERFACE ]</p>
      </div>
    </div>
  )
}

export default Login
