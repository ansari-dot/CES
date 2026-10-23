import { config } from '../../config/index.js';

export function getCookieNames() {
  const isSecure = config.cookieSecure;
  return {
    accessToken: isSecure ? '__Host-sms_at' : 'sms_at',
    refreshToken: isSecure ? '__Secure-sms_rt' : 'sms_rt',
    csrf: 'sms_csrf'
  };
}

export function setAuthCookies(res, { accessToken, refreshToken, csrfToken }) {
  const names = getCookieNames();
  const secure = config.cookieSecure;
  const sameSite = config.COOKIE_SAMESITE;

  if (accessToken) {
    res.cookie(names.accessToken, accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: config.ACCESS_TTL_MIN * 60 * 1000
    });
  }

  if (refreshToken) {
    res.cookie(names.refreshToken, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: config.REFRESH_IDLE_DAYS * 24 * 60 * 60 * 1000
    });
  }

  if (csrfToken) {
    res.cookie(names.csrf, csrfToken, {
      httpOnly: false, // client JS reads this to send in X-CSRF-Token header
      secure,
      sameSite,
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 h — matches default ACCESS_TTL_MIN in dev
    });
  }
}

export function clearAuthCookies(res) {
  const names = getCookieNames();
  const secure = config.cookieSecure;
  const sameSite = config.COOKIE_SAMESITE;

  res.clearCookie(names.accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/'
  });

  res.clearCookie(names.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/v1/auth'
  });

  res.clearCookie(names.csrf, {
    httpOnly: false,
    secure,
    sameSite,
    path: '/'
  });
}
