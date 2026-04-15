import { eventEmitter, log } from "@backend-infrastructure";
import type { pino } from "@bogeychan/elysia-logger";
import { Cron } from "croner";
import type { FrakEvents } from "./events";

type CronContext = {
    context: {
        logger: pino.Logger;
    };
};

type MutexCronConfig = {
    name: string;
    /**
     * ```plain
     * ┌────────────── second (optional)
     * │ ┌──────────── minute
     * │ │ ┌────────── hour
     * │ │ │ ┌──────── day of month
     * │ │ │ │ ┌────── month
     * │ │ │ │ │ ┌──── day of week
     * │ │ │ │ │ │
     * * * * * * *
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
    private cron: Cron | null = null;
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
                return;
            }

            this.isRunning = true;
            try {
                await run(runContext);
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

        this.cron = new Cron(
            pattern,
            {
                protect: true,
                unref: true,
                catch: (error, job) =>
                    this.logger.warn(
                        { error, name: job.name },
                        "[Cron] error while processing cron"
                    ),
            },
            () => execute()
        );

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
