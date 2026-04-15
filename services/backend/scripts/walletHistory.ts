import { and, eq, inArray } from "drizzle-orm";
import { isAddress } from "viem";
import { referralLinksTable } from "../src/domain/attribution/db/schema";
import {
    identityGroupsTable,
    identityNodesTable,
} from "../src/domain/identity/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../src/domain/rewards/db/schema";
import { db } from "../src/infrastructure/persistence/postgres";

const [walletAddress] = process.argv.slice(2);

if (!walletAddress) {
    console.error("Usage: bun run scripts/walletHistory.ts <walletAddress>");
    process.exit(1);
}

if (!isAddress(walletAddress)) {
    console.error(`Invalid wallet address: ${walletAddress}`);
    process.exit(1);
}

console.log(`\n--- Wallet History for ${walletAddress} ---\n`);

// 1. Resolve wallet to identity group(s)
const nodes = await db
    .select()
    .from(identityNodesTable)
    .where(
        and(
            eq(identityNodesTable.identityType, "wallet"),
            eq(identityNodesTable.identityValue, walletAddress.toLowerCase())
        )
    );

if (nodes.length === 0) {
    console.log("No identity found for this wallet address.");
    process.exit(0);
}

const groupIds = [...new Set(nodes.map((n) => n.groupId))];

// 2. Identity group + all identity nodes
console.log("=== Identity ===");
for (const groupId of groupIds) {
    const group = await db
        .select()
        .from(identityGroupsTable)
        .where(eq(identityGroupsTable.id, groupId))
        .then((r) => r[0]);

    console.log(`Group ID: ${groupId}`);
    console.log(`  Created: ${group?.createdAt}`);
    if (group?.mergedGroups?.length) {
        console.log(`  Merged groups: ${JSON.stringify(group.mergedGroups)}`);
    }

    const allNodes = await db
        .select()
        .from(identityNodesTable)
        .where(eq(identityNodesTable.groupId, groupId));

    console.log(`  Nodes (${allNodes.length}):`);
    for (const node of allNodes) {
        console.log(
            `    - [${node.identityType}] ${node.identityValue} (created: ${node.createdAt})`
        );
    }
}

// 3. Referrer (who referred this wallet)
console.log("\n=== Referrer ===");
const referrers = await db
    .select()
    .from(referralLinksTable)
    .where(inArray(referralLinksTable.refereeIdentityGroupId, groupIds));

if (referrers.length === 0) {
    console.log("No referrer found.");
} else {
    for (const ref of referrers) {
        console.log(
            `  Referred by: ${ref.referrerIdentityGroupId} (merchant: ${ref.merchantId}, date: ${ref.createdAt})`
        );
    }
}

// 4. Referees (who this wallet referred)
console.log("\n=== Referees ===");
const referees = await db
    .select()
    .from(referralLinksTable)
    .where(inArray(referralLinksTable.referrerIdentityGroupId, groupIds));

if (referees.length === 0) {
    console.log("No referees found.");
} else {
    console.log(`  Total referees: ${referees.length}`);
    for (const ref of referees) {
        console.log(
            `    - ${ref.refereeIdentityGroupId} (merchant: ${ref.merchantId}, date: ${ref.createdAt})`
        );
    }
}

// 5. Interactions
console.log("\n=== Interactions ===");
const interactions = await db
    .select()
    .from(interactionLogsTable)
    .where(inArray(interactionLogsTable.identityGroupId, groupIds))
    .orderBy(interactionLogsTable.createdAt);

if (interactions.length === 0) {
    console.log("No interactions found.");
} else {
    console.log(`  Total interactions: ${interactions.length}`);
    for (const i of interactions) {
        console.log(
            `    - [${i.type}] merchant: ${i.merchantId}, date: ${i.createdAt}, payload: ${JSON.stringify(i.payload)}`
        );
    }
}

// 6. Asset logs
console.log("\n=== Asset Logs ===");
const assets = await db
    .select()
    .from(assetLogsTable)
    .where(inArray(assetLogsTable.identityGroupId, groupIds))
    .orderBy(assetLogsTable.createdAt);

if (assets.length === 0) {
    console.log("No asset logs found.");
} else {
    console.log(`  Total asset logs: ${assets.length}`);
    for (const a of assets) {
        console.log(
            `    - [${a.assetType}] ${a.amount} | status: ${a.status} | recipient: ${a.recipientType} ${a.recipientWallet ?? ""} | merchant: ${a.merchantId} | date: ${a.createdAt}${a.onchainTxHash ? ` | tx: ${a.onchainTxHash}` : ""}`
        );
    }
}

console.log("\n--- Done ---\n");
process.exit(0);
