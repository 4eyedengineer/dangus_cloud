import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  // Key should be base64 encoded 32-byte value
  return Buffer.from(key, 'base64');
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param {string} plaintext - The text to encrypt
 * @returns {string} - Base64 encoded encrypted string (iv:authTag:ciphertext)
 */
export function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine iv, authTag, and ciphertext for storage
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedData - Base64 encoded encrypted string (iv:authTag:ciphertext)
 * @returns {string} - Decrypted plaintext
 */
export function decrypt(encryptedData) {
  const key = getEncryptionKey();
  const [ivBase64, authTagBase64, ciphertext] = encryptedData.split(':');

  if (!ivBase64 || !authTagBase64 || !ciphertext) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a unique 6-character user hash
 * @returns {string} - 6 character alphanumeric hash
 */
export function generateUserHash() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    hash += chars[bytes[i] % chars.length];
  }
  return hash;
}

/**
 * Generate a secure webhook secret for GitHub webhook verification
 * @returns {string} - 64 character hex string
 */
export function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}
