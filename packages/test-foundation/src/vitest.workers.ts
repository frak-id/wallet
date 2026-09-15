import * as os from "node:os";

/**
 * Worker count for every vitest project. Vitest refuses to schedule
 * projects whose `maxWorkers` differ, so the shared config and the
 * standalone `scripts/vitest.config.ts` must both read this one value.
 *
 * CI takes every core but one. Locally, half: on an 8-thread laptop
 * 7 jsdom workers saturate the machine for the whole run.
 */
export const maxWorkers = process.env.CI
    ? Math.max(1, os.availableParallelism() - 1)
    : Math.max(1, Math.ceil(os.availableParallelism() / 2));
