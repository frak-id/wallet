import { eventEmitter, log } from "@backend-infrastructure";
import type { pino } from "@bogeychan/elysia-logger";
import { Cron, type CronOptions } from "croner";
import { Elysia } from "elysia";
import type { FrakEvents } from "../events";

type CronContext = {
    context: {
        logger: pino.Logger;
    };
};

interface CronConfig<Name extends string>
    extends Omit<CronOptions, "context" | "catch" | "protect" | "unref"> {
    /**
     * Input pattern, input date, or input ISO 8601 time string
     *
     * ---
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
    /**
     * Cronjob name to registered to `store`
     */
    name: Name;
    /**
     * Potential event triggers key that could launch this cron
     */
    triggerKeys?: (keyof FrakEvents)[];
    /**
     * Cooldown delay in milliseconds after execution before allowing re-runs
     */
    coolDownInMs?: number;
    /**
     * Function to execute on time
     */
    run: (args: CronContext) => void | Promise<void>;
}

/**
 * Cron with coalescing execution guard — boolean flags (isRunning / hasPending)
 * instead of async-mutex. At most one pending re-run, no unbounded Promise queuing.
 */
export const mutexCron = <Name extends string = string>({
    pattern,
    name,
    run,
    coolDownInMs,
    triggerKeys,
    ...options
}: CronConfig<Name>) =>
    new Elysia({
        name: "@frak-labs/mutex-cron",
        seed: { name },
    }).decorate((decorators) => {
        if (!pattern) throw new Error("pattern is required");
        if (!name) throw new Error("name is required");

        const prevCron =
            (decorators as { cron?: Record<Name, Cron> })?.cron ?? {};

        const logger = log.child({ cron: name });

        const runContext: CronContext = {
            context: { logger },
        };

        let isRunning = false;
        let hasPending = false;
        let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

        async function execute() {
            if (isRunning || cooldownTimer) {
                hasPending = true;
                return;
            }

            isRunning = true;
            try {
                await run(runContext);
            } catch (error) {
                logger.warn({ error }, "[Cron] error while processing");
            } finally {
                isRunning = false;
                Bun.gc(false);
            }

            if (coolDownInMs) {
                cooldownTimer = setTimeout(() => {
                    cooldownTimer = null;
                    if (hasPending) {
                        hasPending = false;
                        execute();
                    }
                }, coolDownInMs);
                cooldownTimer.unref();
            } else if (hasPending) {
                hasPending = false;
                setTimeout(execute, 0);
            }
        }

        const cron = new Cron(
            pattern,
            {
                ...options,
                protect: true,
                unref: true,
                catch: (error, job) =>
                    logger.warn(
                        { error, name: job.name },
                        "[Cron] error while processing cron"
                    ),
            },
            () => execute()
        );

        if (triggerKeys) {
            for (const key of triggerKeys) {
                eventEmitter.on(key, () => {
                    logger.debug(`[Cron] Event trigger: ${key}`);
                    execute();
                });
            }
        }

        return {
            ...decorators,
            cron: {
                ...prevCron,
                [name]: cron,
            } as Record<Name, Cron>,
        };
    });
