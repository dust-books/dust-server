/**
 * Manages tasks that are intended to run at given interval.
 */
export interface TimerManager {
  /**
   * Register a function to run on a timer.
   * @param f Function to run
   * @param interval interval at which to run the function
   *
   * @returns the intervalId -- can be cleared with clearInterval if necessary.
   */
  registerTimer(f: () => void, interval: number): number;

  /**
   * Remove a timer associated with the provided intervalId
   * @param intervalId The intervalId to clear
   */
  removeTimer(intervalId: number): void;
}

export class DustTimerManager implements TimerManager {
  private timers = new Set<number>();

  registerTimer(f: () => void, interval: number): number {
    const intervalId = setInterval(f, interval);
    this.timers.add(intervalId);
    return intervalId;
  }

  removeTimer(intervalId: number): void {
    if (this.timers.has(intervalId)) {
      clearInterval(intervalId);
      this.timers.delete(intervalId);
    }
  }

  clearAll(): void {
    for (const id of this.timers) {
      this.removeTimer(id);
    }
  }
}
