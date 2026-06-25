import ky, { type KyInstance } from "ky";
import {
    TAKEADS_BASE_URL,
    TAKEADS_PATHS,
    type TakeAdsActionListParams,
    type TakeAdsActionListResponse,
    type TakeAdsMerchantListParams,
    type TakeAdsMerchantListResponse,
    type TakeAdsResolveBody,
    type TakeAdsResolveResponse,
} from "./config";

/**
 * Typed wrapper for the TakeAds (Mitgo) Take/Monetize API.
 *
 * Three endpoints back the affiliate integration:
 *  - {@link listMerchants}  catalog sync (synthetic merchants + commission rates)
 *  - {@link resolveLinks}   per-user affiliate link minting (subId-tagged)
 *  - {@link getActions}     conversion ingestion (polled on a watermark)
 *
 * Auth is a single Bearer key. Both platform-scoped (resolve) and
 * account-scoped (stats) calls share the same `Authorization` header here; if
 * TakeAds requires distinct keys per scope we can split this later.
 *
 * No documented rate limits, so we keep a small retry on the transient 429/503
 * statuses and surface everything else to the caller (sync/ingestion crons
 * decide how to degrade).
 */
export class TakeAdsClient {
    private readonly api: KyInstance;

    constructor() {
        const apiKey = process.env.TAKEADS_API_KEY;
        if (!apiKey) {
            throw new Error("TAKEADS_API_KEY environment variable is required");
        }

        this.api = ky.create({
            // TakeAds has a single global endpoint, so the base is the constant
            // in prod; `TAKEADS_API_URL` is a test-only override (not infra-wired).
            prefix: `${process.env.TAKEADS_API_URL ?? TAKEADS_BASE_URL}/`,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
            },
            timeout: 20_000,
            retry: {
                limit: 2,
                methods: ["get", "put"],
                statusCodes: [429, 503],
                backoffLimit: 10_000,
            },
        });
    }

    /**
     * Page of the merchant catalog. Pass `meta.next` back as `next` to paginate
     * (stop once it comes back null). `limit` caps at 500.
     */
    async listMerchants(
        params: TakeAdsMerchantListParams = {}
    ): Promise<TakeAdsMerchantListResponse> {
        return this.api
            .get(TAKEADS_PATHS.merchants, {
                searchParams: toSearchParams(params),
            })
            .json<TakeAdsMerchantListResponse>();
    }

    /**
     * Resolve direct links into affiliate tracking links, tagging each with our
     * `subId`. Returns an empty `data` array for IRIs with no matching offer.
     */
    async resolveLinks(
        body: TakeAdsResolveBody
    ): Promise<TakeAdsResolveResponse> {
        return this.api
            .put(TAKEADS_PATHS.resolve, { json: body })
            .json<TakeAdsResolveResponse>();
    }

    /**
     * Page of reported actions (conversions). Drive incremental polling with
     * `updatedAtFrom` (the persisted watermark) and follow `meta.next`.
     */
    async getActions(
        params: TakeAdsActionListParams = {}
    ): Promise<TakeAdsActionListResponse> {
        return this.api
            .get(TAKEADS_PATHS.statsAction, {
                searchParams: toSearchParams(params),
            })
            .json<TakeAdsActionListResponse>();
    }
}

/**
 * Drop `undefined` params and stringify the rest — ky's `searchParams` rejects
 * `undefined` values, and every TakeAds query param is a plain scalar.
 */
function toSearchParams(
    params: Record<string, string | number | boolean | undefined>
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        out[key] = String(value);
    }
    return out;
}

/**
 * Lazily-instantiated shared client. Throws on first access if
 * `TAKEADS_API_KEY` is unset, so envs without the secret only fail when the
 * integration is actually exercised (not at module load).
 */
let cached: TakeAdsClient | undefined;
export function getTakeAdsClient(): TakeAdsClient {
    if (!cached) {
        cached = new TakeAdsClient();
    }
    return cached;
}
