import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/sdkConfigStore", () => ({
    sdkConfigStore: {
        resolveMerchantId: vi
            .fn()
            .mockResolvedValue("9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"),
    },
}));

import { getClientId, initClientId } from "../config/clientId";
import { decodeProof } from "../identity/canonical";
import { ensureIdentity } from "./ensureIdentity";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

describe("ensureIdentity", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        fetchSpy = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("attaches a valid frak-ensure-v1 proof when a key exists", async () => {
        await initClientId();
        const clientId = getClientId();

        await ensureIdentity("interaction-token");

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(requestInit.body as string);

        expect(body.merchantId).toBe(MERCHANT_ID);
        expect(body.proof).toBeTruthy();

        const decoded = decodeProof(body.proof);
        expect(decoded).not.toBeNull();
        expect(decoded?.pk.length).toBe(65);

        // The proof is for the id actually sent as x-frak-client-id.
        const headers = requestInit.headers as Record<string, string>;
        expect(headers["x-frak-client-id"]).toBe(clientId);
    });

    it("omits the proof field entirely for a legacy id with no key (never blocks the call)", async () => {
        localStorage.setItem("frak-client-id", "legacy-id-no-key");

        await ensureIdentity("interaction-token");

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(requestInit.body as string);

        expect(body.merchantId).toBe(MERCHANT_ID);
        expect(body).not.toHaveProperty("proof");
    });
});
