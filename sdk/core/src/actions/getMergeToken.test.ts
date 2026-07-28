import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initClientId } from "../config/clientId";
import type { FrakClient } from "../types";
import { getMergeToken } from "./getMergeToken";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

function makeClient(
    request: ReturnType<typeof vi.fn>,
    merchantId?: string
): FrakClient {
    return {
        config: { metadata: { merchantId } },
        request,
    } as unknown as FrakClient;
}

describe("getMergeToken", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("attaches a frak-merge-v1 proof as the sole rpc param when a key exists", async () => {
        await initClientId();
        const request = vi.fn().mockResolvedValue("merge-token");

        const token = await getMergeToken(makeClient(request, MERCHANT_ID), {
            cacheTime: 0,
        });

        expect(token).toBe("merge-token");
        expect(request).toHaveBeenCalledTimes(1);
        const [call] = request.mock.calls[0] as [
            { method: string; params?: [string] },
        ];
        expect(call.method).toBe("frak_getMergeToken");
        expect(call.params).toHaveLength(1);
        expect(typeof call.params?.[0]).toBe("string");
    });

    it("sends no params when no key exists (legacy id) — structurally safe, old SDK shape", async () => {
        localStorage.setItem("frak-client-id", "legacy-id-no-key");
        const request = vi.fn().mockResolvedValue(null);

        await getMergeToken(makeClient(request, MERCHANT_ID), {
            cacheTime: 0,
        });

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "frak_getMergeToken",
                params: undefined,
            })
        );
    });
});
