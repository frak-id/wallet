import { log } from "@backend-common";
import { Mutex } from "async-mutex";
import { Cron, type CronOptions } from "croner";
import { Elysia } from "elysia";
import { sleep } from "radash";

export interface CronConfig<Name extends string = string> extends CronOptions {
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
     * Skip the execution if the mutex is locked?
     */
    skipIfLocked?: boolean;
    /**
     * Cooldown delay in milliseconds post mutex execution
     */
    coolDownInMs?: number;
    /**
     * Function to execute on time
     */
    run: () => void | Promise<void>;
}

/**
 * Cron wrapped around an async mutex
 * @param pattern
 * @param name
 * @param run
 * @param skipIfLocked
 * @param coolDownInMs
 * @param options
 */
export const mutexCron = <Name extends string = string>({
    pattern,
    name,
    run,
    skipIfLocked,
    coolDownInMs,
    ...options
}: CronConfig<Name>) =>
    new Elysia({
        name: "@frak-labs/mutex-cron",
        seed: {
            name,
        },
    }).state((store) => {
        if (!pattern) throw new Error("pattern is required");
        if (!name) throw new Error("name is required");

        // Get our previous stuff
        const prevCron = (store as { cron?: Record<Name, Cron> })?.cron ?? {};
        const prevMutex =
            (store as { mutex?: Record<Name, Cron> })?.mutex ?? {};

        // The mutex we will use
        const mutex = new Mutex();

        const logger = log.child({ cron: name });

        // And the cron
        const cron = new Cron(pattern, options, async () => {
            if (skipIfLocked && mutex.isLocked()) {
                logger.debug(`Skipping cron ${name} because it is locked`);
            }
            // Run exclusively the cron
            await mutex.runExclusive(async () => {
                // Perform the run
                await run();
                // If we got an interval, waiting for it before releasing the mutex
                if (coolDownInMs) {
                    logger.debug(
                        `Waiting ${coolDownInMs}ms before releasing the mutex`
                    );
                    await sleep(coolDownInMs);
                }
            });
        });

        return {
            cron: {
                ...prevCron,
                [name]: cron,
            } as Record<Name, Cron>,
            mutex: {
                ...prevMutex,
                [name]: mutex,
            } as Record<Name, Mutex>,
        };
    });
