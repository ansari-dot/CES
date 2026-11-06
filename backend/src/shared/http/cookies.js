import { config } from '../../config/index.js';

export function getCookieNames() {
  const isSecure = config.cookieSecure;
  return {
    sessionId: isSecure ? '__Host-sms_sid' : 'sms_sid',
    accessToken: isSecure ? '__Host-sms_at' : 'sms_at',
    refreshToken: isSecure ? '__Secure-sms_rt' : 'sms_rt',
    csrf: 'sms_csrf'
  };
}

export function setAuthCookies(res, { sessionId, rememberMe = false, accessToken, refreshToken, csrfToken }) {
  const names = getCookieNames();
  const secure = config.cookieSecure;
  const sameSite = config.COOKIE_SAMESITE;

  // 1. Primary Server-Side Session ID Cookie (HttpOnly)
  if (sessionId) {
    const sessionCookieOpts = {
      httpOnly: true,
      secure,
      sameSite,
      path: '/'
    };

    // When rememberMe is true: issue persistent cookie (e.g. 30 days)
    // When rememberMe is false: omit maxAge/expires so browser deletes on exit
    if (rememberMe) {
      sessionCookieOpts.maxAge = config.REFRESH_IDLE_DAYS * 24 * 60 * 60 * 1000;
    }

    res.cookie(names.sessionId, sessionId, sessionCookieOpts);
  }

  // 2. Access Token Cookie (HttpOnly) - for backward compatibility / transition
  if (accessToken) {
    res.cookie(names.accessToken, accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: config.ACCESS_TTL_MIN * 60 * 1000
    });
  }

  // 3. Refresh Token Cookie (HttpOnly, path-restricted)
  if (refreshToken) {
    res.cookie(names.refreshToken, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: config.REFRESH_IDLE_DAYS * 24 * 60 * 60 * 1000
    });
  }

  // 4. CSRF Token Cookie (readable by client JS to attach to X-CSRF-Token header)
  if (csrfToken) {
    res.cookie(names.csrf, csrfToken, {
      httpOnly: false,
      secure,
      sameSite,
      path: '/',
      maxAge: 24 * 60 * 60 * 1000
    });
  }
}

export function clearAuthCookies(res) {
  const secure = config.cookieSecure;
  const sameSite = config.COOKIE_SAMESITE;

  const cookieNames = [
    'sms_sid',
    '__Host-sms_sid',
    'sms_at',
    '__Host-sms_at',
    'sms_rt',
    '__Secure-sms_rt',
    'sms_csrf'
  ];

  const paths = ['/', '/api/v1/auth'];

  for (const name of cookieNames) {
    const isCsrf = name === 'sms_csrf';
    for (const path of paths) {
      // 1. Clear matching active config
      res.clearCookie(name, {
        httpOnly: !isCsrf,
        secure,
        sameSite,
        path,
        maxAge: 0,
        expires: new Date(0)
      });
      // 2. Clear non-secure lax fallback
      res.clearCookie(name, {
        httpOnly: !isCsrf,
        secure: false,
        sameSite: 'lax',
        path,
        maxAge: 0,
        expires: new Date(0)
      });
      // 3. Clear strict path fallback
      res.clearCookie(name, {
        httpOnly: !isCsrf,
        secure: false,
        sameSite: 'strict',
        path,
        maxAge: 0,
        expires: new Date(0)
      });
    }
  }
}
