/**
 * Keyboard buttons for the fixed-step simulation.
 *
 * The simulation reads the buttons 60 times a second. A quick tap can go down and come back up between two reads
 * (always possible on a slow frame), and would then never be seen. So a key that went down since the last read
 * still counts as held for that one read.
 */
export class InputLatch {
  private held = 0;
  private tapped = 0;

  down(bit: number) { this.held |= bit; this.tapped |= bit; }
  up(bit: number) { this.held &= ~bit; }
  clear() { this.held = 0; this.tapped = 0; }
  /** Replace everything that is held (dev tools drive the game with this). */
  set(mask: number) { this.held = mask; this.tapped = 0; }

  /** The buttons for the next simulation tick. */
  read() {
    const v = this.held | this.tapped;
    this.tapped = 0;
    return v;
  }
}
