import { migrationConfig, validateConfig } from "./config";
import {
    fetchAllProducts,
    fetchProductAdministrators,
    fetchProductInfo,
    productIdToHex,
} from "./sources/indexer";
import {
    closeMongoConnection,
    fetchAllMongoDBCampaigns,
} from "./sources/mongodb";
import {
    findMerchantByDomain,
    insertCampaignRule,
    insertMerchant,
    insertMerchantAdmin,
} from "./targets/postgres";
import {
    formatAdminForDryRun,
    transformAdministratorsToMerchantAdmins,
} from "./transformers/admins";
import {
    formatCampaignRuleForDryRun,
    transformMongoDBCampaignToRules,
} from "./transformers/campaigns";
import {
    formatMerchantForDryRun,
    transformProductToMerchant,
} from "./transformers/products";
import type {
    MigrationAction,
    MigrationPlan,
    MigrationResult,
    V1IndexerAdministrator,
    V1IndexerProductInfo,
    V1MongoDBCampaign,
} from "./types";

type ProductWithDetails = {
    productInfo: V1IndexerProductInfo;
    administrators: V1IndexerAdministrator[];
};

function log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: unknown
) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] >= levels[migrationConfig.logLevel]) {
        console.log(
            `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`,
            data ?? ""
        );
    }
}

async function fetchAllProductsWithDetails(): Promise<ProductWithDetails[]> {
    log("info", "Fetching all products from indexer...");
    const products = await fetchAllProducts();
    log("info", `Found ${products.length} products`);

    const results: ProductWithDetails[] = [];
    for (const product of products) {
        const productId = productIdToHex(product.id);
        log("debug", `Fetching details for product ${product.domain}`);

        const productInfo = await fetchProductInfo(productId);
        if (!productInfo) {
            log("warn", `Could not fetch product info for ${product.domain}`);
            continue;
        }

        const administrators = await fetchProductAdministrators(productId);
        results.push({ productInfo, administrators });
    }

    return results;
}

function groupCampaignsByProductId(
    campaigns: V1MongoDBCampaign[]
): Map<string, V1MongoDBCampaign[]> {
    const map = new Map<string, V1MongoDBCampaign[]>();
    for (const campaign of campaigns) {
        if (!campaign.productId) continue;
        const existing = map.get(campaign.productId) ?? [];
        existing.push(campaign);
        map.set(campaign.productId, existing);
    }
    return map;
}

function processProduct(
    productInfo: V1IndexerProductInfo,
    administrators: V1IndexerAdministrator[],
    mongoCampaignsByProductId: Map<string, V1MongoDBCampaign[]>,
    plan: MigrationPlan
): void {
    const { actions } = transformProductToMerchant(productInfo, administrators);
    plan.merchants.push(...actions);
    plan.summary.totalMerchants++;

    if (!productInfo.banks.length) plan.summary.totalBanksToDeploy++;

    const owner = administrators.find((a) => a.isOwner);
    if (owner) {
        const { actions: adminActions } =
            transformAdministratorsToMerchantAdmins(
                administrators,
                "PLACEHOLDER",
                owner.user
            );
        plan.admins.push(...adminActions);
        plan.summary.totalAdmins += adminActions.length;
    }

    const productCampaigns = mongoCampaignsByProductId.get(
        productIdToHex(productInfo.product.id)
    );
    if (productCampaigns) {
        for (const campaign of productCampaigns) {
            const { actions: campaignActions } =
                transformMongoDBCampaignToRules(
                    campaign,
                    "PLACEHOLDER",
                    migrationConfig.defaultRewardToken
                );
            plan.campaigns.push(...campaignActions);
            plan.summary.totalCampaignRules += campaignActions.length;
        }
    }
}

async function buildMigrationPlan(): Promise<MigrationPlan> {
    const plan: MigrationPlan = {
        merchants: [],
        admins: [],
        campaigns: [],
        summary: {
            totalMerchants: 0,
            totalBanksToDeploy: 0,
            totalAdmins: 0,
            totalCampaignRules: 0,
        },
    };

    const productsWithDetails = await fetchAllProductsWithDetails();

    log("info", "Fetching MongoDB campaigns...");
    const mongoCampaigns = migrationConfig.mongodbUri
        ? await fetchAllMongoDBCampaigns()
        : [];
    log("info", `Found ${mongoCampaigns.length} MongoDB campaigns`);

    const mongoCampaignsByProductId = groupCampaignsByProductId(mongoCampaigns);

    for (const { productInfo, administrators } of productsWithDetails) {
        try {
            processProduct(
                productInfo,
                administrators,
                mongoCampaignsByProductId,
                plan
            );
        } catch (error) {
            log(
                "error",
                `Failed to process product ${productInfo.product.domain}`,
                error
            );
        }
    }

    return plan;
}

function printDryRunSection(
    title: string,
    actions: MigrationAction[],
    formatter: (action: MigrationAction) => string | null
): void {
    console.log("\n" + "-".repeat(80));
    console.log(title);
    console.log("-".repeat(80));
    for (const action of actions) {
        const output = formatter(action);
        if (output) console.log(output);
    }
}

