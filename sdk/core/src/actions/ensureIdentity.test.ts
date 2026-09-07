import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/sdkConfigStore", () => ({
    sdkConfigStore: {
        resolveMerchantId: vi
            .fn()
            .mockResolvedValue("9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"),
    },
}));

import { getClientId, initClientId } from "../config/clientId";
import { setEnvironment } from "../config/environment";
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
        setEnvironment("prod");
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

    it("posts to the configured environment's backend", async () => {
        // Otherwise a locally-run integration would post a dev token to the
        // production backend.
        setEnvironment({
            wallet: "https://localhost:3000",
            backend: "https://localhost:3030",
        });
        await initClientId();

        await ensureIdentity("interaction-token");

        const [url] = fetchSpy.mock.calls[0] as [string];
        expect(url).toBe("https://localhost:3030/user/identity/ensure");
    });

    it("only fires once per (merchant, clientId), even across wallets", async () => {
        await initClientId();

        await ensureIdentity("token-wallet-a");
        await ensureIdentity("token-wallet-b");

        // The second wallet is either already in the merged group or would be
        // refused with WALLET_CONFLICT, so re-firing buys nothing.
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("fires again for a new clientId, which is a genuinely different merge", async () => {
        await initClientId();
        await ensureIdentity("interaction-token");
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        // New key material => new derived id => unlatched.
        localStorage.clear();
        vi.resetModules();
        const { initClientId: freshInit } = await import("../config/clientId");
        const { ensureIdentity: freshEnsure } = await import(
            "./ensureIdentity"
        );
        await freshInit();
        await freshEnsure("interaction-token");

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("does not latch when the request fails, so a later attempt retries", async () => {
        fetchSpy.mockResolvedValue({ ok: false });
        await initClientId();

        await ensureIdentity("interaction-token");
        await ensureIdentity("interaction-token");

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});
