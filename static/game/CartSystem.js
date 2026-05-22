import { PHASES } from './GameState.js';
import { SPAWN_Z } from './TrackSystem.js';

const COLLISION_THRESHOLD = 3.0;

export class CartSystem {
  static init(gameState) {
    // Wave queue is now owned by WaveScheduler; nothing to initialise here.
  }

  static update(game_now, gameState, waves) {
    if (!waves || waves.length === 0) return;

    const character = gameState.scene.character;
    const characterZ = character.z ?? 0;
    const characterLane = character.lane;

    for (const wave of waves) {
      if (wave.cleared) continue;
      const elapsed = Math.max(0, game_now - wave.spawn_time_ms);
      const z = SPAWN_Z + elapsed * wave.speed_px_per_ms * 0.5;

      if (Math.abs(z - characterZ) < COLLISION_THRESHOLD) {
        if (characterLane !== undefined && characterLane !== wave.safe_track) {
          gameState.runtime.phase = PHASES.GAME_OVER;
          return;
        }
      }
    }

    const currentNote = gameState.runtime.currentNote;
    if (currentNote) {
      for (const wave of waves) {
        if (!wave.cleared && wave.safe_midi === currentNote.midi) {
          gameState.runtime.score += 100 * CartSystem._difficultyMultiplier(gameState.session.difficulty);
          wave.cleared = true;
        }
      }
    }
  }

  static _difficultyMultiplier(difficulty) {
    return { easy: 1, medium: 1.5, hard: 2 }[difficulty] ?? 1;
  }
}