function printDryRunPlan(plan: MigrationPlan): void {
    console.log("\n" + "=".repeat(80));
    console.log("MIGRATION DRY RUN SUMMARY");
    console.log("=".repeat(80));
    console.log(`\nTotal Merchants to Create: ${plan.summary.totalMerchants}`);
    console.log(`Total Banks to Deploy: ${plan.summary.totalBanksToDeploy}`);
    console.log(`Total Admins to Create: ${plan.summary.totalAdmins}`);
    console.log(
        `Total Campaign Rules to Create: ${plan.summary.totalCampaignRules}`
    );

    printDryRunSection("MERCHANTS", plan.merchants, (a) => {
        if (a.type === "create_merchant")
            return formatMerchantForDryRun(a.data);
        if (a.type === "deploy_bank")
            return `\n  Bank Deployment Required:\n    - Owner Wallet: ${a.ownerWallet}`;
        return null;
    });

    printDryRunSection("ADMINS", plan.admins, (a) =>
        a.type === "create_merchant_admin" ? formatAdminForDryRun(a.data) : null
    );
    printDryRunSection("CAMPAIGN RULES", plan.campaigns, (a) =>
        a.type === "create_campaign_rule"
            ? formatCampaignRuleForDryRun(a.data)
            : null
    );

    console.log("\n" + "=".repeat(80));
    console.log("END OF DRY RUN");
    console.log("=".repeat(80) + "\n");
}

async function executeMerchants(
    actions: MigrationAction[],
    result: MigrationResult,
    idMap: Map<string, string>
): Promise<void> {
    for (const action of actions) {
        if (action.type !== "create_merchant") continue;
        try {
            const existing = await findMerchantByDomain(action.data.domain);
            if (existing) {
                log(
                    "info",
                    `Merchant ${action.data.domain} already exists, skipping`
                );
                idMap.set(action.data.domain, existing.id);
                continue;
            }
            const merchantId = await insertMerchant(action.data);
            idMap.set(action.data.domain, merchantId);
            result.merchantsCreated++;
            log(
                "info",
                `Created merchant ${action.data.domain} with ID ${merchantId}`
            );
        } catch (error) {
            result.errors.push(
                `Failed to create merchant ${action.data.domain}: ${error}`
            );
            log(
                "error",
                `Failed to create merchant ${action.data.domain}`,
                error
            );
        }
    }

    for (const action of actions) {
        if (action.type === "deploy_bank") {
            log(
                "warn",
                `Bank deployment required for owner ${action.ownerWallet} - use CampaignBankService after migration`
            );
        }
    }
}

async function executeAdmins(
    actions: MigrationAction[],
    result: MigrationResult
): Promise<void> {
    for (const action of actions) {
        if (action.type !== "create_merchant_admin") continue;
        try {
            await insertMerchantAdmin(action.data);
            result.adminsCreated++;
            log("info", `Created admin ${action.data.wallet}`);
        } catch (error) {
            result.errors.push(
                `Failed to create admin ${action.data.wallet}: ${error}`
            );
            log("error", `Failed to create admin`, error);
        }
    }
}

async function executeCampaigns(
    actions: MigrationAction[],
    result: MigrationResult
): Promise<void> {
    for (const action of actions) {
        if (action.type !== "create_campaign_rule") continue;
        try {
            await insertCampaignRule(action.data);
            result.campaignRulesCreated++;
            log("info", `Created campaign rule ${action.data.name}`);
        } catch (error) {
            result.errors.push(
                `Failed to create campaign rule ${action.data.name}: ${error}`
            );
            log("error", `Failed to create campaign rule`, error);
        }
    }
}

async function executeMigration(plan: MigrationPlan): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: true,
        merchantsCreated: 0,
        banksDeployed: 0,
        adminsCreated: 0,
        campaignRulesCreated: 0,
        errors: [],
    };
    const merchantIdMap = new Map<string, string>();

    log("info", "Starting migration execution...");
    await executeMerchants(plan.merchants, result, merchantIdMap);
    await executeAdmins(plan.admins, result);
    await executeCampaigns(plan.campaigns, result);

    result.success = result.errors.length === 0;
    return result;
}

function printMigrationResult(result: MigrationResult): void {
    console.log("\n" + "=".repeat(80));
    console.log("MIGRATION RESULT");
    console.log("=".repeat(80));
    console.log(`Success: ${result.success}`);
    console.log(`Merchants Created: ${result.merchantsCreated}`);
    console.log(`Banks Deployed: ${result.banksDeployed}`);
    console.log(`Admins Created: ${result.adminsCreated}`);
    console.log(`Campaign Rules Created: ${result.campaignRulesCreated}`);
    if (result.errors.length > 0) {
        console.log(`\nErrors (${result.errors.length}):`);
        for (const e of result.errors) {
            console.log(`  - ${e}`);
        }
    }
    console.log("=".repeat(80) + "\n");
}

export async function runMigration(): Promise<void> {
    try {
        validateConfig();
        log(
            "info",
            `Running migration in ${migrationConfig.dryRun ? "DRY RUN" : "LIVE"} mode`
        );
        log("info", `Indexer URL: ${migrationConfig.indexerUrl}`);

        const plan = await buildMigrationPlan();

        if (migrationConfig.dryRun) {
            printDryRunPlan(plan);
        } else {
            const result = await executeMigration(plan);
            printMigrationResult(result);
        }
    } catch (error) {
        log("error", "Migration failed", error);
        throw error;
    } finally {
        await closeMongoConnection();
    }
}

if (import.meta.main) {
    runMigration()
        .then(() => {
            console.log("Migration completed");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Migration failed:", error);
            process.exit(1);
        });
}
