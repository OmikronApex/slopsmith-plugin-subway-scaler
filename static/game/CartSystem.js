import { PHASES } from './GameState.js';

const COLLISION_THRESHOLD = 0.5;
const WAVE_LOOKAHEAD_MS = 10000;
const WAVE_SPACING_FACTOR = 0.4;
const BASE_DURATION = { easy: 4000, medium: 2500, hard: 1500 };
const BASE_SPEED = { easy: 10, medium: 16, hard: 25 };

export class CartSystem {
  static _nextDeadlineMs = 0;
  static _nextWaveNoteIndex = 1;
  static _totalWavesSpawned = 0;

  static init(gameState) {
    CartSystem._nextDeadlineMs = Date.now();
    CartSystem._nextWaveNoteIndex = 1;
    CartSystem._totalWavesSpawned = 0;
  }

  static update(deltaTime, gameState) {
    const character = gameState.scene.character;
    const carts = gameState.scene.carts;

    if (character.lane !== undefined) {
      for (const cart of carts) {
        if (!cart.cleared && cart.lane === character.lane && Math.abs(cart.z - character.z) < COLLISION_THRESHOLD) {
          gameState.runtime.phase = PHASES.GAME_OVER;
          break;
        }
      }
    }

    for (const cart of carts) {
      cart.z -= gameState.runtime.speed * deltaTime;
    }

    const currentNote = gameState.runtime.currentNote;
    if (currentNote) {
      for (const cart of carts) {
        if (!cart.cleared && cart.safeZoneActive && cart.notemidi === currentNote.midi) {
          gameState.runtime.score += 100 * CartSystem._difficultyMultiplier(gameState.session.difficulty);
          cart.cleared = true;
        }
      }
    }

    const now = Date.now();
    gameState.scene.carts = carts.filter(c => {
      if (c.z < character.z) return false;
      if (c.spawnTime != null && c.duration != null && c.spawnTime + c.duration <= now - 10000) return false;
      return true;
    });

    CartSystem._topUpWaveQueue(gameState, now);
  }

  static _difficultyMultiplier(difficulty) {
    return { easy: 1, medium: 1.5, hard: 2 }[difficulty] ?? 1;
  }

  static _topUpWaveQueue(gameState, now) {
    const notes = gameState.session.notes;
    if (!notes || notes.length === 0) return;
    const diff = gameState.session.difficulty ?? 'medium';
    const baseDuration = BASE_DURATION[diff] ?? 2500;
    const baseSpeed = BASE_SPEED[diff] ?? 16;
    const speedMultiplier = Math.max(gameState.runtime.speed / baseSpeed, 0.1);

    while (CartSystem._nextDeadlineMs < now + WAVE_LOOKAHEAD_MS) {
      const gap = baseDuration * WAVE_SPACING_FACTOR / speedMultiplier;
      CartSystem._nextDeadlineMs += gap;
      const note = notes[CartSystem._nextWaveNoteIndex];
      const cart = CartSystem._buildCart(note, CartSystem._nextDeadlineMs, gameState, baseDuration);
      gameState.scene.carts.push(cart);
      CartSystem._nextWaveNoteIndex = (CartSystem._nextWaveNoteIndex + 1) % notes.length;
      CartSystem._totalWavesSpawned++;
    }
  }

  static _buildCart(note, deadlineMs, gameState, baseDuration) {
    return {
      z: 100,
      lane: note.lane ?? 0,
      notemidi: note.midi,
      cleared: false,
      safeZoneActive: true,
      spawnTime: deadlineMs,
      duration: baseDuration,
    };
  }
}
