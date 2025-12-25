import { apiFetch } from './utils.js';

export async function fetchProjects() {
  const response = await apiFetch('/projects');
  return response.projects;
}

export async function fetchProject(id) {
  return apiFetch(`/projects/${id}`);
}

export async function createProject(name) {
  return apiFetch('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateProject(id, updates) {
  return apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteProject(id) {
  return apiFetch(`/projects/${id}`, {
    method: 'DELETE',
  });
}

export async function setProjectState(id, state) {
  return apiFetch(`/projects/${id}/state`, {
    method: 'PATCH',
    body: JSON.stringify({ state }),
  });
}

export async function startProject(id) {
  return setProjectState(id, 'running');
}

export async function stopProject(id) {
  return setProjectState(id, 'stopped');
}
