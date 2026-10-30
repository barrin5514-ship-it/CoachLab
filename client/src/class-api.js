// Small JSON helper keeps safe API messages visible and never sends a coach ID.
export async function classApi(path, method = 'GET', body, signal) {
  const response = await fetch('/api/' + path, { method, signal, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'Classes could not be loaded. Try again.');
  return data;
}
