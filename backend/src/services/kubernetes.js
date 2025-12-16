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
