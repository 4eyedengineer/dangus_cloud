import { apiFetch } from './utils';

/**
 * Get notification settings for the current user
 * @returns {Promise<object>} Notification settings
 */
export async function getNotificationSettings() {
  return apiFetch('/notifications/settings');
}

/**
 * Update notification settings
 * @param {object} settings - Settings to update
 * @returns {Promise<object>} Updated settings
 */
export async function updateNotificationSettings(settings) {
  return apiFetch('/notifications/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

/**
 * Send a test notification
 * @returns {Promise<object>} Test results
 */
export async function sendTestNotification() {
  return apiFetch('/notifications/test', {
    method: 'POST',
  });
}

/**
 * Get notification history
 * @param {object} params - Pagination params
 * @param {number} params.limit - Number of items per page
 * @param {number} params.offset - Offset for pagination
 * @returns {Promise<object>} Notification history with pagination
 */
export async function getNotificationHistory({ limit = 20, offset = 0 } = {}) {
  return apiFetch(`/notifications/history?limit=${limit}&offset=${offset}`);
}
