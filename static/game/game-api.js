const API = '/api/plugins/subway-scaler';

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && data.error && data.error.message) || ('HTTP ' + r.status));
  return data;
}

export async function getGameState() {
  return fetchJson(`${API}/game-state`);
}

export async function getNoteTiming(noteId) {
  return fetchJson(`${API}/notes/${encodeURIComponent(noteId)}`);
}

export async function apiPlayNote(noteId, correct) {
  return fetchJson(`${API}/notes/${encodeURIComponent(noteId)}/played`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correct })
  });
}

export async function startSequenceRun(sequence) {
  return fetchJson(`${API}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sequence })
  });
}

export async function apiResetGame() {
  return fetchJson(`${API}/reset`, { method: 'POST' });
}
