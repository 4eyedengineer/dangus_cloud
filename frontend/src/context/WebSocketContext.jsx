import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import WebSocketManager from '../services/WebSocketManager';

const WebSocketContext = createContext(null);

/**
 * WebSocket Provider Component
 * Provides WebSocket connection management and subscription capabilities to the app.
 */
export function WebSocketProvider({ children }) {
  const [connectionState, setConnectionState] = useState('disconnected');
  const managerRef = useRef(null);

  // Initialize manager on mount
  useEffect(() => {
    managerRef.current = WebSocketManager.getInstance();

    // Add state listener
    const removeListener = managerRef.current.addStateListener(setConnectionState);

    // Connect
    managerRef.current.connect();

    // Cleanup on unmount
    return () => {
      removeListener();
    };
  }, []);

  /**
   * Subscribe to a channel
   * @param {string} channel - Channel to subscribe to
   * @param {function} callback - Callback for events
   * @returns {function} Unsubscribe function
   */
  const subscribe = useCallback((channel, callback) => {
    if (!managerRef.current) return () => {};
    return managerRef.current.subscribe(channel, callback);
  }, []);

  /**
   * Check if connected
   */
  const isConnected = useCallback(() => {
    return connectionState === 'connected';
  }, [connectionState]);

  /**
   * Manually reconnect
   */
  const reconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect();
      managerRef.current.reconnectAttempts = 0;
      managerRef.current.connect();
    }
  }, []);

  const value = {
    connectionState,
    subscribe,
    isConnected,
    reconnect
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to access WebSocket context
 */
export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}

export default WebSocketContext;
