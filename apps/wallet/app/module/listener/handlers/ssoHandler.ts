import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { trackAuthCompleted } from "@/module/common/analytics";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import type { WalletRpcContext } from "@/module/listener/types/context";
import type { SdkSession, Session } from "@/types/Session";
import type { SsoRpcSchema } from "@/types/sso-rpc";
import {
    Deferred,
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/rpc";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import type { Hex } from "viem";

type SsoCompleteHandler = RpcPromiseHandler<
    SsoRpcSchema,
    "sso_complete",
    WalletRpcContext
>;

export let pendingSsoRequest: Deferred<{ wallet: Hex }> | undefined = undefined;

export function newPendingSsoRequest(): Deferred<{ wallet: Hex }> {
    pendingSsoRequest = new Deferred();
    return pendingSsoRequest;
}
export function cleanupPendingSsoRequest() {
    pendingSsoRequest = undefined;
}

/**
 * Process SSO completion - shared logic for both RPC and lifecycle handlers
 * Stores session and resolves pending requests
 *
 * @param sessionData - Session data from SSO
 * @param sdkSession - SDK session data
 */
export async function processSsoCompletion(
    sessionData: Session,
    sdkSession: SdkSession
): Promise<void> {
    // Construct full session object
    const session: Session = {
        ...sessionData,
        token: sessionData.token ?? "",
    } as Session;

    try {
        // Save this last authentication
        await jotaiStore.set(addLastAuthenticationAtom, session);

        // Store the session in atoms
        jotaiStore.set(sessionAtom, session);
        jotaiStore.set(sdkSessionAtom, sdkSession);

        // Track successful authentication
        await trackAuthCompleted("sso", session);

        // Resolve pending RPC call if exists
        pendingSsoRequest?.resolve({ wallet: session.address });
        cleanupPendingSsoRequest();

        console.log("[SSO] Authentication completed successfully", {
            address: session.address,
        });
    } catch (error) {
        console.error("[SSO] Error handling completion:", error);

        // Reject pending RPC call on error
        pendingSsoRequest?.reject(
            new FrakRpcError(
                RpcErrorCodes.internalError,
                "Failed to store session after SSO"
            )
        );
        cleanupPendingSsoRequest();

        throw error;
    }
}

/**
 * Handle sso_complete RPC method
 *
 * This is called by the SSO window via RPC instead of custom postMessage.
 * It stores the session and resolves any pending deferred promises.
 *
 * @param params - [session, sdkJwt, ssoId]
 * @param _context - Request context (unused)
 * @returns Promise resolving to { success: true }
 */
export const handleSsoComplete: SsoCompleteHandler = async (
    params,
    _context
) => {
    const [sessionData, sdkSession] = params;

    await processSsoCompletion(sessionData, sdkSession);

    return { success: true };
};
