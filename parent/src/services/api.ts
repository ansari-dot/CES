let refreshPromise: Promise<boolean> | null = null;

export async function executeTokenRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
      return res.status === 204 || res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function getCsrfHeader(): Promise<string | undefined> {
  const match = document.cookie.match(/(?:^|;\s*)sms_csrf=([^;]+)/);
  if (match) return match[1];
  try {
    const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
    const json = await res.json();
    return json.data?.csrfToken;
  } catch {
    return undefined;
  }
}

export async function requestApi<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = await getCsrfHeader();
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }

  const res = await fetch(path, { ...options, headers, credentials: 'include' });

  if (
    res.status === 401 &&
    !isRetry &&
    !path.includes('/auth/login') &&
    !path.includes('/auth/refresh') &&
    !path.includes('/auth/logout') &&
    !path.includes('/auth/me')
  ) {
    const refreshed = await executeTokenRefresh();
    if (refreshed) {
      const retryHeaders = new Headers(options.headers || {});
      if (!(options.body instanceof FormData) && !retryHeaders.has('Content-Type')) {
        retryHeaders.set('Content-Type', 'application/json');
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const newCsrf = await getCsrfHeader();
        if (newCsrf) retryHeaders.set('X-CSRF-Token', newCsrf);
      }
      return requestApi<T>(path, { ...options, headers: retryHeaders }, true);
    }
  }

  if (res.status === 204) return null as T;

  let json: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try { json = await res.json(); } catch { json = null; }
  }

  if (!res.ok || (json && json.success === false)) {
    throw new Error(json?.error?.message || `API request failed (${res.status})`);
  }

  return (json ? json.data : null) as T;
}

/**
 * Opens (or downloads) a file served by the protected uploads endpoint. The file
 * is fetched with the session cookie (refreshing the session if needed) so the
 * server can check the user's access before anything is shown. External links
 * are opened directly.
 */
export async function openProtectedFile(url: string, fileName?: string, download = false): Promise<void> {
  if (!url) throw new Error('No file is attached');
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  // Open the tab synchronously so pop-up blockers allow it, then fill it in
  const viewer = download ? null : window.open('', '_blank');

  let res = await fetch(url, { credentials: 'include' });
  if (res.status === 401 && (await executeTokenRefresh())) {
    res = await fetch(url, { credentials: 'include' });
  }
  if (!res.ok) {
    viewer?.close();
    let message = `Unable to open file (${res.status})`;
    try {
      const json = await res.json();
      message = json?.error?.message || message;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }

  const blobUrl = URL.createObjectURL(await res.blob());
  if (viewer) {
    viewer.location.href = blobUrl;
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName || url.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
