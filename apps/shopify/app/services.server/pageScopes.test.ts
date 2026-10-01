import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";

vi.mock("./logger", () => ({
    log: { error: vi.fn() },
}));

import { log } from "./logger";
import { arePageScopesGranted } from "./pageScopes";

function contextWithGranted(granted: string[]) {
    return {
        scopes: {
            query: vi.fn().mockResolvedValue({
                granted,
                required: [],
                optional: [],
            }),
        },
    } as unknown as AuthenticatedContext;
}

describe("arePageScopesGranted", () => {
    it("is granted when read and write page scopes are both listed", async () => {
        const context = contextWithGranted([
            "read_products",
            "read_online_store_pages",
            "write_online_store_pages",
        ]);
        expect(await arePageScopesGranted(context)).toBe(true);
    });

    it("is granted when only the write scope is listed", async () => {
        const context = contextWithGranted(["write_online_store_pages"]);
        expect(await arePageScopesGranted(context)).toBe(true);
    });

    it("is not granted when only the read scope is listed", async () => {
        const context = contextWithGranted(["read_online_store_pages"]);
        expect(await arePageScopesGranted(context)).toBe(false);
    });

    it("is not granted and logs when the scopes query throws", async () => {
        const context = {
            scopes: { query: vi.fn().mockRejectedValue(new Error("boom")) },
        } as unknown as AuthenticatedContext;
        expect(await arePageScopesGranted(context)).toBe(false);
        expect(log.error).toHaveBeenCalledOnce();
    });
});
