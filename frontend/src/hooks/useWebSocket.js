import { useWebSocketContext } from '../context/WebSocketContext';

/**
 * Base hook for WebSocket functionality
 * Provides access to connection state and subscribe capability.
 */
export function useWebSocket() {
  const { connectionState, subscribe, isConnected, reconnect } = useWebSocketContext();

  return {
    connectionState,
    subscribe,
    isConnected,
    reconnect
  };
}

export default useWebSocket;
