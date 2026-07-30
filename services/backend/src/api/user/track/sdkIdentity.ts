import { JwtContext } from "@backend-infrastructure";
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
    statusCode: number;
};

type SdkIdentityResult = SdkIdentitySuccess | SdkIdentityError;

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

export async function resolveSdkIdentity(
    params: SdkIdentityParams
): Promise<SdkIdentityResult> {
    const { headers, merchantId } = params;
    const clientId = headers["x-frak-client-id"];
    const walletSdkAuth = headers["x-wallet-sdk-auth"];

    let walletAddress: Address | undefined;
    if (walletSdkAuth) {
        const resolved = await resolveWalletAddress(walletSdkAuth);
        if (!resolved) {
            return {
                success: false,
                error: "Invalid wallet SDK JWT",
                statusCode: 401,
            };
        }
        walletAddress = resolved;
    }

    const identityNodes = buildIdentityNodes({
        walletAddress,
        clientId,
        merchantId,
    });

    if (identityNodes.length === 0) {
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
