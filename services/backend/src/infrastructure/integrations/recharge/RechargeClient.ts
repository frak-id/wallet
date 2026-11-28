import { createHash } from "node:crypto";
import { log } from "@backend-infrastructure/external/logger";

const RECHARGE_URL = "https://api.rechargeapps.com";
const RECHARGE_API_VERSION = "2021-11";
const TIMEOUT_MS = 8_000;
/** Recharge leaks 2 calls per second from a 40-call bucket per token. */
const MIN_CALL_INTERVAL_MS = 500;
/** Recharge asks for at least 2 seconds before retrying a throttled call. */
const DEFAULT_RETRY_AFTER_MS = 2_000;

type RechargeLineItem = {
    purchase_item_id: number | string;
    purchase_item_type: string;
};

export type RechargeOrder = {
    id: number;
    type: string;
    is_prepaid?: boolean;
    subtotal_price?: string;
    line_items?: RechargeLineItem[];
};

type RechargeSubscription = {
    id: number;
    order_interval_frequency?: number | string;
    charge_interval_frequency?: number | string;
};

export type RechargeLookup<T> =
    | { kind: "found"; value: T }
    | { kind: "missing" }
    | { kind: "unauthorized" }
    | { kind: "rate_limited"; retryAfterMs: number }
    | { kind: "unavailable" };

function retryAfterMs(response: Response): number {
    const seconds = Number(response.headers.get("Retry-After"));
    return Number.isFinite(seconds) && seconds > 0
        ? seconds * 1000
        : DEFAULT_RETRY_AFTER_MS;
}

const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Recharge API v2 (`2021-11`), read-only, authenticated by the merchant's own token. */
export class RechargeClient {
    /** Next free call slot per token hash, so one process stays under the leak rate. */
    private readonly nextSlot = new Map<string, number>();

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
        if (response.status === 429) {
            return {
                kind: "rate_limited",
                retryAfterMs: retryAfterMs(response),
            };
        }
        if (response.status === 404) return { kind: "missing" };
        if (!response.ok) {
            log.warn({ status: response.status, path }, "Recharge call failed");
            return { kind: "unavailable" };
        }
        const value = (await response.json().catch(() => null)) as T | null;
        return value ? { kind: "found", value } : { kind: "unavailable" };
    }

    private async throttle(token: string): Promise<void> {
        const now = Date.now();
        for (const [key, next] of this.nextSlot) {
            if (next <= now) this.nextSlot.delete(key);
        }
        const key = createHash("sha256").update(token).digest("hex");
        const slot = Math.max(now, this.nextSlot.get(key) ?? 0);
        this.nextSlot.set(key, slot + MIN_CALL_INTERVAL_MS);
        if (slot > now) await wait(slot - now);
    }

    private async get(path: string, token: string): Promise<Response | null> {
        await this.throttle(token);
        return fetch(`${RECHARGE_URL}${path}`, {
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
