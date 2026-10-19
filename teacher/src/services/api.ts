async function getCsrfHeader(): Promise<string | undefined> {
  const match = document.cookie.match(/(?:^|;\s*)sms_csrf=([^;]+)/);
  if (match) {
    return match[1];
  }
  try {
    const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
    const json = await res.json();
    return json.data?.csrfToken;
  } catch {
    return undefined;
  }
}

export async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = await getCsrfHeader();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include'
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message || 'API request failed');
  }

  return json.data as T;
}
