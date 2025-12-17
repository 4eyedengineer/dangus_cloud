import logger from './logger.js';

/**
 * WebSocket connection and subscription manager.
 * Handles connection registry, subscription management, and message broadcasting.
 */
class WebSocketManager {
  constructor() {
    // Map of userId -> Set of WebSocket connections
    this.connections = new Map();
    // Map of channel -> Set of { socket, userId }
    this.subscriptions = new Map();
    // Map of socket -> { userId, channels: Set }
    this.socketMeta = new Map();
  }

  /**
   * Register a new WebSocket connection
   * @param {WebSocket} socket - The WebSocket connection
   * @param {string} userId - The authenticated user ID
   */
  addConnection(socket, userId) {
    // Add to connections map
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(socket);

    // Store socket metadata
    this.socketMeta.set(socket, {
      userId,
      channels: new Set(),
      connectedAt: new Date()
    });

    logger.info('WebSocket connection added', { userId, totalConnections: this.getTotalConnections() });
  }

  /**
   * Remove a WebSocket connection and clean up subscriptions
   * @param {WebSocket} socket - The WebSocket connection
   */
  removeConnection(socket) {
    const meta = this.socketMeta.get(socket);
    if (!meta) return;

    const { userId, channels } = meta;

    // Remove from all subscribed channels
    for (const channel of channels) {
      this.unsubscribe(socket, channel, false);
    }

    // Remove from connections map
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(socket);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }

    // Remove socket metadata
    this.socketMeta.delete(socket);

    logger.info('WebSocket connection removed', { userId, totalConnections: this.getTotalConnections() });
  }

  /**
   * Subscribe a socket to a channel
   * @param {WebSocket} socket - The WebSocket connection
   * @param {string} channel - The channel to subscribe to
   * @returns {boolean} Whether subscription was successful
   */
  subscribe(socket, channel) {
    const meta = this.socketMeta.get(socket);
    if (!meta) return false;

    // Add to subscriptions map
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel).add({ socket, userId: meta.userId });

    // Track in socket metadata
    meta.channels.add(channel);

    logger.debug('Socket subscribed to channel', { userId: meta.userId, channel });
    return true;
  }

  /**
   * Unsubscribe a socket from a channel
   * @param {WebSocket} socket - The WebSocket connection
   * @param {string} channel - The channel to unsubscribe from
   * @param {boolean} updateMeta - Whether to update socket metadata
   * @returns {boolean} Whether unsubscription was successful
   */
  unsubscribe(socket, channel, updateMeta = true) {
    const channelSubs = this.subscriptions.get(channel);
    if (!channelSubs) return false;

    // Find and remove the subscription
    for (const sub of channelSubs) {
      if (sub.socket === socket) {
        channelSubs.delete(sub);
        break;
      }
    }

    // Clean up empty channel
    if (channelSubs.size === 0) {
      this.subscriptions.delete(channel);
    }

    // Update socket metadata if requested
    if (updateMeta) {
      const meta = this.socketMeta.get(socket);
      if (meta) {
        meta.channels.delete(channel);
      }
    }

    return true;
  }

  /**
   * Broadcast a message to all subscribers of a channel
   * @param {string} channel - The channel to broadcast to
   * @param {object} message - The message to send
   */
  broadcast(channel, message) {
    const channelSubs = this.subscriptions.get(channel);
    if (!channelSubs || channelSubs.size === 0) return;

    const messageStr = JSON.stringify({
      type: 'event',
      channel,
      ...message
    });

    let sentCount = 0;
    for (const { socket } of channelSubs) {
      try {
        if (socket.readyState === 1) { // WebSocket.OPEN
          socket.send(messageStr);
          sentCount++;
        }
      } catch (err) {
        logger.error('Failed to send WebSocket message', { channel, error: err.message });
      }
    }

    logger.debug('Broadcast message to channel', { channel, subscribers: sentCount });
  }

  /**
   * Broadcast a message to all connections for a specific user
   * @param {string} userId - The user ID
   * @param {object} message - The message to send
   */
  broadcastToUser(userId, message) {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    const messageStr = JSON.stringify(message);

    for (const socket of userConnections) {
      try {
        if (socket.readyState === 1) { // WebSocket.OPEN
          socket.send(messageStr);
        }
      } catch (err) {
        logger.error('Failed to send WebSocket message to user', { userId, error: err.message });
      }
    }
  }

  /**
   * Send a message to a specific socket
   * @param {WebSocket} socket - The WebSocket connection
   * @param {object} message - The message to send
   */
  send(socket, message) {
    try {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(JSON.stringify(message));
      }
    } catch (err) {
      logger.error('Failed to send WebSocket message', { error: err.message });
    }
  }

  /**
   * Get the user ID for a socket
   * @param {WebSocket} socket - The WebSocket connection
   * @returns {string|null} The user ID or null
   */
  getUserId(socket) {
    const meta = this.socketMeta.get(socket);
    return meta?.userId || null;
  }

  /**
   * Get the channels a socket is subscribed to
   * @param {WebSocket} socket - The WebSocket connection
   * @returns {Set} Set of channel names
   */
  getSocketChannels(socket) {
    const meta = this.socketMeta.get(socket);
    return meta?.channels || new Set();
  }

  /**
   * Get the total number of active connections
   * @returns {number} Total connection count
   */
  getTotalConnections() {
    let count = 0;
    for (const connections of this.connections.values()) {
      count += connections.size;
    }
    return count;
  }

  /**
   * Get the number of subscribers for a channel
   * @param {string} channel - The channel name
   * @returns {number} Subscriber count
   */
  getChannelSubscriberCount(channel) {
    const channelSubs = this.subscriptions.get(channel);
    return channelSubs?.size || 0;
  }

  /**
   * Get statistics about current connections
   * @returns {object} Connection statistics
   */
  getStats() {
    const channelStats = {};
    for (const [channel, subs] of this.subscriptions.entries()) {
      channelStats[channel] = subs.size;
    }

    return {
      totalConnections: this.getTotalConnections(),
      uniqueUsers: this.connections.size,
      channels: channelStats,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce((sum, s) => sum + s.size, 0)
    };
  }
}

// Singleton instance
const wsManager = new WebSocketManager();

export default wsManager;
export { wsManager, WebSocketManager };
