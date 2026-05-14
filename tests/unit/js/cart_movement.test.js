import { describe, it, expect } from 'vitest';
import { CartMovement } from '../../../static/game/carts/CartMovement.js';

describe('CartMovement', () => {
  it('should initialize with correct id, noteId, and duration', () => {
    const config = {
      id: 'cart-1',
      noteId: 'C4',
      noteDurationMs: 2000,
      spawnZ: -20,
      exitBoundaryZ: 0
    };
    const cart = new CartMovement(config);
    expect(cart.id).toBe('cart-1');
    expect(cart.noteId).toBe('C4');
    expect(cart.noteDurationMs).toBe(2000);
  });

  it('should calculate correct baseline speed', () => {
    const config = {
      id: 'cart-1',
      noteId: 'C4',
      noteDurationMs: 2000,
      spawnZ: -20,
      exitBoundaryZ: 0
    };
    const cart = new CartMovement(config);
    // trackLength = 20, duration = 2000 -> speed = 0.01
    expect(cart.baselineSpeed).toBe(0.01);
  });

  it('should update position correctly based on deltaTime and multiplier', () => {
    const config = {
      id: 'cart-1',
      noteId: 'C4',
      noteDurationMs: 2000,
      spawnZ: -20,
      exitBoundaryZ: 0
    };
    const cart = new CartMovement(config);
    // speed = 0.01, deltaTime = 100, multiplier = 1.0 -> move = 1.0
    // Z increases from -20 towards 0
    const newPos = cart.updatePosition(100, 1.0);
    expect(newPos).toBe(-19);
  });

  it('should detect expiry correctly', () => {
    const config = {
      id: 'cart-1',
      noteId: 'C4',
      noteDurationMs: 2000,
      spawnZ: -20,
      exitBoundaryZ: 0
    };
    const cart = new CartMovement(config);
    cart.updatePosition(1500, 1.0);
    expect(cart.isExpired()).toBe(false);
    cart.updatePosition(600, 1.0);
    expect(cart.isExpired()).toBe(true);
  });
});
