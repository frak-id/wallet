import { JwtContext, log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import type { Address } from "viem";
import { OrchestrationContext } from "../../../orchestration/context";
import type { IdentityNode } from "../../../orchestration/identity";

export const sdkIdentityHeaderSchema = t.Partial(
    t.Object({
        "x-frak-client-id": t.String(),
        "x-wallet-sdk-auth": t.String(),
    })
);

type SdkIdentityHeaders = {
    "x-frak-client-id"?: string;
    "x-wallet-sdk-auth"?: string;
};

type SdkIdentityParams = {
    headers: SdkIdentityHeaders;
    merchantId?: string;
};

type SdkIdentitySuccess = {
    success: true;
    identityGroupId: string;
    walletAddress?: Address;
};

type SdkIdentityError = {
    success: false;
    error: string;
    // Literal union, not `number`: routes declare per-status `response`
    // schemas, and Elysia can only match `status(code, …)` to one of them
    // when the code narrows to the declared literals.
    statusCode: 400 | 401;
};

type SdkIdentityResult = SdkIdentitySuccess | SdkIdentityError;

type SdkIdentityNodesSuccess = {
    success: true;
    identityNodes: IdentityNode[];
    walletAddress?: Address;
};

type SdkIdentityNodesResult = SdkIdentityNodesSuccess | SdkIdentityError;

/**
 * Resolve the caller's wallet address from a `x-wallet-sdk-auth` JWT.
 * A signed `JwtContext.walletSdk` token is the only accepted form —
 * a raw hex address is never trusted as proof of wallet identity.
 */
export async function resolveWalletAddress(
    walletSdkAuth: string
): Promise<Address | null> {
    const session = await JwtContext.walletSdk.verify(walletSdkAuth);
    if (!session) {
        return null;
    }
    return session.address;
}

export function buildIdentityNodes(params: {
    walletAddress?: Address;
    clientId?: string;
    merchantId?: string;
}): IdentityNode[] {
    const nodes: IdentityNode[] = [];

    if (params.walletAddress) {
        nodes.push({ type: "wallet", value: params.walletAddress });
    }

    if (params.clientId && params.merchantId) {
        nodes.push({
            type: "anonymous_fingerprint",
            value: params.clientId,
            merchantId: params.merchantId,
        });
    }

    return nodes;
}

/**
 * Turn raw SDK headers into the identity nodes to attribute against.
 *
 * An unverifiable wallet JWT (expired — 1 day TTL — or signed with a rotated
 * secret) only means "no proven wallet identity", not "bad request". The SDK
 * caches this token client-side, so a stale one is routine. We degrade to
 * anonymous attribution instead of failing the whole call: the wallet stays
 * untrusted either way, and an `x-frak-client-id` is a complete identity on
 * its own. The 401 is kept only for the case where the rejected JWT was the
 * sole identity offered.
 *
 * Shared by every SDK-facing `track/*` route so the rule cannot drift.
 */
export async function resolveSdkIdentityNodes(
    params: SdkIdentityParams
): Promise<SdkIdentityNodesResult> {
    const { headers, merchantId } = params;
    const clientId = headers["x-frak-client-id"];
    const walletSdkAuth = headers["x-wallet-sdk-auth"];

    let walletAddress: Address | undefined;
    let walletAuthRejected = false;
    if (walletSdkAuth) {
        const resolved = await resolveWalletAddress(walletSdkAuth);
        if (resolved) {
            walletAddress = resolved;
        } else {
            walletAuthRejected = true;
        }
    }

    const identityNodes = buildIdentityNodes({
        walletAddress,
        clientId,
        merchantId,
    });

    if (identityNodes.length === 0) {
        // No anonymous fallback available, so the rejected wallet JWT was the
        // only identity on offer — now it is worth a 401.
        if (walletAuthRejected) {
            return {
                success: false,
                error: "Invalid wallet SDK JWT",
                statusCode: 401,
            };
        }
        if (clientId && !merchantId) {
            return {
                success: false,
                error: "merchantId required when using x-frak-client-id",
                statusCode: 400,
            };
        }
        return {
            success: false,
            error: "x-frak-client-id or x-wallet-sdk-auth header required",
            statusCode: 401,
        };
    }

    if (walletAuthRejected) {
        log.debug(
            { merchantId },
            "Unverifiable x-wallet-sdk-auth, attributing to anonymous identity"
        );
    }

    return { success: true, identityNodes, walletAddress };
}

export async function resolveSdkIdentity(
    params: SdkIdentityParams
): Promise<SdkIdentityResult> {
    const nodesResult = await resolveSdkIdentityNodes(params);
    if (!nodesResult.success) {
        return nodesResult;
    }

    const { identityNodes, walletAddress } = nodesResult;

    // Never merge identity groups from an unauthenticated track/* call —
    // attribute to the anchor group (wallet's, when present) only.
    const { groupId } =
        await OrchestrationContext.orchestrators.identity.resolveForAttribution(
            identityNodes
        );

    return {
        success: true,
        identityGroupId: groupId,
        walletAddress,
    };
}
