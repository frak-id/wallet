import { log } from "@backend-infrastructure/external/logger";

const RECHARGE_URL = "https://api.rechargeapps.com";
export const RECHARGE_API_VERSION = "2021-11";
const TIMEOUT_MS = 8_000;

export type RechargeLineItem = {
    purchase_item_id: number | string;
    purchase_item_type: string;
    quantity?: number;
    total_price?: string;
};

export type RechargeOrder = {
    id: number;
    type: string;
    is_prepaid?: boolean;
    status?: string;
    subtotal_price?: string;
    total_price?: string;
    line_items?: RechargeLineItem[];
};

export type RechargeSubscription = {
    id: number;
    order_interval_frequency?: number | string;
    charge_interval_frequency?: number | string;
};

export type RechargeLookup<T> =
    | { kind: "found"; value: T }
    | { kind: "missing" }
    | { kind: "unauthorized" }
    | { kind: "unavailable" };

/** Recharge API v2 (`2021-11`), read-only, authenticated by the merchant's own token. */
export class RechargeClient {
    constructor(private readonly baseUrl: string = RECHARGE_URL) {}

    /** Whether the token can read orders: the cheapest call that needs `read_orders`. */
    async checkToken(
        token: string
    ): Promise<"valid" | "unauthorized" | "unavailable"> {
        const response = await this.get("/orders?limit=1", token);
        if (!response) return "unavailable";
        if (response.status === 401 || response.status === 403) {
            return "unauthorized";
        }
        return response.ok ? "valid" : "unavailable";
    }

    async findOrderByExternalId(
        externalOrderId: string,
        token: string
    ): Promise<RechargeLookup<RechargeOrder>> {
        const query = new URLSearchParams({
            external_order_id: externalOrderId,
            limit: "5",
        });
        const body = await this.read<{ orders?: RechargeOrder[] }>(
            `/orders?${query}`,
            token
        );
        if (body.kind !== "found") return body;
        const order = body.value.orders?.[0];
        return order ? { kind: "found", value: order } : { kind: "missing" };
    }

    async getSubscription(
        subscriptionId: string,
        token: string
    ): Promise<RechargeLookup<RechargeSubscription>> {
        const body = await this.read<{ subscription?: RechargeSubscription }>(
            `/subscriptions/${encodeURIComponent(subscriptionId)}`,
            token
        );
        if (body.kind !== "found") return body;
        return body.value.subscription
            ? { kind: "found", value: body.value.subscription }
            : { kind: "missing" };
    }

    private async read<T>(
        path: string,
        token: string
    ): Promise<RechargeLookup<T>> {
        const response = await this.get(path, token);
        if (!response) return { kind: "unavailable" };
        if (response.status === 401 || response.status === 403) {
            return { kind: "unauthorized" };
        }
        if (response.status === 404) return { kind: "missing" };
        if (!response.ok) {
            log.warn({ status: response.status, path }, "Recharge call failed");
            return { kind: "unavailable" };
        }
        const value = (await response.json().catch(() => null)) as T | null;
        return value ? { kind: "found", value } : { kind: "unavailable" };
    }

    private get(path: string, token: string): Promise<Response | null> {
        return fetch(`${this.baseUrl}${path}`, {
            headers: {
                "X-Recharge-Access-Token": token,
                "X-Recharge-Version": RECHARGE_API_VERSION,
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        }).catch((err: unknown) => {
            log.warn({ err }, "Recharge unreachable");
            return null;
        });
    }
}
