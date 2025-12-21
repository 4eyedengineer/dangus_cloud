/**
 * Metrics Collector Service
 *
 * Background service that periodically collects Kubernetes metrics and pod status
 * and streams them to connected WebSocket clients.
 */

import { getPodMetrics, getPodsByLabel, getDeployment, listDeployments } from './kubernetes.js';
import appEvents from './event-emitter.js';
import logger from './logger.js';

const METRICS_INTERVAL = 15000; // 15 seconds
const POD_STATUS_INTERVAL = 10000; // 10 seconds

// Track active service subscriptions
const activeServices = new Map(); // serviceId -> { namespace, serviceName, projectId }

// Track last known pod states for change detection
const podStates = new Map(); // serviceId -> { pods: Map<podName, state> }

/**
 * Parse raw CPU value (e.g., "250m" or "1") to millicores
 */
function parseCpuValue(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value * 1000;
  const str = String(value);
  if (str.endsWith('n')) return parseInt(str) / 1000000;
  if (str.endsWith('u')) return parseInt(str) / 1000;
  if (str.endsWith('m')) return parseInt(str);
  return parseFloat(str) * 1000;
}

/**
 * Parse raw memory value (e.g., "128Mi", "1Gi") to bytes
 */
function parseMemoryValue(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const str = String(value);
  const units = {
    'Ki': 1024,
    'Mi': 1024 * 1024,
    'Gi': 1024 * 1024 * 1024,
    'Ti': 1024 * 1024 * 1024 * 1024,
    'K': 1000,
    'M': 1000000,
    'G': 1000000000,
  };
  for (const [unit, multiplier] of Object.entries(units)) {
    if (str.endsWith(unit)) {
      return parseInt(str.slice(0, -unit.length)) * multiplier;
    }
  }
  return parseInt(str);
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}Ki`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}Mi`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}Gi`;
}

/**
 * Collect metrics for a single service
 */
async function collectServiceMetrics(serviceId, namespace, serviceName) {
  try {
    // Get pod metrics from metrics-server
    let metrics = null;
    try {
      metrics = await getPodMetrics(namespace, `app=${serviceName}`);
    } catch (err) {
      // Metrics server may not be available
      if (err.status !== 404) {
        logger.debug(`Metrics unavailable for ${serviceName}`, { error: err.message });
      }
    }

    // Get pod details for status info
    const podsResponse = await getPodsByLabel(namespace, `app=${serviceName}`);
    const pods = podsResponse.items || [];

    // Get deployment for replica info
    let deployment = null;
    try {
      deployment = await getDeployment(namespace, serviceName);
    } catch (err) {
      if (err.status !== 404) {
        logger.debug(`Deployment not found for ${serviceName}`, { error: err.message });
      }
    }

    // Get resource limits from deployment
    const container = deployment?.spec?.template?.spec?.containers?.[0];
    const limits = container?.resources?.limits || {};
    const cpuLimit = parseCpuValue(limits.cpu);
    const memoryLimit = parseMemoryValue(limits.memory);

    // Build pod metrics payload (matching REST API format)
    const podMetrics = pods.map(pod => {
      const podName = pod.metadata.name;
      const containerStatuses = pod.status?.containerStatuses || [];
      const mainContainer = containerStatuses[0] || {};

      // Get metrics for this pod if available
      const podMetric = metrics?.items?.find(m => m.metadata.name === podName);
      const containerMetric = podMetric?.containers?.[0] || {};

      // Parse restart count and status
      const restartCount = mainContainer.restartCount || 0;
      const ready = mainContainer.ready || false;
      const phase = pod.status?.phase || 'Unknown';
      const started = mainContainer.started || false;

      // Parse resource usage
      const cpuUsage = parseCpuValue(containerMetric.usage?.cpu);
      const memoryUsage = parseMemoryValue(containerMetric.usage?.memory);

      return {
        name: podName,
        phase,
        ready,
        started,
        restartCount,
        cpu: {
          usage: containerMetric.usage?.cpu || '0',
          usageMillicores: cpuUsage,
          limitMillicores: cpuLimit || null,
          percentUsed: cpuLimit > 0 ? Math.round((cpuUsage / cpuLimit) * 100) : null
        },
        memory: {
          usage: containerMetric.usage?.memory || '0',
          usageBytes: memoryUsage,
          limitBytes: memoryLimit || null,
          percentUsed: memoryLimit > 0 ? Math.round((memoryUsage / memoryLimit) * 100) : null
        },
        startTime: pod.status?.startTime,
        nodeName: pod.spec?.nodeName
      };
    });

    // Calculate aggregated metrics
    const totalCpu = podMetrics.reduce((sum, p) => sum + p.cpu.usageMillicores, 0);
    const totalMemory = podMetrics.reduce((sum, p) => sum + p.memory.usageBytes, 0);
    const totalRestarts = podMetrics.reduce((sum, p) => sum + p.restartCount, 0);
    const readyPods = podMetrics.filter(p => p.ready).length;
    const totalPods = podMetrics.length;

    // Build payload matching REST API format exactly
    const payload = {
      timestamp: new Date().toISOString(),
      pods: podMetrics,
      aggregated: {
        totalCpuMillicores: totalCpu,
        totalMemoryBytes: totalMemory,
        podCount: totalPods,
        // Extended fields for pod status
        restarts: totalRestarts,
        ready: readyPods,
        replicas: {
          desired: deployment?.spec?.replicas || 0,
          current: deployment?.status?.replicas || 0,
          ready: deployment?.status?.readyReplicas || 0,
          available: deployment?.status?.availableReplicas || 0
        }
      },
      limits: cpuLimit > 0 || memoryLimit > 0 ? {
        cpuMillicores: cpuLimit || null,
        memoryBytes: memoryLimit || null
      } : null,
      available: podMetrics.length > 0
    };

    // Emit metrics event
    appEvents.emitServiceMetrics(serviceId, payload);

    return payload;
  } catch (err) {
    logger.error(`Failed to collect metrics for service ${serviceId}`, {
      namespace,
      serviceName,
      error: err.message
    });
    return null;
  }
}

/**
 * Check for pod status changes and emit events
 */
async function checkPodStatusChanges(serviceId, namespace, serviceName) {
  try {
    const podsResponse = await getPodsByLabel(namespace, `app=${serviceName}`);
    const pods = podsResponse.items || [];

    // Get previous state
    const previousState = podStates.get(serviceId) || { pods: new Map() };
    const currentState = { pods: new Map() };

    let hasChanges = false;
    const changes = [];

    for (const pod of pods) {
      const podName = pod.metadata.name;
      const containerStatuses = pod.status?.containerStatuses || [];
      const mainContainer = containerStatuses[0] || {};

      const currentPodState = {
        phase: pod.status?.phase || 'Unknown',
        ready: mainContainer.ready || false,
        restartCount: mainContainer.restartCount || 0,
        started: mainContainer.started || false
      };

      currentState.pods.set(podName, currentPodState);

      const previousPodState = previousState.pods.get(podName);
      if (previousPodState) {
        // Check for changes
        if (previousPodState.phase !== currentPodState.phase) {
          changes.push({
            type: 'phase_change',
            pod: podName,
            from: previousPodState.phase,
            to: currentPodState.phase
          });
          hasChanges = true;
        }
        if (previousPodState.restartCount !== currentPodState.restartCount) {
          changes.push({
            type: 'restart',
            pod: podName,
            count: currentPodState.restartCount,
            delta: currentPodState.restartCount - previousPodState.restartCount
          });
          hasChanges = true;
        }
        if (previousPodState.ready !== currentPodState.ready) {
          changes.push({
            type: 'ready_change',
            pod: podName,
            ready: currentPodState.ready
          });
          hasChanges = true;
        }
      } else {
        // New pod
        changes.push({
          type: 'pod_added',
          pod: podName,
          phase: currentPodState.phase
        });
        hasChanges = true;
      }
    }

    // Check for removed pods
    for (const [podName] of previousState.pods) {
      if (!currentState.pods.has(podName)) {
        changes.push({
          type: 'pod_removed',
          pod: podName
        });
        hasChanges = true;
      }
    }

    // Update stored state
    podStates.set(serviceId, currentState);

    // Emit health event if there were changes
    if (hasChanges) {
      const healthPayload = {
        timestamp: new Date().toISOString(),
        changes,
        pods: Array.from(currentState.pods.entries()).map(([name, state]) => ({
          name,
          ...state
        })),
        summary: {
          total: currentState.pods.size,
          ready: Array.from(currentState.pods.values()).filter(p => p.ready).length,
          restarts: Array.from(currentState.pods.values()).reduce((sum, p) => sum + p.restartCount, 0)
        }
      };

      appEvents.emitServiceHealth(serviceId, healthPayload);

      logger.debug(`Pod status changes for ${serviceName}`, { changes });
    }
  } catch (err) {
    logger.error(`Failed to check pod status for service ${serviceId}`, {
      namespace,
      serviceName,
      error: err.message
    });
  }
}

/**
 * Register a service for metrics collection
 */
export function registerService(serviceId, namespace, serviceName, projectId) {
  activeServices.set(serviceId, { namespace, serviceName, projectId });
  logger.debug(`Registered service for metrics collection`, { serviceId, namespace, serviceName });
}

/**
 * Unregister a service from metrics collection
 */
export function unregisterService(serviceId) {
  activeServices.delete(serviceId);
  podStates.delete(serviceId);
  logger.debug(`Unregistered service from metrics collection`, { serviceId });
}

/**
 * Get registered services count
 */
export function getRegisteredCount() {
  return activeServices.size;
}

// Metrics collection interval
let metricsIntervalId = null;
let podStatusIntervalId = null;

/**
 * Start the metrics collection loop
 */
export function startMetricsCollection() {
  if (metricsIntervalId) {
    logger.warn('Metrics collection already running');
    return;
  }

  logger.info('Starting metrics collection loop');

  // Collect metrics every METRICS_INTERVAL
  metricsIntervalId = setInterval(async () => {
    for (const [serviceId, { namespace, serviceName }] of activeServices) {
      await collectServiceMetrics(serviceId, namespace, serviceName);
    }
  }, METRICS_INTERVAL);

  // Check pod status every POD_STATUS_INTERVAL
  podStatusIntervalId = setInterval(async () => {
    for (const [serviceId, { namespace, serviceName }] of activeServices) {
      await checkPodStatusChanges(serviceId, namespace, serviceName);
    }
  }, POD_STATUS_INTERVAL);
}

/**
 * Stop the metrics collection loop
 */
export function stopMetricsCollection() {
  if (metricsIntervalId) {
    clearInterval(metricsIntervalId);
    metricsIntervalId = null;
  }
  if (podStatusIntervalId) {
    clearInterval(podStatusIntervalId);
    podStatusIntervalId = null;
  }
  logger.info('Stopped metrics collection loop');
}

/**
 * Collect metrics for a specific service on demand
 */
export async function collectMetricsNow(serviceId, namespace, serviceName) {
  return collectServiceMetrics(serviceId, namespace, serviceName);
}

export default {
  registerService,
  unregisterService,
  startMetricsCollection,
  stopMetricsCollection,
  collectMetricsNow,
  getRegisteredCount
};
