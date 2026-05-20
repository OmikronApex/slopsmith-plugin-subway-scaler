// Red-phase ATDD scaffold — Story 1.6: Setup UI behavior and Story 1.7: fetch-failure handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// TODO: update import once setup.js API is finalised — file does not exist yet
import { saveSettings, loadSettings, fetchSessionConfig } from '../../../static/game/ui/setup.js';

describe('setup module — localStorage', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => mockStorage[key] ?? null),
      setItem: vi.fn((key, value) => { mockStorage[key] = String(value); }),
      removeItem: vi.fn((key) => { delete mockStorage[key]; }),
      clear: vi.fn(() => { mockStorage = {}; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.skip('saveSettings({ scale_id, difficulty, instrument_id }) writes to localStorage key subway-scaler-settings', () => {
    saveSettings({ scale_id: 'major', difficulty: 'medium', instrument_id: 'guitar-standard' });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'subway-scaler-settings',
      expect.any(String),
    );
    const stored = JSON.parse(mockStorage['subway-scaler-settings']);
    expect(stored.scale_id).toBe('major');
    expect(stored.difficulty).toBe('medium');
    expect(stored.instrument_id).toBe('guitar-standard');
  });

  it.skip('loadSettings() returns { scale_id, difficulty, instrument_id } from localStorage', () => {
    mockStorage['subway-scaler-settings'] = JSON.stringify({
      scale_id: 'minor',
      difficulty: 'hard',
      instrument_id: 'bass-standard',
    });
    const settings = loadSettings();
    expect(settings.scale_id).toBe('minor');
    expect(settings.difficulty).toBe('hard');
    expect(settings.instrument_id).toBe('bass-standard');
  });

  it.skip('loadSettings() returns default { difficulty: "medium", instrument_id: "guitar-standard" } when localStorage is empty', () => {
    const settings = loadSettings();
    expect(settings.difficulty).toBe('medium');
    expect(settings.instrument_id).toBe('guitar-standard');
  });

  it.skip('root_midi is NOT included in saved settings', () => {
    saveSettings({ scale_id: 'major', difficulty: 'medium', instrument_id: 'guitar-standard', root_midi: 60 });
    const stored = JSON.parse(mockStorage['subway-scaler-settings']);
    expect(stored).not.toHaveProperty('root_midi');
  });
});

describe('setup module — fetchSessionConfig fetch-failure handling (Story 1.7)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.skip('when fetchSessionConfig() receives a non-200 response, it throws or returns an error object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    }));
    await expect(fetchSessionConfig({ scale_id: 'major', difficulty: 'medium', instrument_id: 'guitar-standard' }))
      .rejects.toThrow();
  });

  it.skip('when fetchSessionConfig() throws a network error, it propagates (does not swallow)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failure')));
    await expect(fetchSessionConfig({ scale_id: 'major', difficulty: 'medium', instrument_id: 'guitar-standard' }))
      .rejects.toThrow('Network failure');
  });
});
