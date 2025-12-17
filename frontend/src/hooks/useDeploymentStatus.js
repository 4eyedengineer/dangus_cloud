import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

/**
 * Hook for real-time deployment status updates
 * Provides live deployment status with automatic WebSocket subscription.
 *
 * @param {string} deploymentId - The deployment ID to watch
 * @param {object} initialStatus - Initial deployment status
 * @returns {object} { status, message, imageTag, lastUpdate }
 */
export function useDeploymentStatus(deploymentId, initialStatus = null) {
  const [status, setStatus] = useState(initialStatus?.status || null);
  const [message, setMessage] = useState(initialStatus?.message || null);
  const [imageTag, setImageTag] = useState(initialStatus?.image_tag || null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const { connectionState, subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!deploymentId) return;

    const channel = `deployment:${deploymentId}:status`;

    // Subscribe to deployment status updates
    const unsubscribe = subscribe(channel, (event) => {
      const { payload, timestamp } = event;

      if (payload.status) {
        setStatus(payload.status);
      }
      if (payload.message) {
        setMessage(payload.message);
      }
      if (payload.imageTag) {
        setImageTag(payload.imageTag);
      }
      setLastUpdate(timestamp || new Date().toISOString());
    });

    return () => {
      unsubscribe();
    };
  }, [deploymentId, subscribe]);

  /**
   * Check if deployment is in an active state (not terminal)
   */
  const isActive = useCallback(() => {
    return ['pending', 'building', 'deploying'].includes(status);
  }, [status]);

  /**
   * Check if deployment completed successfully
   */
  const isComplete = useCallback(() => {
    return status === 'live';
  }, [status]);

  /**
   * Check if deployment failed
   */
  const isFailed = useCallback(() => {
    return status === 'failed';
  }, [status]);

  return {
    status,
    message,
    imageTag,
    lastUpdate,
    isActive,
    isComplete,
    isFailed,
    isConnected: isConnected(),
    connectionState
  };
}

export default useDeploymentStatus;
