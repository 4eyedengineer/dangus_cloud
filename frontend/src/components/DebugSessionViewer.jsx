import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { TerminalCard, TerminalSection } from './TerminalCard';
import { TerminalProgress } from './TerminalProgress';
import TerminalButton from './TerminalButton';
import { SimpleDiffViewer } from './DiffViewer';
import { useDebugSession } from '../hooks/useDebugSession';
import {
  fetchDebugSession,
  fetchDebugAttempts,
  cancelDebugSession,
  retryDebugSession,
} from '../api/debug';

/**
 * DebugSessionViewer - Displays AI debug session progress and results
 *
 * States:
 * 1. FIXING - Shows attempt N/10, explanation, progress bar, CANCEL button
 * 2. FIXED & DEPLOYED - Shows diff viewer, VIEW SERVICE + COPY CHANGES buttons
 * 3. COULD NOT AUTO-FIX - Shows explanation, TRY AGAIN + VIEW ATTEMPTS buttons
 */
export function DebugSessionViewer({
  sessionId,
  serviceUrl = null,
  onComplete = () => {},
  onRetry = () => {},
  className = '',
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [showAttempts, setShowAttempts] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // WebSocket hook for real-time updates
  const session = useDebugSession(sessionId);

  // Fetch initial session data
  useEffect(() => {
    if (!sessionId) return;

    async function loadSession() {
      try {
        setLoading(true);
        await fetchDebugSession(sessionId);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    loadSession();
  }, [sessionId]);

  // Fetch attempts when session completes
  useEffect(() => {
    if (session.isComplete() && sessionId) {
      fetchDebugAttempts(sessionId)
        .then(data => setAttempts(data.attempts || []))
        .catch(() => {});
    }
  }, [session.status, sessionId]);

  // Handle cancel
  const handleCancel = async () => {
    try {
      setCancelling(true);
      await cancelDebugSession(sessionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  // Handle retry
  const handleRetry = async () => {
    try {
      setRetrying(true);
      const result = await retryDebugSession(sessionId);
      onRetry(result.sessionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(false);
    }
  };

  // Copy changes to clipboard
  const handleCopyChanges = async () => {
    if (!session.fileChanges || session.fileChanges.length === 0) return;

    const text = session.fileChanges.map(file =>
      `=== ${file.path} ===\n${file.content}`
    ).join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <TerminalCard title="AI DEBUG" variant="cyan" className={className}>
        <div className="text-terminal-muted font-mono text-sm">
          Loading debug session...
        </div>
      </TerminalCard>
    );
  }

  if (error) {
    return (
      <TerminalCard title="DEBUG ERROR" variant="red" className={className}>
        <div className="text-terminal-red font-mono text-sm">
          {error}
        </div>
      </TerminalCard>
    );
  }

  // RUNNING STATE
  if (session.isRunning()) {
    return (
      <TerminalCard title="FIXING" variant="cyan" glow className={className}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-terminal-cyan font-mono text-sm uppercase">
              Attempt {session.currentAttempt}/{session.maxAttempts}
            </span>
            <TerminalProgress
              value={session.currentAttempt}
              max={session.maxAttempts}
              variant="cyan"
              width={12}
            />
          </div>

          {session.explanation && (
            <TerminalSection
              title="AI ANALYSIS"
              variant="cyan"
              defaultCollapsed={false}
            >
              <pre className="text-terminal-muted text-xs whitespace-pre-wrap">
                {session.explanation}
              </pre>
            </TerminalSection>
          )}

          {session.message && (
            <div className="text-terminal-muted font-mono text-xs">
              {session.message}
            </div>
          )}

          <div className="flex justify-center pt-2">
            <TerminalButton
              variant="danger"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? '[ CANCELLING... ]' : '[ CANCEL ]'}
            </TerminalButton>
          </div>
        </div>
      </TerminalCard>
    );
  }

  // SUCCESS STATE
  if (session.isSucceeded()) {
    return (
      <TerminalCard title="FIXED & DEPLOYED" variant="green" glow className={className}>
        <div className="space-y-4">
          <div className="text-terminal-primary font-mono text-sm">
            Fixed in {session.currentAttempt} attempt{session.currentAttempt !== 1 ? 's' : ''}.
          </div>

          {session.explanation && (
            <TerminalSection
              title="CHANGES MADE"
              variant="green"
              defaultCollapsed={false}
            >
              <pre className="text-terminal-muted text-xs whitespace-pre-wrap mb-4">
                {session.explanation}
              </pre>
              {session.fileChanges && session.fileChanges.length > 0 && (
                <SimpleDiffViewer fileChanges={session.fileChanges} />
              )}
            </TerminalSection>
          )}

          <div className="flex justify-center gap-4 pt-2">
            {serviceUrl && (
              <TerminalButton
                variant="primary"
                onClick={() => window.open(serviceUrl, '_blank')}
              >
                [ VIEW SERVICE ]
              </TerminalButton>
            )}
            <TerminalButton
              variant="secondary"
              onClick={handleCopyChanges}
            >
              {copySuccess ? '[ COPIED! ]' : '[ COPY CHANGES ]'}
            </TerminalButton>
          </div>
        </div>
      </TerminalCard>
    );
  }

  // FAILED STATE
  if (session.isFailed()) {
    return (
      <TerminalCard title="COULD NOT AUTO-FIX" variant="red" className={className}>
        <div className="space-y-4">
          <div className="text-terminal-red font-mono text-sm">
            After {session.maxAttempts} attempts, automatic repair was unsuccessful.
          </div>

          {session.finalExplanation && (
            <TerminalSection
              title="ANALYSIS"
              variant="red"
              defaultCollapsed={false}
            >
              <pre className="text-terminal-muted text-xs whitespace-pre-wrap">
                {session.finalExplanation}
              </pre>
            </TerminalSection>
          )}

          {showAttempts && attempts.length > 0 && (
            <TerminalSection
              title="ALL ATTEMPTS"
              variant="amber"
              defaultCollapsed={false}
            >
              <div className="space-y-3">
                {attempts.map((attempt, idx) => (
                  <div key={idx} className="border border-terminal-border p-2">
                    <div className="text-terminal-secondary font-mono text-xs mb-1">
                      Attempt {attempt.attemptNumber}
                    </div>
                    <pre className="text-terminal-muted text-xs whitespace-pre-wrap">
                      {attempt.explanation}
                    </pre>
                  </div>
                ))}
              </div>
            </TerminalSection>
          )}

          <div className="flex justify-center gap-4 pt-2">
            <TerminalButton
              variant="primary"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? '[ STARTING... ]' : '[ TRY AGAIN ]'}
            </TerminalButton>
            <TerminalButton
              variant="secondary"
              onClick={() => setShowAttempts(!showAttempts)}
            >
              {showAttempts ? '[ HIDE ATTEMPTS ]' : '[ VIEW ALL ATTEMPTS ]'}
            </TerminalButton>
          </div>
        </div>
      </TerminalCard>
    );
  }

  // CANCELLED STATE
  if (session.isCancelled()) {
    return (
      <TerminalCard title="DEBUG CANCELLED" variant="amber" className={className}>
        <div className="space-y-4">
          <div className="text-terminal-secondary font-mono text-sm">
            Debug session was cancelled after {session.currentAttempt} attempt{session.currentAttempt !== 1 ? 's' : ''}.
          </div>
          <div className="flex justify-center pt-2">
            <TerminalButton
              variant="primary"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? '[ STARTING... ]' : '[ TRY AGAIN ]'}
            </TerminalButton>
          </div>
        </div>
      </TerminalCard>
    );
  }

  // Default/Unknown state
  return (
    <TerminalCard title="DEBUG SESSION" variant="default" className={className}>
      <div className="text-terminal-muted font-mono text-sm">
        Status: {session.status || 'unknown'}
      </div>
    </TerminalCard>
  );
}

DebugSessionViewer.propTypes = {
  sessionId: PropTypes.string.isRequired,
  serviceUrl: PropTypes.string,
  onComplete: PropTypes.func,
  onRetry: PropTypes.func,
  className: PropTypes.string,
};

export default DebugSessionViewer;
