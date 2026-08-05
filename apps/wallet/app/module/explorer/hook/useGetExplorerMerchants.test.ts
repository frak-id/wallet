import { describe, expect, test } from "vitest";
import {
    explorerKeys,
    explorerMerchantsQueryOptions,
} from "@/module/explorer/hook/useGetExplorerMerchants";

describe("explorerMerchantsQueryOptions", () => {
    test("uses the shared explorer key so loader and hook share one cache entry", () => {
        expect(
            explorerMerchantsQueryOptions({ limit: 20, offset: 0 }).queryKey
        ).toEqual(explorerKeys.list({ limit: 20, offset: 0 }));
    });

    test("keys differ per pagination window", () => {
        expect(
            explorerMerchantsQueryOptions({ limit: 100, offset: 0 }).queryKey
        ).not.toEqual(
            explorerMerchantsQueryOptions({ limit: 20, offset: 0 }).queryKey
        );
    });
});
