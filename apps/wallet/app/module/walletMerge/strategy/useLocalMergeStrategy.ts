import { useLoserConsent } from "../hook/useLoserConsent";
import { useMigrateLoserAssets } from "../hook/useMigrateLoserAssets";
import { useSendAddPassKeyTx } from "../hook/useSendAddPassKeyTx";
import type { MergeStrategy } from "./types";

/**
 * Same-device merge strategy: every primitive runs locally on this device.
 * Both passkeys (winner + loser) are physically resident here, so all
 * three mutations build their bundler clients with `transport: "local"`
 * and prompt biometrics through the device's WebAuthn ceremony.
 *
 * Calls the underlying mutation hooks here so the returned strategy holds
 * ready-to-use mutation objects — matches the contract enforced by
 * `MergeStrategy` (see the rules-of-hooks note in `types.ts`).
 */
export function useLocalMergeStrategy(): MergeStrategy {
    const loserConsent = useLoserConsent();
    const sendAddPassKey = useSendAddPassKeyTx({ transport: "local" });
    const migrateLoserAssets = useMigrateLoserAssets({ transport: "local" });
    return {
        mode: "local",
        pairingId: undefined,
        loserConsent,
        sendAddPassKey,
        migrateLoserAssets,
    };
}
