import { log } from "@backend-infrastructure/external/logger";
import ky, { type KyInstance } from "ky";
import type {
    OpenPanelChartQuery,
    OpenPanelChartResponse,
    OpenPanelExportConfig,
} from "./config";

/**
 * Typed wrapper for the OpenPanel `/export/charts` endpoint.
 *
 * Rate limit (per OpenPanel docs): 100 req / 10 s for the export API. We
 * retry once on `429`/`503` and surface anything else as an empty result so
 * a single misbehaving aggregation never breaks the whole analytics page —
 * `CampaignAnalyticsOrchestrator` decides how to degrade.
 *
 * Query strings carry nested arrays/objects (`series[0][filters][0][name]`)
 * which `URLSearchParams` doesn't handle, so we encode them ourselves in
 * the bracket notation `fastify-querystring` consumes by default.
 */
export class OpenPanelExportClient {
    private readonly api: KyInstance;

    constructor(private readonly config: OpenPanelExportConfig) {
        this.api = ky.create({
            prefix: stripTrailingSlash(config.apiUrl),
            headers: {
                "openpanel-client-id": config.clientId,
                "openpanel-client-secret": config.clientSecret,
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
        const params = encodeNestedParams({
            ...query,
            projectId: query.projectId ?? this.config.walletProjectId,
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
 * Bracket-notation encoder for nested arrays / objects — mirrors the format
 * fastify's default querystring parser (`fast-querystring` + `qs`-style
 * brackets) understands. `{ a: [{ b: 1 }] } → a[0][b]=1`.
 */
function encodeNestedParams(input: Record<string, unknown>): string {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(input)) {
        if (value === undefined || value === null) continue;
        appendParam(pairs, key, value);
    }
    return pairs.join("&");
}

function appendParam(pairs: string[], key: string, value: unknown): void {
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            appendParam(pairs, `${key}[${index}]`, item);
        });
        return;
    }
    if (value !== null && typeof value === "object") {
        for (const [childKey, childValue] of Object.entries(
            value as Record<string, unknown>
        )) {
            if (childValue === undefined) continue;
            appendParam(pairs, `${key}[${childKey}]`, childValue);
        }
        return;
    }
    pairs.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    );
}
