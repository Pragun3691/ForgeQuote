export async function api(path, { method = 'GET', body, csrfToken, submissionKey, signal } = {}) {
  let response;
  try { response = await fetch(`/api${path}`, {
    method, signal, credentials: 'same-origin',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...(submissionKey ? { 'Idempotency-Key': submissionKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }); } catch(error) {
    if(error.name === 'AbortError') throw error;
    throw Object.assign(new Error('Network failure. If saving, the outcome may be unknown. Retry the same submission.'), {code:'NETWORK_FAILURE'});
  }
  if (response.status === 204) return null;
  let data;
  try {data = await response.json();} catch {throw new Error('The server response could not be read. If saving, retry the same submission.');}
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Request failed. Please retry.');
    error.status = response.status; error.code = data.error?.code;
    throw error;
  }
  return data;
}
