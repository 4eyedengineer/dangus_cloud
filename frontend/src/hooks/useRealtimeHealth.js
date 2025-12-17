import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

/**
 * Hook for real-time service health updates
 * Combines initial REST fetch with WebSocket updates.
 *
 * @param {string} serviceId - The service ID to watch
 * @param {function} fetchHealth - Function to fetch initial health via REST
 * @param {number} fallbackInterval - Fallback polling interval if WS disconnected (ms)
 * @returns {object} { health, loading, error, lastUpdate }
 */
export function useRealtimeHealth(serviceId, fetchHealth, fallbackInterval = 30000) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const { connectionState, subscribe, isConnected } = useWebSocket();
  const fallbackIntervalRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    if (!serviceId || !fetchHealth) return;

    let mounted = true;

    const loadHealth = async () => {
      try {
        const data = await fetchHealth(serviceId);
        if (mounted) {
          setHealth(data);
          setError(null);
          setLastUpdate(new Date().toISOString());
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load health status');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadHealth();

    return () => {
      mounted = false;
    };
  }, [serviceId, fetchHealth]);

  // WebSocket subscription
  useEffect(() => {
    if (!serviceId) return;

    const channel = `service:${serviceId}:health`;

    const unsubscribe = subscribe(channel, (event) => {
      const { payload, timestamp } = event;

      // Merge with existing health data
      setHealth(prevHealth => {
        if (!prevHealth) {
          return {
            configured: true,
            status: payload.status,
            activeCheck: {
              status: payload.status,
              statusCode: payload.statusCode,
              responseTimeMs: payload.responseTimeMs,
              error: payload.error
            },
            lastCheck: payload.lastCheck
          };
        }

        return {
          ...prevHealth,
          status: payload.status,
          activeCheck: {
            status: payload.status,
            statusCode: payload.statusCode,
            responseTimeMs: payload.responseTimeMs,
            error: payload.error
          },
          lastCheck: payload.lastCheck
        };
      });

      setLastUpdate(timestamp || new Date().toISOString());
      setError(null);
    });

    return () => {
      unsubscribe();
    };
  }, [serviceId, subscribe]);

  // Manage fallback polling based on connection state
  useEffect(() => {
    if (!serviceId || !fetchHealth) return;

    if (!isConnected() && !fallbackIntervalRef.current) {
      // Start fallback polling
      const loadHealth = async () => {
        try {
          const data = await fetchHealth(serviceId);
          setHealth(data);
          setError(null);
          setLastUpdate(new Date().toISOString());
        } catch (err) {
          setError(err.message || 'Failed to load health status');
        }
      };

      fallbackIntervalRef.current = setInterval(loadHealth, fallbackInterval);
    } else if (isConnected() && fallbackIntervalRef.current) {
      // Stop fallback polling when connected
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }

    return () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [connectionState, serviceId, fetchHealth, fallbackInterval, isConnected]);

  return {
    health,
    loading,
    error,
    lastUpdate,
    isConnected: isConnected(),
    connectionState
  };
}

export default useRealtimeHealth;
