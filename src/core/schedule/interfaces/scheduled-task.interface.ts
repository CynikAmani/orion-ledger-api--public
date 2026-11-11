/**
 * Contract for feature modules that plug into the central schedule runner.
 * Register via ScheduleRegistry from OnModuleInit.
 */
export interface ScheduledTask {
  /** Stable unique name used in logs (e.g. "promotions.lifecycle"). */
  readonly name: string;

  /**
   * Execute the task. Must be idempotent — called on bootstrap catch-up
   * and on every cron tick.
   */
  execute(): Promise<void>;
}
