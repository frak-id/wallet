import { Mutex } from "async-mutex";
import ky, { type KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import { log } from "../external/logger";

/** Units of quote currency per 1 unit of base, keyed by uppercase ISO 4217 code. */
type RateTable = Record<string, number>;

/** ECB reference rates update once per business day — 6h keeps us fresh enough. */
const RATE_TTL_MS = 6 * 60 * 60 * 1000;
/** Retry unknown/unreachable bases quickly: failures are often transient. */
const FAILURE_TTL_MS = 5 * 60 * 1000;
/**
 * Providers are free, keyless, no-SLA services feeding a money path: a
 * poisoned response would mint wrong reward amounts. Real FX pairs never
 * move >20% between fetches, so reject such jumps vs the last accepted
 * value — the pair becomes unavailable and rewards defer instead.
 */
const SANITY_BAND = 0.2;
/**
 * Baselines refresh on every accepted rate, so this TTL only matters for a
 * rejected pair: after 24h without acceptance the baseline ages out and the
 * new market level is taken at face value (self-recovery from a genuine
 * structural move, e.g. a currency collapse).
 */
const BASELINE_TTL_MS = 24 * 60 * 60 * 1000;

const ISO_4217 = /^[A-Za-z]{3}$/;

/**
 * Fiat FX rates from free, keyless providers: Frankfurter (ECB reference
 * rates, ~30 currencies) with open.er-api.com as fallback (161 currencies).
 * One cached table per base currency covers every quote pair.
 */
export class FxRateRepository {
    private readonly cache = new LRUCache<string, RateTable | "unknown">({
        max: 64,
        ttl: RATE_TTL_MS,
    });

    /** Last accepted rate per "BASE/QUOTE" pair, for the sanity band. */
    private readonly baselines = new LRUCache<string, number>({
        max: 256,
        ttl: BASELINE_TTL_MS,
    });

    private readonly apiMutex = new Mutex();

    private readonly frankfurter: KyInstance;
    private readonly erApi: KyInstance;

    constructor() {
        this.frankfurter = ky.create({
            prefix: "https://api.frankfurter.dev/v1/",
            headers: { accept: "application/json" },
        });
        this.erApi = ky.create({
            prefix: "https://open.er-api.com/v6/",
            headers: { accept: "application/json" },
        });
    }

    /**
     * Exchange rate as units of `to` per 1 unit of `from`
     * (e.g. from=JPY, to=USD ≈ 0.0062). Undefined when no provider knows the
     * pair — callers must treat that as "cannot convert", never as 1.
     */
    async getRate({
        from,
        to,
    }: {
        from: string;
        to: string;
    }): Promise<number | undefined> {
        if (!(ISO_4217.test(from) && ISO_4217.test(to))) return undefined;

        const base = from.toUpperCase();
        const quote = to.toUpperCase();
        if (base === quote) return 1;

        const table = await this.getRateTable(base);
        const rate = table?.[quote];
        if (rate === undefined || rate <= 0) return undefined;
        return this.checkAgainstBaseline(`${base}/${quote}`, rate);
    }

    private checkAgainstBaseline(
        pair: string,
        rate: number
    ): number | undefined {
        const baseline = this.baselines.get(pair);
        if (baseline !== undefined) {
            const drift = Math.abs(rate - baseline) / baseline;
            if (drift > SANITY_BAND) {
                log.error(
                    { pair, rate, baseline, drift },
                    "[FxRateRepository] Rate outside sanity band, rejecting"
                );
                return undefined;
            }
        }
        this.baselines.set(pair, rate);
        return rate;
    }

    private async getRateTable(base: string): Promise<RateTable | undefined> {
        // Check cache outside mutex to avoid serializing cache hits
        const cached = this.cache.get(base);
        if (cached === "unknown") return undefined;
        if (cached) return cached;

        return this.apiMutex.runExclusive(() => this.fetchRateTable(base));
    }

    private async fetchRateTable(base: string): Promise<RateTable | undefined> {
        // Re-check cache inside mutex (another call may have populated it)
        const cached = this.cache.get(base);
        if (cached === "unknown") return undefined;
        if (cached) return cached;

        const table =
            (await this.fetchFromFrankfurter(base)) ??
            (await this.fetchFromErApi(base));

        if (!table) {
            this.cache.set(base, "unknown", { ttl: FAILURE_TTL_MS });
            return undefined;
        }

        this.cache.set(base, table);
        return table;
    }

    private async fetchFromFrankfurter(
        base: string
    ): Promise<RateTable | undefined> {
        try {
            const response = await this.frankfurter.get<{
                rates: RateTable | undefined;
            }>("latest", { searchParams: { base } });
            const data = await response.json();
            if (!data.rates || Object.keys(data.rates).length === 0) {
                return undefined;
            }
            return data.rates;
        } catch (error) {
            log.warn(
                { error, base },
                "[FxRateRepository] Frankfurter fetch failed"
            );
            return undefined;
        }
    }

    private async fetchFromErApi(base: string): Promise<RateTable | undefined> {
        try {
            const response = await this.erApi.get<{
                result: string;
                rates: RateTable | undefined;
            }>(`latest/${base}`);
            const data = await response.json();
            if (data.result !== "success" || !data.rates) {
                return undefined;
            }
            return data.rates;
        } catch (error) {
            log.warn(
                { error, base },
                "[FxRateRepository] open.er-api fetch failed"
            );
            return undefined;
        }
    }
}

export const fxRateRepository = new FxRateRepository();
