import { eventsContext, log } from "@backend-common";
import type { pino } from "@bogeychan/elysia-logger";
import { Mutex } from "async-mutex";
import { Cron, type CronOptions } from "croner";
import { Elysia } from "elysia";
import { sleep } from "radash";
import type { FrakEvents } from "../events";

type CronContext = Cron & {
    context: {
        logger: pino.Logger;
    };
};

export interface CronConfig<Name extends string>
    extends Omit<CronOptions, "context" | "catch" | "protect"> {
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
    run: (args: CronContext) => void | Promise<void>;
}

/**
 * Cron wrapped around an async mutex
 * @param pattern
 * @param name
 * @param run
 * @param skipIfLocked
 * @param coolDownInMs
 * @param triggerKeys
 * @param options
 */
export const mutexCron = <Name extends string = string>({
    pattern,
    name,
    run,
    skipIfLocked,
    coolDownInMs,
    triggerKeys,
    ...options
}: CronConfig<Name>) =>
    new Elysia({
        name: "@frak-labs/mutex-cron",
        seed: { name },
    })
        .use(eventsContext)
        .decorate((decorators) => {
            if (!pattern) throw new Error("pattern is required");
            if (!name) throw new Error("name is required");

            // Get our previous stuff
            const prevCron =
                (decorators as { cron?: Record<Name, Cron> })?.cron ?? {};
            const prevMutex =
                (decorators as { mutex?: Record<Name, Cron> })?.mutex ?? {};

            // The mutex we will use
            const mutex = new Mutex();

            // And our logger
            const logger = log.child({ cron: name });

            // Add the current app decorators to the cron context
            const finalOptions: CronOptions = {
                ...options,
                context: {
                    decorators,
                    logger,
                },
                catch: (error) =>
                    logger.warn(
                        { error },
                        "[Cron] error while processing cron"
                    ),
            };

            // And the cron
            const cron = new Cron(
                pattern,
                finalOptions,
                async (args: { options: CronContext }) => {
                    if (skipIfLocked && mutex.isLocked()) {
                        logger.debug(
                            `[Cron] Skipping cron because it's locked`
                        );
                        return;
                    }
                    // Run exclusively the cron
                    await mutex.runExclusive(async () => {
                        // Perform the run
                        await run(args.options);
                        // If we got an interval, waiting for it before releasing the mutex
                        if (coolDownInMs) {
                            logger.debug(
                                `[Cron] Waiting ${coolDownInMs}ms before releasing the mutex`
                            );
                            await sleep(coolDownInMs);
                        }
                    });
                }
            );

            // If got a trigger key, listen to it
            if (triggerKeys) {
                for (const key of triggerKeys) {
                    decorators.emitter.on(key, () => {
                        logger.debug(`[Cron] Event trigger: ${key}`);
                        cron.trigger().then(() => {
                            logger.debug(`[Cron] Event trigger end: ${key}`);
                        });
                    });
                }
            }

            return {
                ...decorators,
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
