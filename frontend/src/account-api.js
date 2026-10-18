export async function accountRequest(path, payload) {
  const response = await fetch('/api/account/' + path, {
    method: payload === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json'},
    ...(payload === undefined ? {} : {body: JSON.stringify(payload)}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Account request failed. Please try again.');
  return data;
}
