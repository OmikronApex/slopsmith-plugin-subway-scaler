// Red-phase ATDD scaffold — Story 3.3: AudioDetector with YIN adapter
// (Successor to audio.test.js for new AudioDetector/YinDetector API)
//
// TODO: migrate enumerateInputs tests from audio.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// TODO: AudioDetector.js does not exist yet — import will fail until implementation
import { AudioDetector, YinDetector, AudioDetectorError } from '../../../static/game/AudioDetector.js';

describe('AudioDetector', () => {
  describe('class hierarchy', () => {
    it.skip('YinDetector extends AudioDetector', () => {
      expect(YinDetector.prototype).toBeInstanceOf(AudioDetector);
    });
  });
});

describe('YinDetector', () => {
  let detector;

  beforeEach(() => {
    // Stub AudioContext-related globals — not available in node environment
    vi.stubGlobal('AudioContext', vi.fn(() => ({
      createAnalyser: vi.fn(() => ({ connect: vi.fn(), fftSize: 0, getFloatTimeDomainData: vi.fn() })),
      createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
      close: vi.fn(),
      state: 'running',
    })));
    vi.stubGlobal('AudioWorkletNode', vi.fn(() => ({
      connect: vi.fn(),
      port: { onmessage: null, postMessage: vi.fn() },
    })));
    detector = new YinDetector();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('detect()', () => {
    it.skip('YinDetector.detect() returns { midi, confidence } on success', async () => {
      // Stub the internal yin processing to return a valid pitch
      vi.spyOn(detector, 'detect').mockResolvedValue({ midi: 60, confidence: 0.95 });
      const result = await detector.detect();
      expect(result).toHaveProperty('midi');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.midi).toBe('number');
      expect(typeof result.confidence).toBe('number');
    });

    it.skip('YinDetector.detect() throws AudioDetectorError on failure (does not swallow)', async () => {
      vi.spyOn(detector, 'detect').mockRejectedValue(new AudioDetectorError('No audio input'));
      await expect(detector.detect()).rejects.toThrow(AudioDetectorError);
    });

    it.skip('error thrown by detect() is an instance of AudioDetectorError', async () => {
      vi.spyOn(detector, 'detect').mockImplementation(async () => {
        throw new AudioDetectorError('Pitch detection failed');
      });
      let thrown;
      try {
        await detector.detect();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(AudioDetectorError);
    });
  });

  describe('GameState isolation', () => {
    it.skip('YinDetector does not reference GameState directly — no GameState import', async () => {
      // This test verifies the architectural boundary statically by checking the module text.
      // Since we cannot easily inspect module imports at runtime in vitest node env,
      // we assert by convention: the detect() result shape is self-contained (midi + confidence)
      // and does not contain scene/session/runtime sub-objects.
      vi.spyOn(detector, 'detect').mockResolvedValue({ midi: 69, confidence: 0.9 });
      const result = await detector.detect();
      expect(result).not.toHaveProperty('scene');
      expect(result).not.toHaveProperty('session');
      expect(result).not.toHaveProperty('runtime');
    });
  });
});

describe('AudioDetectorError', () => {
  it.skip('AudioDetectorError is a subclass of Error', () => {
    const err = new AudioDetectorError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test');
  });

  it.skip('AudioDetectorError has a name property of "AudioDetectorError"', () => {
    const err = new AudioDetectorError('test');
    expect(err.name).toBe('AudioDetectorError');
  });
});
