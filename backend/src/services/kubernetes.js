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
