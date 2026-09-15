import type { pino } from "@bogeychan/elysia-logger";
import { log } from "../infrastructure/external/logger";
import {
    eventEmitter,
    type FrakEvents,
} from "../infrastructure/messaging/events";
import { cronMetrics } from "../infrastructure/telemetry";

type CronContext = {
    context: {
        logger: pino.Logger;
    };
};

type MutexCronConfig = {
    name: string;
    /**
     * ```plain
     * ┌──────────── minute
     * │ ┌────────── hour
     * │ │ ┌──────── day of month
     * │ │ │ ┌────── month
     * │ │ │ │ ┌──── day of week
     * │ │ │ │ │
     * * * * * *
     * ```
     */
    pattern: string;
    triggerKeys?: (keyof FrakEvents)[];
    coolDownInMs?: number;
    run: (args: CronContext) => void | Promise<void>;
};

/**
 * Cron with coalescing execution guard — boolean flags (isRunning / hasPending)
 * instead of async-mutex. At most one pending re-run, no unbounded Promise queuing.
 */
export class MutexCron {
    private cron: Bun.CronJob | null = null;
    private isRunning = false;
    private hasPending = false;
    private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly logger: pino.Logger;
    private readonly eventCleanups: (() => void)[] = [];

    constructor(private readonly config: MutexCronConfig) {
        this.logger = log.child({ cron: config.name });
    }

    start() {
        const { pattern, name, coolDownInMs, triggerKeys, run } = this.config;
        const runContext: CronContext = { context: { logger: this.logger } };

        const execute = async () => {
            if (this.isRunning || this.cooldownTimer) {
                this.hasPending = true;
                cronMetrics.skipped(name);
                return;
            }

            this.isRunning = true;
            try {
                await cronMetrics.observe(name, () => run(runContext));
            } catch (error) {
                this.logger.warn({ error }, "[Cron] error while processing");
            } finally {
                this.isRunning = false;
            }

            if (coolDownInMs) {
                this.cooldownTimer = setTimeout(() => {
                    this.cooldownTimer = null;
                    if (this.hasPending) {
                        this.hasPending = false;
                        execute();
                    }
                }, coolDownInMs);
                this.cooldownTimer.unref();
            } else if (this.hasPending) {
                this.hasPending = false;
                setTimeout(execute, 0);
            }
        };

        // Returning the promise is what gives Bun its no-overlap guarantee: the
        // next fire time is computed only once this settles. The catch is the
        // last line of defence — an unhandled rejection here would exit the process.
        this.cron = Bun.cron(
            pattern,
            () =>
                execute().catch((error) =>
                    this.logger.warn(
                        { error },
                        "[Cron] error while processing cron"
                    )
                ),
            { tz: "UTC" }
        );
        this.cron.unref();

        if (triggerKeys) {
            for (const key of triggerKeys) {
                const handler = () => {
                    this.logger.debug(`[Cron] Event trigger: ${key}`);
                    execute();
                };
                eventEmitter.on(key, handler);
                this.eventCleanups.push(() => eventEmitter.off(key, handler));
            }
        }

        this.logger.info(`[Cron] Started: ${name} (${pattern})`);
    }

    stop() {
        this.cron?.stop();
        this.cron = null;
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
            this.cooldownTimer = null;
        }
        for (const cleanup of this.eventCleanups) cleanup();
        this.eventCleanups.length = 0;
    }
}
