import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enumerateInputs } from '../../../static/game/AudioDetector.js';

describe('enumerateInputs', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'audioinput', deviceId: 'mic1', label: 'Internal Mic' },
          { kind: 'audiooutput', deviceId: 'spk1', label: 'Speakers' },
          { kind: 'audioinput', deviceId: 'mic2', label: 'USB Mic' },
          { kind: 'videoinput', deviceId: 'cam1', label: 'Webcam' },
        ]),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns only audioinput devices', async () => {
    const inputs = await enumerateInputs();
    expect(inputs).toEqual([
      { deviceId: 'mic1', label: 'Internal Mic' },
      { deviceId: 'mic2', label: 'USB Mic' },
    ]);
  });

  it('returns empty when mediaDevices missing', async () => {
    vi.stubGlobal('navigator', {});
    const inputs = await enumerateInputs();
    expect(inputs).toEqual([]);
  });
});
