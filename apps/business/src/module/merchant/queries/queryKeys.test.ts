import { describe, expect, test } from "@/tests/vitest-fixtures";
import {
    legacyBankQueryKey,
    legacyBankStatusQueryKey,
    mediaListByModeQueryKey,
    mediaListQueryKey,
    merchantAccessQueryKey,
    merchantBankQueryKey,
    merchantByIdQueryKey,
    merchantDetailQueryKey,
    merchantDnsRecordQueryKey,
    merchantPurchaseWebhookStatusQueryKey,
    merchantQueryKey,
    merchantSdkConfigQueryKey,
    merchantSetupStatusQueryKey,
    merchantTeamListQueryKey,
    merchantTeamQueryKey,
    myMerchantsQueryKey,
} from "./queryKeys";

describe("merchant query keys", () => {
    test("builders return the exact tuples the call sites inlined", () => {
        expect(merchantQueryKey()).toEqual(["merchant"]);
        expect(merchantByIdQueryKey("m1")).toEqual(["merchant", "m1"]);
        expect(merchantDetailQueryKey("m1", false)).toEqual([
            "merchant",
            "m1",
            "live",
        ]);
        expect(merchantDetailQueryKey("m1", true)).toEqual([
            "merchant",
            "m1",
            "demo",
        ]);
        expect(merchantBankQueryKey("m1")).toEqual(["merchant", "m1", "bank"]);
        expect(merchantAccessQueryKey("m1", false)).toEqual([
            "merchant",
            "m1",
            "access",
            "live",
        ]);
        expect(merchantPurchaseWebhookStatusQueryKey("m1", true)).toEqual([
            "merchant",
            "m1",
            "purchase-webhook-status",
            "demo",
        ]);
        expect(merchantSetupStatusQueryKey("m1", false)).toEqual([
            "merchant",
            "m1",
            "setup-status",
            "live",
        ]);
        expect(merchantSdkConfigQueryKey("m1", false)).toEqual([
            "merchant",
            "m1",
            "sdk-config",
            "live",
        ]);
        expect(merchantTeamQueryKey("m1")).toEqual(["merchant", "team", "m1"]);
        expect(merchantTeamListQueryKey("m1", false)).toEqual([
            "merchant",
            "team",
            "m1",
            "live",
        ]);
        expect(myMerchantsQueryKey(true)).toEqual(["merchant", "my", "demo"]);
        expect(merchantDnsRecordQueryKey("frak.id")).toEqual([
            "merchant",
            "register",
            "dns-record",
            "frak.id",
        ]);
        expect(mediaListQueryKey("m1")).toEqual(["media", "list", "m1"]);
        expect(mediaListByModeQueryKey("m1", false)).toEqual([
            "media",
            "list",
            "m1",
            "live",
        ]);
        expect(legacyBankQueryKey()).toEqual(["legacy-bank"]);
        expect(legacyBankStatusQueryKey("0xabc")).toEqual([
            "legacy-bank",
            "0xabc",
        ]);
    });

    test("scoped variants prefix their base key so a base invalidation matches", () => {
        const base = merchantByIdQueryKey("m1");
        expect(
            merchantDetailQueryKey("m1", false).slice(0, base.length)
        ).toEqual([...base]);
        expect(merchantBankQueryKey("m1").slice(0, base.length)).toEqual([
            ...base,
        ]);

        const team = merchantTeamQueryKey("m1");
        expect(
            merchantTeamListQueryKey("m1", true).slice(0, team.length)
        ).toEqual([...team]);
    });
});
