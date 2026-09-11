import { useLoserConsent } from "../hook/useLoserConsent";
import { useMigrateLoserAssets } from "../hook/useMigrateLoserAssets";
import { useSendAddPassKeyTx } from "../hook/useSendAddPassKeyTx";
import type { MergeStrategy } from "./types";

/**
 * Same-device merge strategy: both passkeys are resident here, so every
 * mutation builds its bundler client with `transport: "local"`.
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
