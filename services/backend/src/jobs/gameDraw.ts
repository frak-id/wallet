import { tryWithAdvisoryLock } from "../infrastructure/persistence/postgres";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

/** One pass at a time, so a freeze or a beacon is recorded and announced once. */
const GAME_DRAW_ADVISORY_LOCK_KEY = 0x6a3ed5;

CronRegistry.register(
    new MutexCron({
        name: "gameDraws",
        // A beacon lands 10 min after the freeze, so a draw waits 15 min at most.
        pattern: "*/5 * * * *",
        run: async ({ context: { logger } }) => {
            const outcome = await tryWithAdvisoryLock(
                GAME_DRAW_ADVISORY_LOCK_KEY,
                () => OrchestrationContext.orchestrators.gameDraw.runDue(),
                "gameDraws"
            );
            if (
                outcome.ran &&
                (outcome.result.frozen || outcome.result.drawn)
            ) {
                logger.info(outcome.result, "Game draws advanced");
            }
        },
    })
);
