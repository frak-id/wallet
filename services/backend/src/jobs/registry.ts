import { log } from "@backend-infrastructure";
import type { MutexCron } from "../utils/mutexCron";

const registry: MutexCron[] = [];

export const CronRegistry = {
    register(cron: MutexCron) {
        registry.push(cron);
    },

    start() {
        log.info(`[CronRegistry] Starting ${registry.length} cron jobs`);
        for (const cron of registry) {
            cron.start();
        }
    },

    stop() {
        for (const cron of registry) {
            cron.stop();
        }
    },
};
