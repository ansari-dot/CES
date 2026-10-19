import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

export function signAccessToken(payload) {
  const { userId, role, familyId, tokenVersion } = payload;
  return jwt.sign(
    {
      sub: String(userId),
      role,
      sid: familyId,
      tv: tokenVersion,
      jti: uuidv4()
    },
    config.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: `${config.ACCESS_TTL_MIN}m`,
      issuer: 'school-backend',
      audience: 'school-app'
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: 'school-backend',
    audience: 'school-app'
  });
}

export function generateRefreshToken() {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateCsrfToken(familyId = 'anonymous') {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', config.CSRF_SECRET)
    .update(`${randomPart}:${familyId}`)
    .digest('base64url');
  return `${randomPart}.${hmac}`;
}

export function verifyCsrfToken(token, familyId = 'anonymous') {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [randomPart, signature] = parts;
  const expectedHmac = crypto
    .createHmac('sha256', config.CSRF_SECRET)
    .update(`${randomPart}:${familyId}`)
    .digest('base64url');

  try {
    const bufA = Buffer.from(signature);
    const bufB = Buffer.from(expectedHmac);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
