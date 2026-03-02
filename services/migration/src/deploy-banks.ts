import { CampaignBankContext } from "@backend/domain/campaign-bank";
import { merchantsTable } from "@backend/domain/merchant/db/schema";
import { db } from "@backend/infrastructure/persistence/postgres";
import { isNull } from "drizzle-orm";

const dryRun = process.env.DRY_RUN !== "false";

type DeployResult = {
    deployed: number;
    skipped: number;
    failed: number;
    errors: string[];
};

async function fetchMerchantsWithoutBank(): Promise<
    { id: string; domain: string; name: string }[]
> {
    return db.query.merchantsTable.findMany({
        where: isNull(merchantsTable.bankAddress),
        columns: { id: true, domain: true, name: true },
    });
}

async function deployBanks(): Promise<void> {
    console.log(
        `[deploy-banks] Running in ${dryRun ? "DRY RUN" : "LIVE"} mode`
    );

    const merchants = await fetchMerchantsWithoutBank();
    console.log(
        `[deploy-banks] Found ${merchants.length} merchants without a bank`
    );

    if (merchants.length === 0) {
        console.log("[deploy-banks] Nothing to do");
        return;
    }

    const result: DeployResult = {
        deployed: 0,
        skipped: 0,
        failed: 0,
        errors: [],
    };

    for (const merchant of merchants) {
        if (dryRun) {
            console.log(
                `[dry-run] Would deploy bank for ${merchant.name} (${merchant.domain}) [${merchant.id}]`
            );
            result.skipped++;
            continue;
        }

        console.log(
            `[deploy-banks] Deploying bank for ${merchant.name} (${merchant.domain})...`
        );

        const deployResult =
            await CampaignBankContext.services.campaignBank.deployAndSetupBank(
                merchant.id
            );

        if (deployResult.success) {
            console.log(
                `[deploy-banks] ✓ Bank deployed for ${merchant.name}: ${deployResult.bankAddress}`
            );
            result.deployed++;
        } else {
            console.error(
                `[deploy-banks] ✗ Failed for ${merchant.name}: ${deployResult.error}`
            );
            result.failed++;
            result.errors.push(
                `${merchant.name} (${merchant.domain}): ${deployResult.error}`
            );
        }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`BANK DEPLOYMENT RESULT ${dryRun ? "(DRY RUN)" : "(LIVE)"}`);
    console.log("=".repeat(60));
    console.log(`Total merchants without bank: ${merchants.length}`);
    console.log(`Deployed: ${result.deployed}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Failed: ${result.failed}`);
    if (result.errors.length > 0) {
        console.log(`\nErrors (${result.errors.length}):`);
        for (const e of result.errors) {
            console.log(`  - ${e}`);
        }
    }
    console.log(`${"=".repeat(60)}\n`);
}

if (import.meta.main) {
    deployBanks()
        .then(() => {
            console.log("[deploy-banks] Done");
            process.exit(0);
        })
        .catch((error) => {
            console.error("[deploy-banks] Failed:", error);
            process.exit(1);
        });
}
