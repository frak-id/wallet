/**
 * Bridge utilities to access wallet-shared Jotai atoms from Zustand stores
 * This temporary bridge will be removed once wallet-shared is migrated to Zustand
 */

import { jotaiStore } from "@frak-labs/ui/atoms/store";
import {
    sdkSessionAtom,
    sessionAtom,
} from "@frak-labs/wallet-shared/common/atoms/session";
import { interactionSessionAtom } from "@frak-labs/wallet-shared/wallet/atoms/interactionSession";

/**
 * Get the current wallet session from wallet-shared
 * Used to maintain compatibility with wallet-shared Jotai atoms during migration
 */
export function getSharedSession() {
    return jotaiStore.get(sessionAtom);
}

/**
 * Get the current SDK session from wallet-shared
 * Used to maintain compatibility with wallet-shared Jotai atoms during migration
 */
export function getSharedSdkSession() {
    return jotaiStore.get(sdkSessionAtom);
}

/**
 * Get the current interaction session from wallet-shared
 * Used to maintain compatibility with wallet-shared Jotai atoms during migration
 */
export function getSharedInteractionSession() {
    return jotaiStore.get(interactionSessionAtom);
}
