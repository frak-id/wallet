import { useLoserConsent } from "../hook/useLoserConsent";
import { useSwitchAuthenticator } from "../hook/useSwitchAuthenticator";
import type { MergeStrategy } from "./types";

/**
 * Same-device merge strategy: every primitive runs locally on this device.
 * Calls the underlying mutation hooks here so the returned strategy holds
 * ready-to-use mutation objects — matches the contract enforced by
 * `MergeStrategy` (see the rules-of-hooks note in `types.ts`).
 */
export function useLocalMergeStrategy(): MergeStrategy {
    const loserConsent = useLoserConsent();
    const switchToWinner = useSwitchAuthenticator();
    return {
        mode: "local",
        pairingId: undefined,
        loserConsent,
        switchToWinner,
    };
}
