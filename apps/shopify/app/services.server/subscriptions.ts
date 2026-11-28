import type { AuthenticatedContext } from "../types/context";
import { backendApi } from "../utils/backendApi";
import { buildBackendHeaders } from "./backendMerchant";
import { levelForStatus, log } from "./logger";
import { resolveMerchantId } from "./merchant";

export type SubscriptionProvider = "recharge";

export type SubscriptionStatus = {
    provider: SubscriptionProvider | null;
    lastError: { at: string } | null;
};

export type ConnectSubscriptionResult =
    | "connected"
    | "invalid_token"
    | "webhook_missing"
    | "unavailable"
    | "failed";

function resultForStatus(status: number): ConnectSubscriptionResult {
    switch (status) {
        case 400:
            return "invalid_token";
        case 409:
            return "webhook_missing";
        case 502:
            return "unavailable";
        default:
            return "failed";
    }
}

export async function getSubscriptionStatus(
    context: AuthenticatedContext,
    request: Request
): Promise<SubscriptionStatus | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .subscriptions.get({ headers: buildBackendHeaders(request) });
        if (error) {
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "subscription status fetch failed"
            );
            return null;
        }
        return data;
    } catch (error) {
        log.error({ err: error, merchantId }, "subscription status error");
        return null;
    }
}

export async function connectSubscriptionProvider(
    context: AuthenticatedContext,
    request: Request,
    params: { provider: SubscriptionProvider; token: string }
): Promise<ConnectSubscriptionResult> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return "failed";
    }

    try {
        const { error } = await backendApi.business
            .merchant({ merchantId })
            .subscriptions.put(params, {
                headers: buildBackendHeaders(request),
            });
        if (error) {
            log[levelForStatus(error.status)](
                { merchantId, provider: params.provider, status: error.status },
                "subscription connect failed"
            );
            return resultForStatus(error.status);
        }
        return "connected";
    } catch (error) {
        log.error(
            { err: error, merchantId, provider: params.provider },
            "subscription connect error"
        );
        return "failed";
    }
}

export async function disconnectSubscriptionProvider(
    context: AuthenticatedContext,
    request: Request
): Promise<boolean> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return false;
    }

    try {
        const { error } = await backendApi.business
            .merchant({ merchantId })
            .subscriptions.delete({ headers: buildBackendHeaders(request) });
        if (error) {
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "subscription disconnect failed"
            );
            return false;
        }
        return true;
    } catch (error) {
        log.error({ err: error, merchantId }, "subscription disconnect error");
        return false;
    }
}
