import { describe, expect, it } from "vitest";
import { cronMetrics } from "./cronMetrics";
import { bffOf, isExcluded, pathnameOf } from "./httpMetrics";
import { renderMetrics } from "./registry";

describe("httpMetrics helpers", () => {
    it("extracts pathname without query, no URL allocation", () => {
        expect(pathnameOf("http://host/user/wallet/0xABC?x=1")).toBe(
            "/user/wallet/0xABC"
        );
        expect(pathnameOf("https://host:3030/business/ping")).toBe(
            "/business/ping"
        );
        expect(pathnameOf("http://host")).toBe("/");
    });

    it("buckets paths into the right bff", () => {
        expect(bffOf("/business/merchant/1")).toBe("business");
        expect(bffOf("/user/wallet/x")).toBe("user");
        expect(bffOf("/ext/webhook")).toBe("external");
        expect(bffOf("/common/version")).toBe("common");
        expect(bffOf("/.well-known/foo")).toBe("common");
        expect(bffOf("/nope")).toBe("other");
    });

    it("excludes probe and self-observation routes", () => {
        expect(isExcluded("/health")).toBe(true);
        expect(isExcluded("/metrics")).toBe(true);
        expect(isExcluded("/user/wallet/x")).toBe(false);
    });
});

describe("cronMetrics", () => {
    it("records success and last-success timestamp", async () => {
        await cronMetrics.observe("test_cron_ok", async () => {});
        const out = await renderMetrics();
        expect(out).toContain(
            'cron_runs_total{cron="test_cron_ok",outcome="success"} 1'
        );
        expect(out).toMatch(
            /cron_last_success_timestamp_seconds\{cron="test_cron_ok"\} \d/
        );
    });

    it("records and rethrows errors", async () => {
        await expect(
            cronMetrics.observe("test_cron_err", async () => {
                throw new Error("boom");
            })
        ).rejects.toThrow("boom");
        const out = await renderMetrics();
        expect(out).toContain(
            'cron_runs_total{cron="test_cron_err",outcome="error"} 1'
        );
    });

    it("counts coalesced skips", async () => {
        cronMetrics.skipped("test_cron_skip");
        const out = await renderMetrics();
        expect(out).toContain(
            'cron_runs_total{cron="test_cron_skip",outcome="skipped"} 1'
        );
    });
});
