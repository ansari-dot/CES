import crypto from 'crypto';

// 32-byte key derived from ZOOM_DATA_KEY or fallback
const DEFAULT_SECRET = process.env.ZOOM_DATA_KEY || 'default_zoom_data_encryption_secret_key_32_bytes!';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(DEFAULT_SECRET).digest();

/**
 * Encrypt plaintext string to AES-256-GCM binary Buffer
 * Format: [12-byte IV][16-byte AuthTag][Ciphertext]
 */
export function encryptAesGcm(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypt binary Buffer to plaintext string
 */
export function decryptAesGcm(buffer) {
  if (!buffer || buffer.length < 28) return null;
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
