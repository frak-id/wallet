import { businessMetrics } from "@backend-infrastructure";
import { RewardConfig } from "../domain/rewards/config";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
        name: "requeueDepletedRewards",
        pattern: RewardConfig.cron.requeueDepleted,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting bank-depleted requeue check");

            const { requeuedCount } =
                await OrchestrationContext.orchestrators.settlement.requeueDepletedRewards();

            businessMetrics.settlementRequeued(requeuedCount);
            if (requeuedCount > 0) {
                logger.info(
                    { requeuedCount },
                    "Requeued bank-depleted rewards after bank refill"
                );
            }
        },
    })
);
