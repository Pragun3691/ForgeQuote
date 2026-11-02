export async function api(path, { method = 'GET', body, csrfToken, signal } = {}) {
  const response = await fetch(`/api${path}`, {
    method, signal, credentials: 'same-origin',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Request failed. Please retry.');
    error.status = response.status; error.code = data.error?.code;
    throw error;
  }
  return data;
}
