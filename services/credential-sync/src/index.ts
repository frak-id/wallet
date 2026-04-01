import { runBidirectionalSync } from "./sync";

const startTime = performance.now();
console.log(`[credential-sync] Starting bidirectional sync...`);

const result = await runBidirectionalSync();

const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
console.log(
    `[credential-sync] Completed in ${elapsed}s — MongoDB→sqld: ${result.mongoToSqld} new, sqld→MongoDB: ${result.sqldToMongo} new`
);

process.exit(0);
