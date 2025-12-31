import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

/**
 * Hook for real-time debug session status updates.
 * Provides live debug session state with automatic WebSocket subscription.
 *
 * @param {string} sessionId - The debug session ID to watch
 * @param {object} initialSession - Initial session state
 * @returns {object} Session state and helper functions
 */
export function useDebugSession(sessionId, initialSession = null) {
  const [status, setStatus] = useState(initialSession?.status || null);
  const [currentAttempt, setCurrentAttempt] = useState(initialSession?.currentAttempt || 0);
  const [maxAttempts, setMaxAttempts] = useState(initialSession?.maxAttempts || 10);
  const [explanation, setExplanation] = useState(null);
  const [fileChanges, setFileChanges] = useState(initialSession?.fileChanges || []);
  const [finalExplanation, setFinalExplanation] = useState(initialSession?.finalExplanation || null);
  const [message, setMessage] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [totalTokens, setTotalTokens] = useState(initialSession?.totalTokens || 0);
  const [estimatedCost, setEstimatedCost] = useState(initialSession?.estimatedCost || '0.0000');
  const [suggestedActions, setSuggestedActions] = useState(initialSession?.suggestedActions || []);

  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!sessionId) return;

    const channel = `debug:${sessionId}:status`;

    const unsubscribe = subscribe(channel, (event) => {
      const { payload, timestamp } = event;

      if (payload.status) {
        setStatus(payload.status);
      }
      if (payload.attempt !== undefined) {
        setCurrentAttempt(payload.attempt);
      }
      if (payload.maxAttempts !== undefined) {
        setMaxAttempts(payload.maxAttempts);
      }
      if (payload.explanation) {
        setExplanation(payload.explanation);
      }
      if (payload.fileChanges) {
        setFileChanges(payload.fileChanges);
      }
      if (payload.finalExplanation) {
        setFinalExplanation(payload.finalExplanation);
      }
      if (payload.message) {
        setMessage(payload.message);
      }
      if (payload.totalTokens !== undefined) {
        setTotalTokens(payload.totalTokens);
      }
      if (payload.estimatedCost !== undefined) {
        setEstimatedCost(payload.estimatedCost);
      }
      setLastUpdate(timestamp || new Date().toISOString());
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId, subscribe]);

  /**
   * Check if debug session is running
   */
  const isRunning = useCallback(() => {
    return status === 'running' || status === 'analyzing' || status === 'building';
  }, [status]);

  /**
   * Check if debug session succeeded
   */
  const isSucceeded = useCallback(() => {
    return status === 'succeeded';
  }, [status]);

  /**
   * Check if debug session failed after max attempts
   */
  const isFailed = useCallback(() => {
    return status === 'failed';
  }, [status]);

  /**
   * Check if debug session was cancelled
   */
  const isCancelled = useCallback(() => {
    return status === 'cancelled';
  }, [status]);

  /**
   * Check if session needs manual intervention
   */
  const needsManualFix = useCallback(() => {
    return status === 'needs_manual_fix';
  }, [status]);

  /**
   * Check if session is in a terminal state
   */
  const isComplete = useCallback(() => {
    return ['succeeded', 'failed', 'cancelled', 'error'].includes(status);
  }, [status]);

  /**
   * Get progress percentage (0-100)
   */
  const getProgress = useCallback(() => {
    if (!maxAttempts) return 0;
    return Math.round((currentAttempt / maxAttempts) * 100);
  }, [currentAttempt, maxAttempts]);

  return {
    // State
    status,
    currentAttempt,
    maxAttempts,
    explanation,
    fileChanges,
    finalExplanation,
    message,
    lastUpdate,
    totalTokens,
    estimatedCost,
    suggestedActions,

    // Helpers
    isRunning,
    isSucceeded,
    isFailed,
    isCancelled,
    needsManualFix,
    isComplete,
    getProgress,
    isConnected: isConnected(),
  };
}

export default useDebugSession;
