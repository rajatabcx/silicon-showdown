import { describe, expect, it } from 'vitest';
import { InputLatch } from './input';
import { BTN } from './sim/types';

describe('keyboard latch', () => {
  it('a tap that goes down and up between two ticks is still seen once', () => {
    const k = new InputLatch();
    k.down(BTN.X); k.up(BTN.X);
    expect(k.read() & BTN.X).toBe(BTN.X);
    expect(k.read() & BTN.X).toBe(0);
  });

  it('a held key stays held until it is released', () => {
    const k = new InputLatch();
    k.down(BTN.R);
    expect(k.read()).toBe(BTN.R);
    expect(k.read()).toBe(BTN.R);
    k.up(BTN.R);
    expect(k.read()).toBe(0);
  });

  it('a tap while another key is held does not disturb it', () => {
    const k = new InputLatch();
    k.down(BTN.L);
    k.read();
    k.down(BTN.X); k.up(BTN.X);
    expect(k.read()).toBe(BTN.L | BTN.X);
    expect(k.read()).toBe(BTN.L);
  });
});
