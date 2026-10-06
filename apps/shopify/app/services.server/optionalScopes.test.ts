import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";

vi.mock("./logger", () => ({
    log: { error: vi.fn() },
}));

import { log } from "./logger";
import { grantedOptionalScopes } from "./optionalScopes";

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

describe("grantedOptionalScopes", () => {
    it("reports every group granted when all scopes are listed", async () => {
        const context = contextWithGranted([
            "read_products",
            "read_online_store_pages",
            "write_online_store_pages",
            "write_app_proxy",
            "write_online_store_navigation",
        ]);
        expect(await grantedOptionalScopes(context)).toEqual({
            proxy: true,
            menu: true,
            pages: true,
        });
    });

    it("counts the page scopes granted when only the write scope is listed", async () => {
        const context = contextWithGranted(["write_online_store_pages"]);
        expect((await grantedOptionalScopes(context))?.pages).toBe(true);
    });

    it("does not count the page scopes when only the read scope is listed", async () => {
        const context = contextWithGranted(["read_online_store_pages"]);
        expect((await grantedOptionalScopes(context))?.pages).toBe(false);
    });

    it("does not count the menu scope when only the read navigation scope is listed", async () => {
        const context = contextWithGranted([
            "write_app_proxy",
            "read_online_store_navigation",
        ]);
        expect(await grantedOptionalScopes(context)).toEqual({
            proxy: true,
            menu: false,
            pages: false,
        });
    });

    it("is null and logs when the scopes query throws", async () => {
        const context = {
            scopes: { query: vi.fn().mockRejectedValue(new Error("boom")) },
        } as unknown as AuthenticatedContext;
        expect(await grantedOptionalScopes(context)).toBeNull();
        expect(log.error).toHaveBeenCalledOnce();
    });
});
