import { describe, expect, it } from "vitest";
import { redactQueryParams } from "./redactQueryParams";

const TOKEN = "shpat_live_access_token";
const REFRESH = "shprt_live_refresh_token";
const QUERY =
    'insert into "session" ("id", "accessToken", "refreshToken") values ($1, $2, $3)';

function drizzleQueryError(params: unknown[], cause?: unknown) {
    const error = new Error(`Failed query: ${QUERY}\nparams: ${params}`, {
        cause,
    });
    return Object.assign(error, { query: QUERY, params });
}

function postgresError(message: string, detail?: string) {
    return Object.assign(new Error(message), { code: "42703", detail });
}

const leaks = (value: unknown) => {
    const text = JSON.stringify(value, (_key, inner) =>
        inner instanceof Error
            ? { ...inner, message: inner.message, stack: inner.stack }
            : inner
    );
    return text.includes(TOKEN) || text.includes(REFRESH);
};

describe("redactQueryParams", () => {
    it("strips bound values from a Drizzle error's message, stack and params", () => {
        const err = drizzleQueryError(["offline_shop", TOKEN, REFRESH]);
        redactQueryParams([{ err }, "request error"]);

        expect(err.message).toBe(`Failed query: ${QUERY}\nparams: [redacted]`);
        expect(err.stack).toContain("params: [redacted]");
        expect(err).not.toHaveProperty("params");
        expect(leaks(err)).toBe(false);
    });

    it("keeps the query and the Postgres cause", () => {
        const cause = postgresError('column "refreshToken" does not exist');
        const err = drizzleQueryError(["offline_shop", TOKEN, REFRESH], cause);
        redactQueryParams([{ err }]);

        expect(err.query).toBe(QUERY);
        expect(err.cause).toBe(cause);
        expect(cause.message).toBe('column "refreshToken" does not exist');
    });

    it("redacts a Drizzle error passed as the first argument", () => {
        const err = drizzleQueryError([TOKEN]);
        redactQueryParams([err, "failed"]);
        expect(leaks(err)).toBe(false);
    });

    it("redacts a Drizzle error wrapped as the cause of another error", () => {
        const inner = drizzleQueryError([TOKEN, REFRESH]);
        const outer = new Error("storeSession failed", { cause: inner });
        redactQueryParams([{ err: outer }]);
        expect(leaks(inner)).toBe(false);
    });

    it("redacts a wrapper whose message embeds the Drizzle message", () => {
        const inner = drizzleQueryError([TOKEN, REFRESH]);
        const outer = new Error(`storeSession failed: ${inner.message}`);
        redactQueryParams([{ err: outer }]);
        expect(outer.message).toBe(
            `storeSession failed: Failed query: ${QUERY}\nparams: [redacted]`
        );
    });

    it("redacts every error of an AggregateError", () => {
        const inner = drizzleQueryError([TOKEN]);
        const aggregate = new AggregateError([inner], "batch failed");
        redactQueryParams([{ err: aggregate }]);
        expect(leaks(inner)).toBe(false);
    });

    it("redacts an already stringified error under any key and in the message", () => {
        const err = drizzleQueryError([TOKEN, REFRESH]);
        const merge = { merchantId: "m1", error: String(err) };
        const args = [merge, `query failed: ${err.message}`];
        redactQueryParams(args);

        expect(merge.merchantId).toBe("m1");
        expect(leaks(args)).toBe(false);
    });

    it("redacts the row Postgres echoes on a NOT NULL violation", () => {
        const cause = postgresError(
            'null value in column "shop" violates not-null constraint',
            `Failing row contains (offline_shop, null, ${TOKEN}).`
        );
        redactQueryParams([{ err: drizzleQueryError([TOKEN], cause) }]);
        expect(cause.detail).toBe("Failing row contains [redacted]");
    });

    it("never invokes an accessor on the merge object", () => {
        const merge = {
            reqId: "r1",
            get cookie(): string {
                throw new Error("accessor invoked");
            },
        };
        expect(() => redactQueryParams([merge])).not.toThrow();
    });

    it("leaves a frozen error and unrelated arguments alone without throwing", () => {
        const frozen = Object.freeze(drizzleQueryError([TOKEN]));
        const args = [{ err: frozen, count: 3 }, "plain message", 42, null];
        expect(() => redactQueryParams(args)).not.toThrow();
        expect(args.slice(1)).toEqual(["plain message", 42, null]);
    });

    it("survives a circular cause chain", () => {
        const a = drizzleQueryError([TOKEN]);
        const b = new Error("b", { cause: a });
        Object.assign(a, { cause: b });
        redactQueryParams([{ err: b }]);
        expect(leaks(a.message)).toBe(false);
    });
});
