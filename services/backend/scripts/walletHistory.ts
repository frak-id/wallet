import { OrchestrationContext } from "../src/orchestration/context";
import { HttpError } from "../src/utils/httpError";

const [query] = process.argv.slice(2);
if (!query) {
    console.error(
        "Usage: bun run scripts/walletHistory.ts <walletAddress|email|identityGroupId>\nAlso on the business dashboard, under Internal > Lookup."
    );
    process.exit(1);
}

let found: Awaited<
    ReturnType<typeof OrchestrationContext.orchestrators.identityLookup.lookup>
>;
try {
    found =
        await OrchestrationContext.orchestrators.identityLookup.lookup(query);
} catch (error) {
    if (!(error instanceof HttpError)) throw error;
    console.error(error.message);
    process.exit(1);
}
if (!found) {
    console.log("No identity found.");
    process.exit(0);
}

const date = (value: Date | null) => value?.toISOString() ?? "?";
const more = (shown: number, total: number) =>
    total > shown ? ` (latest ${shown} of ${total})` : "";

console.log(`\n--- History for ${query} ---\n`);

console.log("=== Identity ===");
for (const group of found.groups) {
    console.log(`Group ID: ${group.id}`);
    console.log(`  Created: ${date(group.createdAt)}`);
    if (group.mergedGroupIds.length > 0) {
        console.log(`  Merged groups: ${group.mergedGroupIds.join(", ")}`);
    }
    console.log(`  Nodes (${group.nodes.length}):`);
    for (const node of group.nodes) {
        console.log(
            `    - [${node.type}] ${node.value} (created: ${date(node.createdAt)}${node.unlinkedAt ? `, unlinked: ${date(node.unlinkedAt)}` : ""})`
        );
    }
}
for (const ig of found.instagram) {
    console.log(
        `  Instagram: @${ig.username ?? "?"} ${ig.level}, follows: ${ig.follows ?? "unknown"}`
    );
}

console.log("\n=== Referrer ===");
if (found.referrers.length === 0) console.log("No referrer found.");
for (const ref of found.referrers) {
    console.log(
        `  Referred by: ${ref.referrerIdentityGroupId} (merchant: ${ref.merchantId ?? "cross-merchant"}, date: ${date(ref.createdAt)}${ref.removedAt ? `, removed: ${ref.endReason}` : ""})`
    );
}

console.log("\n=== Referees ===");
const { referees, interactions, assets } = found;
console.log(
    `  Total referees: ${referees.total}${more(referees.items.length, referees.total)}`
);
for (const ref of referees.items) {
    console.log(
        `    - ${ref.refereeIdentityGroupId} (merchant: ${ref.merchantId ?? "cross-merchant"}, date: ${date(ref.createdAt)})`
    );
}

console.log("\n=== Interactions ===");
console.log(
    `  Total interactions: ${interactions.total}${more(interactions.items.length, interactions.total)}`
);
for (const i of interactions.items) {
    console.log(
        `    - [${i.type}] merchant: ${i.merchantId}, date: ${date(i.createdAt)}, payload: ${JSON.stringify(i.payload)}`
    );
}

console.log("\n=== Asset Logs ===");
console.log(
    `  Total asset logs: ${assets.total}${more(assets.items.length, assets.total)}`
);
for (const a of assets.items) {
    console.log(
        `    - [${a.assetType}] ${a.amount} | status: ${a.status} | recipient: ${a.recipientType} ${a.recipientWallet ?? ""} | merchant: ${a.merchantId} | date: ${date(a.createdAt)}${a.onchainTxHash ? ` | tx: ${a.onchainTxHash}` : ""}`
    );
}

console.log("\n--- Done ---\n");
process.exit(0);
