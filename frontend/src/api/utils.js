const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isValidationError() {
    return this.status === 400;
  }

  get isServerError() {
    return this.status >= 500;
  }
}

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // Only set Content-Type if there's a body (avoids Fastify empty JSON body error)
  const headers = { ...options.headers };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.message || `Request failed with status ${response.status}`,
      errorData
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function createLoadingState() {
  return {
    isLoading: false,
    error: null,
    data: null,
  };
}

export function setLoading(state) {
  return {
    ...state,
    isLoading: true,
    error: null,
  };
}

export function setSuccess(state, data) {
  return {
    ...state,
    isLoading: false,
    error: null,
    data,
  };
}

export function setError(state, error) {
  return {
    ...state,
    isLoading: false,
    error: error instanceof ApiError ? error : new ApiError(0, error.message),
    data: null,
  };
}

export function getErrorMessage(error) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
