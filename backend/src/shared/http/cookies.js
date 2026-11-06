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
  const isSecure = config.cookieSecure;
  const sameSite = config.COOKIE_SAMESITE;

  // 1. Clear __Host- cookies (RFC 6265bis: MUST have secure: true, path: '/' and NO domain attribute)
  res.clearCookie('__Host-sms_sid', {
    httpOnly: true,
    secure: true,
    sameSite,
    path: '/'
  });

  res.clearCookie('__Host-sms_at', {
    httpOnly: true,
    secure: true,
    sameSite,
    path: '/'
  });

  // 2. Clear __Secure- cookies (RFC 6265bis: MUST have secure: true)
  res.clearCookie('__Secure-sms_rt', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/v1/auth'
  });

  // 3. Clear standard root cookies (path: '/')
  res.clearCookie('sms_sid', {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: '/'
  });
  if (isSecure) {
    res.clearCookie('sms_sid', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/'
    });
  }

  res.clearCookie('sms_at', {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: '/'
  });
  if (isSecure) {
    res.clearCookie('sms_at', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/'
    });
  }

  res.clearCookie('sms_csrf', {
    httpOnly: false,
    secure: isSecure,
    sameSite,
    path: '/'
  });
  if (isSecure) {
    res.clearCookie('sms_csrf', {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/'
    });
  }

  // 4. Clear standard refresh token cookie (path: '/api/v1/auth')
  res.clearCookie('sms_rt', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/api/v1/auth'
  });
  if (isSecure) {
    res.clearCookie('sms_rt', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/v1/auth'
    });
  }
}
