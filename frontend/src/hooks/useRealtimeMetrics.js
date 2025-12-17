import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

/**
 * Hook for real-time service metrics updates
 * Combines initial REST fetch with WebSocket updates.
 *
 * @param {string} serviceId - The service ID to watch
 * @param {function} fetchMetrics - Function to fetch initial metrics via REST
 * @param {number} fallbackInterval - Fallback polling interval if WS disconnected (ms)
 * @returns {object} { metrics, loading, error, lastUpdate }
 */
export function useRealtimeMetrics(serviceId, fetchMetrics, fallbackInterval = 10000) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const { connectionState, subscribe, isConnected } = useWebSocket();
  const fallbackIntervalRef = useRef(null);

  // Initial fetch and fallback polling
  useEffect(() => {
    if (!serviceId || !fetchMetrics) return;

    let mounted = true;

    const loadMetrics = async () => {
      try {
        const data = await fetchMetrics(serviceId);
        if (mounted) {
          setMetrics(data);
          setError(null);
          setLastUpdate(new Date().toISOString());
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load metrics');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial load
    loadMetrics();

    // Set up fallback polling if not connected
    const setupFallback = () => {
      if (!isConnected() && !fallbackIntervalRef.current) {
        fallbackIntervalRef.current = setInterval(loadMetrics, fallbackInterval);
      } else if (isConnected() && fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };

    setupFallback();

    return () => {
      mounted = false;
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [serviceId, fetchMetrics, fallbackInterval, isConnected]);

  // WebSocket subscription
  useEffect(() => {
    if (!serviceId) return;

    const channel = `service:${serviceId}:metrics`;

    const unsubscribe = subscribe(channel, (event) => {
      const { payload, timestamp } = event;

      setMetrics(payload);
      setLastUpdate(timestamp || new Date().toISOString());
      setError(null);
    });

    return () => {
      unsubscribe();
    };
  }, [serviceId, subscribe]);

  // Manage fallback polling based on connection state
  useEffect(() => {
    if (!serviceId || !fetchMetrics) return;

    if (!isConnected() && !fallbackIntervalRef.current) {
      // Start fallback polling
      const loadMetrics = async () => {
        try {
          const data = await fetchMetrics(serviceId);
          setMetrics(data);
          setError(null);
          setLastUpdate(new Date().toISOString());
        } catch (err) {
          setError(err.message || 'Failed to load metrics');
        }
      };

      fallbackIntervalRef.current = setInterval(loadMetrics, fallbackInterval);
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
  }, [connectionState, serviceId, fetchMetrics, fallbackInterval, isConnected]);

  return {
    metrics,
    loading,
    error,
    lastUpdate,
    isConnected: isConnected(),
    connectionState
  };
}

export default useRealtimeMetrics;
