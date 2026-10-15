import type { QueryClient } from "@tanstack/react-query";
import { moneriumFlowStore } from "@/module/monerium/store/moneriumFlowStore";
import { moneriumKey } from "../queryKeys/monerium";
import { getMoneriumErrorCode } from "./moneriumErrors";

const STATE_CHANGED_CODES = new Set([
    "MONERIUM_REAUTH_REQUIRED",
    "MONERIUM_NOT_CONNECTED",
    "MONERIUM_PROFILE_NOT_APPROVED",
    "MONERIUM_WALLET_NOT_LINKED",
]);

/** These codes mean the backend moved the connection: refetch it and leave the transfer screens. */
export function refreshStatusOnStateChange(
    error: unknown,
    client: QueryClient
): void {
    const code = getMoneriumErrorCode(error);
    if (!code || !STATE_CHANGED_CODES.has(code)) return;
    moneriumFlowStore.getState().resetTransfer();
    client.invalidateQueries({ queryKey: moneriumKey.status });
}
