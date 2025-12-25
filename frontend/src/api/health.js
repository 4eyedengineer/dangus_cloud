import { apiFetch } from './utils'

/**
 * Fetch aggregated health summary for dashboard
 * Returns errors, warnings, active deployments, and summary counts
 */
export async function fetchHealthSummary() {
  return apiFetch('/api/health/summary')
}
