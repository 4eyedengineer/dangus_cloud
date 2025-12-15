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

export async function deleteProject(id) {
  return apiFetch(`/projects/${id}`, {
    method: 'DELETE',
  });
}
