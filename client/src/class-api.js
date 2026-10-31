// Small JSON helper keeps safe API messages visible and never sends a coach ID.
export async function classApi(path, method = 'GET', body, signal) {
  const timeout = AbortSignal.timeout(body?.progression ? 180000 : 20000);
  let response;
  try { response = await fetch('/api/' + path, { method, signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(timeout.aborted ? 'CoachLab took too long to respond. Refresh classes to check whether the lesson was added before retrying.' : 'Could not reach CoachLab. Check your connection and try again.');
  }
  let data;
  try { data = response.status === 204 ? null : await response.json(); }
  catch { throw new Error('CoachLab returned an unreadable response. Refresh classes and try again.'); }
  if (!response.ok) throw new Error(data?.error || 'Classes could not be loaded. Try again.');
  return data;
}
