import { EventEmitter } from 'events';
import logger from './logger.js';

/**
 * Internal event pub/sub system for backend service events.
 * This is a singleton that allows different parts of the backend
 * to emit events that the WebSocket hub can broadcast to clients.
 */
class AppEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners to handle many subscribers
    this.setMaxListeners(100);
  }

  /**
   * Emit a deployment status event
   * @param {string} deploymentId - Deployment UUID
   * @param {object} payload - Event payload
   */
  emitDeploymentStatus(deploymentId, payload) {
    const event = {
      channel: `deployment:${deploymentId}:status`,
      timestamp: new Date().toISOString(),
      payload
    };
    logger.debug('Emitting deployment status event', { deploymentId, status: payload.status });
    this.emit('deployment:status', event);
    this.emit(`deployment:${deploymentId}:status`, event);
  }

  /**
   * Emit a service metrics event
   * @param {string} serviceId - Service UUID
   * @param {object} payload - Metrics payload
   */
  emitServiceMetrics(serviceId, payload) {
    const event = {
      channel: `service:${serviceId}:metrics`,
      timestamp: new Date().toISOString(),
      payload
    };
    this.emit('service:metrics', event);
    this.emit(`service:${serviceId}:metrics`, event);
  }

  /**
   * Emit a service health event
   * @param {string} serviceId - Service UUID
   * @param {object} payload - Health payload
   */
  emitServiceHealth(serviceId, payload) {
    const event = {
      channel: `service:${serviceId}:health`,
      timestamp: new Date().toISOString(),
      payload
    };
    logger.debug('Emitting service health event', { serviceId, status: payload.status });
    this.emit('service:health', event);
    this.emit(`service:${serviceId}:health`, event);
  }

  /**
   * Emit a project status event (aggregates all services in project)
   * @param {string} projectId - Project UUID
   * @param {object} payload - Status payload
   */
  emitProjectStatus(projectId, payload) {
    const event = {
      channel: `project:${projectId}:status`,
      timestamp: new Date().toISOString(),
      payload
    };
    this.emit('project:status', event);
    this.emit(`project:${projectId}:status`, event);
  }

  /**
   * Emit a domain certificate status event
   * @param {string} domainId - Domain UUID
   * @param {object} payload - Certificate status payload
   */
  emitDomainCertificate(domainId, payload) {
    const event = {
      channel: `domain:${domainId}:certificate`,
      timestamp: new Date().toISOString(),
      payload
    };
    logger.debug('Emitting domain certificate event', { domainId, status: payload.status });
    this.emit('domain:certificate', event);
    this.emit(`domain:${domainId}:certificate`, event);
  }

  /**
   * Emit a user notification event
   * @param {string} userId - User UUID
   * @param {object} payload - Notification payload
   */
  emitUserNotification(userId, payload) {
    const event = {
      channel: `user:${userId}:notifications`,
      timestamp: new Date().toISOString(),
      payload
    };
    this.emit('user:notifications', event);
    this.emit(`user:${userId}:notifications`, event);
  }
}

// Singleton instance
const appEvents = new AppEventEmitter();

export default appEvents;
export { appEvents };
