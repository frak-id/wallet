import { BillingConfig } from "../domain/billing/config";
import { tryWithAdvisoryLock } from "../infrastructure/persistence/postgres";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

/**
 * Advisory-lock key serializing the monthly-bill sweep across replicas. The
 * generation is already idempotent (the `(merchant_id, period_start)` unique
 * constraint is the real guard), so this is purely a load optimisation: it
 * stops every replica from iterating every merchant at 4am and doing the same
 * no-op work in parallel.
 */
const MONTHLY_BILL_ADVISORY_LOCK_KEY = 0xb111;

CronRegistry.register(
    new MutexCron({
        name: "generateMonthlyBills",
        pattern: BillingConfig.cron.monthlyBillGeneration,
        triggerKeys: ["newDeposit"],
        coolDownInMs: 30_000,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting monthly-bill generation job");

            const outcome = await tryWithAdvisoryLock(
                MONTHLY_BILL_ADVISORY_LOCK_KEY,
                () =>
                    OrchestrationContext.orchestrators.monthlyBill.backfillAllMerchantBills(),
                "monthlyBillGeneration"
            );

            if (!outcome.ran) {
                logger.info(
                    "Monthly-bill generation skipped — another replica holds the lock"
                );
                return;
            }

            logger.info(outcome.result, "Monthly-bill generation job completed");
        },
    })
);
