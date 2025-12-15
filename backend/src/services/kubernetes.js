import fs from 'fs';
import https from 'https';

const K8S_API_SERVER = process.env.KUBERNETES_SERVICE_HOST
  ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`
  : 'https://kubernetes.default.svc';

const TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const CA_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

function getServiceAccountToken() {
  try {
    return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch {
    return process.env.KUBERNETES_TOKEN || null;
  }
}

function getCA() {
  try {
    return fs.readFileSync(CA_PATH, 'utf8');
  } catch {
    return null;
  }
}

async function k8sRequest(method, path, body = null) {
  const token = getServiceAccountToken();
  if (!token) {
    throw new Error('Kubernetes authentication not configured');
  }

  const url = `${K8S_API_SERVER}${path}`;
  const ca = getCA();

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (ca) {
    options.agent = new https.Agent({ ca });
  } else {
    options.agent = new https.Agent({ rejectUnauthorized: false });
  }

  const response = await fetch(url, {
    ...options,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorText;
    } catch {
      errorMessage = errorText;
    }
    const error = new Error(`Kubernetes API error: ${errorMessage}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
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

export async function getPodLogs(namespace, podName, container = null) {
  const containerParam = container ? `&container=${container}` : '';
  const url = `${K8S_API_SERVER}/api/v1/namespaces/${namespace}/pods/${podName}/log?timestamps=true${containerParam}`;
  const token = getServiceAccountToken();
  if (!token) {
    throw new Error('Kubernetes authentication not configured');
  }

  const ca = getCA();
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  if (ca) {
    options.agent = new https.Agent({ ca });
  } else {
    options.agent = new https.Agent({ rejectUnauthorized: false });
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Failed to get pod logs: ${errorText}`);
    error.status = response.status;
    throw error;
  }

  return response.text();
}
