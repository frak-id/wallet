import { useLoserConsent } from "../hook/useLoserConsent";
import { useSwitchAuthenticator } from "../hook/useSwitchAuthenticator";
import type { MergeStrategy } from "./types";

/**
 * Same-device merge strategy: every primitive runs locally on this device.
 * Trivial wrapper over today's hooks — kept as a separate strategy so the
 * remote variant can drop into MergeFlow with the same contract.
 */
export function useLocalMergeStrategy(): MergeStrategy {
    return {
        mode: "local",
        pairingId: undefined,
        useLoserConsent,
        useSwitchToWinner: useSwitchAuthenticator,
    };
}
