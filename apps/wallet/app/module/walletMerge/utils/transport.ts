/**
 * Transport contract shared by every per-mutation merge hook
 * (`useSendAddPassKeyTx`, `useMigrateLoserAssets`). The paired variant
 * ALWAYS carries the `ensurePairing` callback so the gate below is a
 * static guarantee — no runtime "is it provided?" check, no
 * `MERGE_*_MISSING_PAIRING_SETUP` error.
 *
 * The strategy decides which variant to pass per mutation:
 *  - same-device merge → `{ transport: "local" }` for everything.
 *  - cross-device, desktop=winner → addPassKey local, migrate paired.
 *  - cross-device, desktop=loser  → addPassKey paired, migrate local.
 */
export type MergeTransport =
    | { transport: "local" }
    | { transport: "paired"; ensurePairing: () => Promise<void> };

/**
 * Awaits the pairing-readiness gate when transport is paired; no-op
 * for local. Called by every merge mutation that signs through either
 * channel, immediately before {@link buildMergeBundlerClient} so the
 * bundler is only constructed against a live WS.
 */
export async function gatePairing(args: MergeTransport): Promise<void> {
    if (args.transport === "paired") {
        await args.ensurePairing();
    }
}
