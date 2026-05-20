import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameClient } from '../../../static/game/game-client.js';

describe('GameClient variant methods (008-track-variants)', () => {
  let client;
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    client = new GameClient('/api/plugins/subway-scaler');
    client.sessionId = 'sess-123';
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('proposeVariant POSTs to /variant/propose and returns parsed body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, variant: { variant_id: 'v1' }, window: { state: 'OPEN' } }),
    });
    const resp = await client.proposeVariant();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plugins/subway-scaler/game/sess-123/variant/propose',
      expect.objectContaining({ method: 'POST' })
    );
    expect(resp.success).toBe(true);
    expect(resp.variant.variant_id).toBe('v1');
  });

  it('acceptVariant sends midi in the body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, root_midi: 67, base_fret: 3, num_lanes: 5, notes: [] }),
    });
    const resp = await client.acceptVariant(67);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plugins/subway-scaler/game/sess-123/variant/accept',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ midi: 67 }),
      })
    );
    expect(resp.success).toBe(true);
    expect(resp.root_midi).toBe(67);
  });

  it('timeoutVariant POSTs to /variant/timeout', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    const resp = await client.timeoutVariant();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plugins/subway-scaler/game/sess-123/variant/timeout',
      expect.objectContaining({ method: 'POST' })
    );
    expect(resp.success).toBe(true);
  });

  it('proposeVariant returns null when no session', async () => {
    client.sessionId = null;
    const resp = await client.proposeVariant();
    expect(resp).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('acceptVariant returns null when no session', async () => {
    client.sessionId = null;
    const resp = await client.acceptVariant(60);
    expect(resp).toBeNull();
  });

  it('timeoutVariant returns null when no session', async () => {
    client.sessionId = null;
    const resp = await client.timeoutVariant();
    expect(resp).toBeNull();
  });
});
