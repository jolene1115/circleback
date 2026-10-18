// Calls to the team backend (same origin, proxied in development).

/** POST JSON to /api/<path>. Throws an Error with the server's message on failure. */
export async function request(path, payload) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('/api/' + path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Request failed. Please try again.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw Error('The server took too long. Please try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** 'ready' | 'key' (API key missing) | 'offline' */
export async function checkHealth() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw Error();
    const data = await response.json();
    return data.keyConfigured ? 'ready' : 'key';
  } catch {
    return 'offline';
  }
}
