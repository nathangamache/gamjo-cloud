async function request(method, url, data) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  if (data && method !== 'GET') opts.body = JSON.stringify(data);

  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  const json = res.ok ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new Error(json?.detail || `Request failed: ${res.status}`);
  return { data: json, status: res.status };
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, data) => request('POST', url, data),
  put: (url, data) => request('PUT', url, data),
  patch: (url, data) => request('PATCH', url, data),
  delete: (url, data) => request('DELETE', url, data),
  upload: async (url, formData) => {
    const res = await fetch(url, { method: 'POST', body: formData, credentials: 'include' });
    if (!res.ok) throw new Error('Upload failed');
    return { data: await res.json().catch(() => null) };
  },
};