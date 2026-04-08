import { isAddress } from "viem";
import { merchantAdminsTable } from "../src/domain/merchant/db/schema";
import { db } from "../src/infrastructure/persistence/postgres";

const [walletAddress, merchantId] = process.argv.slice(2);

if (!walletAddress || !merchantId) {
    console.error(
        "Usage: bun run scripts/addMerchantAdmin.ts <walletAddress> <merchantId>"
    );
    process.exit(1);
}

if (!isAddress(walletAddress)) {
    console.error(`Invalid wallet address: ${walletAddress}`);
    process.exit(1);
}

console.log(`Adding admin ${walletAddress} to merchant ${merchantId}...`);

const result = await db
    .insert(merchantAdminsTable)
    .values({
        merchantId,
        wallet: walletAddress,
        addedBy: walletAddress,
    })
    .onConflictDoNothing()
    .returning({ id: merchantAdminsTable.id });

if (result.length === 0) {
    console.log("Admin already exists for this merchant, no changes made.");
} else {
    console.log(`Admin added successfully (id: ${result[0].id}).`);
}

process.exit(0);
