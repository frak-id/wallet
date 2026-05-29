import { log } from "@backend-infrastructure/external/logger";
import ky, { type KyInstance } from "ky";
import type { OpenPanelChartQuery, OpenPanelChartResponse } from "./config";

/**
 * Typed wrapper for the OpenPanel `/export/charts` endpoint.
 *
 * Rate limit (per OpenPanel docs): 100 req / 10 s for the export API. We
 * retry once on `429`/`503` and surface anything else as an empty result so
 * a single misbehaving aggregation never breaks the whole analytics page —
 * `CampaignAnalyticsOrchestrator` decides how to degrade.
 *
 * Query strings carry nested arrays/objects (`series`, `breakdowns`). The
 * OpenPanel API runs on Fastify's default querystring parser
 * (`fast-querystring`) which does NOT expand bracket notation, then a
 * `preValidation` hook calls `getSafeJson(v)` on every scalar — so the
 * only supported way to pass composite params is as a JSON string.
 * Bracket-notation (`series[0][name]=…`) silently leaves `series`
 * undefined and the endpoint returns `{ series: [] }`.
 */
export class OpenPanelExportClient {
    private readonly api: KyInstance;
    private readonly projectId =
        process.env.OPEN_PANEL_WALLET_PROJECT_ID ?? "wallet";

    constructor() {
        if (!process.env.OPEN_PANEL_API_URL) {
            throw new Error("Invalid config");
        }

        this.api = ky.create({
            prefix: stripTrailingSlash(process.env.OPEN_PANEL_API_URL),
            headers: {
                "openpanel-client-id":
                    process.env.OPEN_PANEL_BACKEND_CLIENT_ID ?? "",
                "openpanel-client-secret":
                    process.env.OPEN_PANEL_BACKEND_CLIENT_SECRET ?? "",
            },
            timeout: 10_000,
            retry: {
                limit: 1,
                statusCodes: [429, 503],
                backoffLimit: 5_000,
            },
        });
    }

    async getChart(
        query: Omit<OpenPanelChartQuery, "projectId"> & { projectId?: string }
    ): Promise<OpenPanelChartResponse> {
        const params = encodeChartParams({
            ...query,
            projectId: query.projectId ?? this.projectId,
        });

        try {
            return await this.api
                .get(`export/charts?${params}`)
                .json<OpenPanelChartResponse>();
        } catch (error) {
            log.error(error, "OpenPanel /export/charts failed");
            return { series: [] };
        }
    }
}

function stripTrailingSlash(value: string): string {
    return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * Encode top-level params for `/export/charts`. Scalars are stringified,
 * arrays/objects (`series`, `breakdowns`) are JSON-encoded — see the
 * class docstring for why bracket notation does not work.
 */
function encodeChartParams(input: Record<string, unknown>): string {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(input)) {
        if (value === undefined || value === null) continue;
        const encoded =
            Array.isArray(value) || typeof value === "object"
                ? JSON.stringify(value)
                : String(value);
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(encoded)}`);
    }
    return pairs.join("&");
}
