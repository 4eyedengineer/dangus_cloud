import fs from 'fs';
import https from 'https';
import logger from './logger.js';

const K8S_API_SERVER = process.env.KUBERNETES_SERVICE_HOST
  ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`
  : 'https://kubernetes.default.svc';

const TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const CA_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

function getServiceAccountToken() {
  try {
    return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch (err) {
    // Running outside cluster - use environment token
    logger.debug('Service account token file not found, using KUBERNETES_TOKEN env var', {
      error: err.code
    });
    const envToken = process.env.KUBERNETES_TOKEN;
    if (!envToken) {
      logger.error('No Kubernetes authentication available - neither service account nor KUBERNETES_TOKEN');
    }
    return envToken || null;
  }
}

function getCA() {
  try {
    return fs.readFileSync(CA_PATH, 'utf8');
  } catch (err) {
    // Running outside cluster - CA not available
    logger.debug('Kubernetes CA file not found, TLS verification may be disabled', {
      error: err.code
    });
    return null;
  }
}

async function k8sRequest(method, path, body = null, contentType = 'application/json') {
  const token = getServiceAccountToken();
  if (!token) {
    throw new Error('Kubernetes authentication not configured');
  }

  const ca = getCA();
  const urlObj = new URL(`${K8S_API_SERVER}${path}`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'Accept': 'application/json',
      },
      // TLS options
      ca: ca || undefined,
      rejectUnauthorized: !!ca, // Only verify if we have CA cert
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          let errorMessage;
          try {
            const errorJson = JSON.parse(data);
            errorMessage = errorJson.message || data;
          } catch (parseErr) {
            logger.debug('Kubernetes API returned non-JSON error', {
              status: res.statusCode,
              contentType: res.headers['content-type']
            });
            errorMessage = data;
          }
          const error = new Error(`Kubernetes API error: ${errorMessage}`);
          error.status = res.statusCode;
          reject(error);
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Kubernetes request failed: ${err.message}`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

export async function createNamespace(name) {
  const namespace = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name,
      labels: {
        'app.kubernetes.io/managed-by': 'dangus-cloud',
      },
    },
  };

  return k8sRequest('POST', '/api/v1/namespaces', namespace);
}

export async function deleteNamespace(name) {
  return k8sRequest('DELETE', `/api/v1/namespaces/${name}`);
}

export async function getNamespace(name) {
  return k8sRequest('GET', `/api/v1/namespaces/${name}`);
}

export async function namespaceExists(name) {
  try {
    await getNamespace(name);
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

export async function deleteDeployment(namespace, name) {
  return k8sRequest('DELETE', `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`);
}

export async function deleteService(namespace, name) {
  return k8sRequest('DELETE', `/api/v1/namespaces/${namespace}/services/${name}`);
}

export async function deleteIngress(namespace, name) {
  return k8sRequest('DELETE', `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses/${name}`);
}

export async function deletePVC(namespace, name) {
  return k8sRequest('DELETE', `/api/v1/namespaces/${namespace}/persistentvolumeclaims/${name}`);
}

export async function applyManifest(manifest) {
  const { apiVersion, kind, metadata } = manifest;
  const namespace = metadata.namespace;
  const name = metadata.name;

  let path;
  if (apiVersion === 'v1' && kind === 'Service') {
    path = `/api/v1/namespaces/${namespace}/services`;
  } else if (apiVersion === 'apps/v1' && kind === 'Deployment') {
    path = `/apis/apps/v1/namespaces/${namespace}/deployments`;
  } else if (apiVersion === 'networking.k8s.io/v1' && kind === 'Ingress') {
    path = `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses`;
  } else if (apiVersion === 'v1' && kind === 'PersistentVolumeClaim') {
    path = `/api/v1/namespaces/${namespace}/persistentvolumeclaims`;
  } else if (apiVersion === 'batch/v1' && kind === 'Job') {
    path = `/apis/batch/v1/namespaces/${namespace}/jobs`;
  } else if (apiVersion === 'v1' && kind === 'Secret') {
    path = `/api/v1/namespaces/${namespace}/secrets`;
  } else {
    throw new Error(`Unsupported manifest kind: ${kind}`);
  }

  return k8sRequest('POST', path, manifest);
}

export async function createSecret(namespace, name, data, type = 'Opaque') {
  const secret = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/managed-by': 'dangus-cloud',
      },
    },
    type,
    data,
  };

  return k8sRequest('POST', `/api/v1/namespaces/${namespace}/secrets`, secret);
}

export async function deleteSecret(namespace, name) {
  return k8sRequest('DELETE', `/api/v1/namespaces/${namespace}/secrets/${name}`);
}

export async function getJob(namespace, name) {
  return k8sRequest('GET', `/apis/batch/v1/namespaces/${namespace}/jobs/${name}`);
}

export async function deleteJob(namespace, name, propagationPolicy = 'Background') {
  return k8sRequest('DELETE', `/apis/batch/v1/namespaces/${namespace}/jobs/${name}?propagationPolicy=${propagationPolicy}`);
}

export async function getPodsByLabel(namespace, labelSelector) {
  return k8sRequest('GET', `/api/v1/namespaces/${namespace}/pods?labelSelector=${encodeURIComponent(labelSelector)}`);
}

export async function getDeployment(namespace, name) {
  return k8sRequest('GET', `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`);
}

export async function getService(namespace, name) {
  return k8sRequest('GET', `/api/v1/namespaces/${namespace}/services/${name}`);
}

/**
 * Patch a Kubernetes Service using strategic merge patch
 * @param {string} namespace - Namespace
 * @param {string} name - Service name
 * @param {object} patch - Patch object
 */
export async function patchService(namespace, name, patch) {
  return k8sRequest(
    'PATCH',
    `/api/v1/namespaces/${namespace}/services/${name}`,
    patch,
    'application/strategic-merge-patch+json'
  );
}

/**
 * Patch a Kubernetes Deployment using strategic merge patch
 * @param {string} namespace - Namespace
 * @param {string} name - Deployment name
 * @param {object} patch - Patch object
 */
export async function patchDeployment(namespace, name, patch) {
  return k8sRequest(
    'PATCH',
    `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
    patch,
    'application/strategic-merge-patch+json'
  );
}

/**
 * Patch a Kubernetes Ingress using strategic merge patch
 * @param {string} namespace - Namespace
 * @param {string} name - Ingress name
 * @param {object} patch - Patch object
 */
export async function patchIngress(namespace, name, patch) {
  return k8sRequest(
    'PATCH',
    `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses/${name}`,
    patch,
    'application/strategic-merge-patch+json'
  );
}

export async function getPodMetrics(namespace, labelSelector) {
  const metricsPath = `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods`;
  const metrics = await k8sRequest('GET', metricsPath);

  // Filter by label selector (format: "app=servicename")
  const [labelKey, labelValue] = labelSelector.split('=');
  const pods = metrics.items.filter(pod =>
    pod.metadata.labels?.[labelKey] === labelValue
  );

  return pods.map(pod => ({
    name: pod.metadata.name,
    containers: pod.containers.map(container => ({
      name: container.name,
      cpu: container.usage.cpu,
      memory: container.usage.memory
    }))
  }));
}

export async function getPodLogs(namespace, podName, options = {}) {
  const { container = null, tailLines = 100, sinceSeconds = null } = options;
  let path = `/api/v1/namespaces/${namespace}/pods/${podName}/log?timestamps=true`;
  if (container) path += `&container=${container}`;
  if (tailLines) path += `&tailLines=${tailLines}`;
  if (sinceSeconds) path += `&sinceSeconds=${sinceSeconds}`;
  const token = getServiceAccountToken();
  if (!token) {
    throw new Error('Kubernetes authentication not configured');
  }

  const ca = getCA();
  const urlObj = new URL(`${K8S_API_SERVER}${path}`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      ca: ca || undefined,
      rejectUnauthorized: !!ca,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          const error = new Error(`Failed to get pod logs: ${data}`);
          error.status = res.statusCode;
          reject(error);
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Failed to get pod logs: ${err.message}`));
    });

    req.end();
  });
}

/**
 * Stream pod logs in real-time using follow mode
 * Returns an EventEmitter-like object that emits 'data', 'error', and 'end' events
 */
export function streamPodLogs(namespace, podName, options = {}) {
  const { container = null, tailLines = 100 } = options;
  let path = `/api/v1/namespaces/${namespace}/pods/${podName}/log?follow=true&timestamps=true`;
  if (container) path += `&container=${container}`;
  if (tailLines) path += `&tailLines=${tailLines}`;
  const token = getServiceAccountToken();

  if (!token) {
    const error = new Error('Kubernetes authentication not configured');
    return {
      on: (event, callback) => {
        if (event === 'error') callback(error);
      },
      destroy: () => {}
    };
  }

  const ca = getCA();
  const urlObj = new URL(`${K8S_API_SERVER}${path}`);

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 443,
    path: urlObj.pathname + urlObj.search,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    ca: ca || undefined,
    rejectUnauthorized: !!ca,
  };

  const req = https.request(options);

  const stream = {
    _handlers: { data: [], error: [], end: [] },
    _request: req,
    on(event, callback) {
      if (this._handlers[event]) {
        this._handlers[event].push(callback);
      }
      return this;
    },
    emit(event, ...args) {
      if (this._handlers[event]) {
        this._handlers[event].forEach(cb => cb(...args));
      }
    },
    destroy() {
      try {
        req.destroy();
      } catch (e) {
        // Ignore errors on destroy
      }
    }
  };

  req.on('response', (res) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      res.on('data', (chunk) => {
        stream.emit('data', chunk.toString());
      });
      res.on('end', () => {
        stream.emit('end');
      });
      res.on('error', (err) => {
        stream.emit('error', err);
      });
    } else {
      let errorData = '';
      res.on('data', chunk => errorData += chunk);
      res.on('end', () => {
        stream.emit('error', new Error(`Failed to stream logs: ${res.statusCode} - ${errorData}`));
      });
    }
  });

  req.on('error', (err) => {
    stream.emit('error', new Error(`Failed to stream pod logs: ${err.message}`));
  });

  req.end();

  return stream;
}

export async function rolloutRestart(namespace, deploymentName) {
  const patch = {
    spec: {
      template: {
        metadata: {
          annotations: {
            'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
          }
        }
      }
    }
  };

  return k8sRequest(
    'PATCH',
    `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`,
    patch,
    'application/strategic-merge-patch+json'
  );
}

export async function deleteServicePods(namespace, serviceName) {
  return k8sRequest(
    'DELETE',
    `/api/v1/namespaces/${namespace}/pods?labelSelector=app=${encodeURIComponent(serviceName)}`
  );
}

export async function getIngress(namespace, name) {
  return k8sRequest('GET', `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses/${name}`);
}

export async function getCertificate(namespace, name) {
  try {
    return await k8sRequest('GET', `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates/${name}`);
  } catch (err) {
    if (err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function getSecret(namespace, name) {
  try {
    return await k8sRequest('GET', `/api/v1/namespaces/${namespace}/secrets/${name}`);
  } catch (err) {
    if (err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Get pod health information including readiness/liveness probe status
 * @param {string} namespace - Kubernetes namespace
 * @param {string} labelSelector - Label selector (e.g., "app=servicename")
 * @returns {Promise<Array>} Array of pod health objects
 */
export async function getPodHealth(namespace, labelSelector) {
  const podsResult = await getPodsByLabel(namespace, labelSelector);
  const pods = podsResult.items || [];

  return pods.map(pod => {
    const conditions = pod.status?.conditions || [];
    const containerStatuses = pod.status?.containerStatuses || [];

    // Get condition statuses
    const readyCondition = conditions.find(c => c.type === 'Ready');
    const containersReadyCondition = conditions.find(c => c.type === 'ContainersReady');

    // Get container info for restart count
    const mainContainer = containerStatuses[0] || {};

    return {
      name: pod.metadata.name,
      ready: readyCondition?.status === 'True',
      phase: pod.status?.phase,
      restartCount: mainContainer.restartCount || 0,
      liveness: {
        status: containersReadyCondition?.status === 'True' ? 'passing' : 'failing',
        lastCheck: containersReadyCondition?.lastTransitionTime || null,
        message: containersReadyCondition?.message || null
      },
      readiness: {
        status: readyCondition?.status === 'True' ? 'passing' : 'failing',
        lastCheck: readyCondition?.lastTransitionTime || null,
        message: readyCondition?.message || null
      }
    };
  });
}

/**
 * Get events for pods in a namespace with a specific label
 * @param {string} namespace - Kubernetes namespace
 * @param {string} labelSelector - Label selector (e.g., "app=servicename")
 * @returns {Promise<Array>} Array of relevant events
 */
export async function getPodEvents(namespace, labelSelector) {
  // Get pods first to get their names
  const podsResult = await getPodsByLabel(namespace, labelSelector);
  const pods = podsResult.items || [];
  const podNames = pods.map(p => p.metadata.name);

  if (podNames.length === 0) {
    return [];
  }

  // Get events for the namespace
  const eventsResult = await k8sRequest('GET', `/api/v1/namespaces/${namespace}/events`);
  const events = eventsResult.items || [];

  // Filter events related to our pods and probe failures
  return events
    .filter(event => {
      const involvedName = event.involvedObject?.name;
      const isRelevantPod = podNames.includes(involvedName);
      const isProbeEvent = event.reason === 'Unhealthy' ||
                          event.reason === 'ProbeError' ||
                          event.reason === 'BackOff' ||
                          event.reason === 'Started' ||
                          event.reason === 'Killing';
      return isRelevantPod && isProbeEvent;
    })
    .map(event => ({
      type: event.type,
      reason: event.reason,
      message: event.message,
      count: event.count || 1,
      lastTimestamp: event.lastTimestamp || event.eventTime,
      podName: event.involvedObject?.name
    }))
    .sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp))
    .slice(0, 20); // Return last 20 events
}
