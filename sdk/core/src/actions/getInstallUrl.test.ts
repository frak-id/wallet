import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getClientIdAsync = vi.hoisted(() => vi.fn());
const signProof = vi.hoisted(() => vi.fn());
const resolveMerchantId = vi.hoisted(() => vi.fn());

vi.mock("../config/clientId", () => ({ getClientIdAsync }));
vi.mock("../identity/sign", () => ({ signProof }));
vi.mock("../config/sdkConfigStore", () => ({
    sdkConfigStore: { resolveMerchantId },
}));

import { setEnvironment } from "../config/environment";
import { compactUuid } from "../identity/compactId";
import { getInstallUrl } from "./getInstallUrl";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const ANONYMOUS_ID = "3f2a7c1e-5b4d-4e8a-9c6f-0d1e2f3a4b5c";
const PROOF = "proof-token";
const COMPACT_MERCHANT = compactUuid(MERCHANT_ID) as string;
const COMPACT_ANONYMOUS = compactUuid(ANONYMOUS_ID) as string;

describe("getInstallUrl", () => {
    beforeEach(() => {
        setEnvironment("prod");
        getClientIdAsync.mockResolvedValue(ANONYMOUS_ID);
        signProof.mockResolvedValue(PROOF);
        resolveMerchantId.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("builds the credentialed URL with a compact m= and #p=, without a=", async () => {
        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toBe(
            `https://wallet.frak.id/i?m=${COMPACT_MERCHANT}#p=${encodeURIComponent(PROOF)}`
        );
    });

    it("signs the canonical hyphenated ids, not the compact URL form", async () => {
        await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(signProof).toHaveBeenCalledWith({
            op: "frak-install-v1",
            merchantId: MERCHANT_ID,
            anonymousId: ANONYMOUS_ID,
        });
    });

    it("leaves the anonymous id out of a credentialed URL in any form", async () => {
        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).not.toContain(ANONYMOUS_ID);
        expect(url).not.toContain(COMPACT_ANONYMOUS);
        expect(url).not.toContain("a=");
    });

    it("falls back to the bare ?m= URL when no anonymousId resolves", async () => {
        getClientIdAsync.mockRejectedValue(new Error("no id"));

        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toBe(`https://wallet.frak.id/i?m=${COMPACT_MERCHANT}`);
    });

    it("carries checkoutToken in the query, before the fragment", async () => {
        const url = await getInstallUrl({
            merchantId: MERCHANT_ID,
            checkoutToken: "tok/1",
        });

        expect(url).toBe(
            `https://wallet.frak.id/i?m=${COMPACT_MERCHANT}&checkoutToken=tok%2F1#p=${encodeURIComponent(PROOF)}`
        );
    });

    it("keeps checkoutToken when no anonymousId resolves, the proofless rescue", async () => {
        getClientIdAsync.mockRejectedValue(new Error("no id"));

        const url = await getInstallUrl({
            merchantId: MERCHANT_ID,
            checkoutToken: "tok",
        });

        expect(url).toBe(
            `https://wallet.frak.id/i?m=${COMPACT_MERCHANT}&checkoutToken=tok`
        );
    });

    it("keeps a compact a= without a fragment when signProof returns null", async () => {
        signProof.mockResolvedValue(null);

        const url = await getInstallUrl({
            merchantId: MERCHANT_ID,
            checkoutToken: "tok",
        });

        expect(url).toBe(
            `https://wallet.frak.id/i?m=${COMPACT_MERCHANT}&a=${COMPACT_ANONYMOUS}&checkoutToken=tok`
        );
    });

    it("never places the proof in the query string", async () => {
        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        const [beforeFragment, fragment] = (url as string).split("#");
        expect(beforeFragment).not.toContain(PROOF);
        expect(fragment).toContain(PROOF);
    });

    it("percent-encodes a merchantId containing reserved characters", async () => {
        const merchantId = "merchant id/with&reserved=chars";

        const url = await getInstallUrl({ merchantId });

        expect(url).toContain(`m=${encodeURIComponent(merchantId)}`);
        expect(url).not.toContain("m=merchant id/with&reserved=chars");
    });

    it("falls back to the merchant id the SDK config resolves", async () => {
        resolveMerchantId.mockResolvedValue(MERCHANT_ID);

        const url = await getInstallUrl();

        expect(url).toContain(`/i?m=${COMPACT_MERCHANT}#p=`);
    });

    it("prefers an explicit merchantId over the resolved one", async () => {
        resolveMerchantId.mockResolvedValue("resolved-id");

        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toContain(`/i?m=${COMPACT_MERCHANT}#p=`);
        expect(resolveMerchantId).not.toHaveBeenCalled();
    });

    it("returns undefined when no merchant id resolves", async () => {
        const url = await getInstallUrl({});

        expect(url).toBeUndefined();
        expect(getClientIdAsync).not.toHaveBeenCalled();
        expect(signProof).not.toHaveBeenCalled();
    });

    it("honours a non-default environment", async () => {
        setEnvironment({
            wallet: "https://wallet.custom.test",
            backend: "https://backend.custom.test",
        });

        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toBe(
            `https://wallet.custom.test/i?m=${COMPACT_MERCHANT}#p=${encodeURIComponent(PROOF)}`
        );
    });
});

// Real crypto, not the mocks above: a mocked proof always succeeds.
describe("getInstallUrl — cold path against real crypto", () => {
    beforeEach(() => {
        localStorage.clear();
        // `window.__frakEnv` is a browser global, not module state — it
        // survives `resetModules()` and can carry a stage a prior test set.
        setEnvironment("prod");
        vi.doUnmock("../config/clientId");
        vi.doUnmock("../identity/sign");
        vi.resetModules();
    });

    afterEach(() => {
        vi.doMock("../config/clientId", () => ({ getClientIdAsync }));
        vi.doMock("../identity/sign", () => ({ signProof }));
        vi.resetModules();
        vi.unstubAllGlobals();
    });

    it("returns a fully credentialed URL on a cold localStorage — the page's real target audience, not a mocked proof", async () => {
        const { getInstallUrl: realGetInstallUrl } = await import(
            "./getInstallUrl"
        );

        const url = await realGetInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toMatch(
            /^https:\/\/wallet\.frak\.id\/i\?m=[A-Za-z0-9_-]{22}#p=[^&#]+$/
        );
    });

    it("drops an anonymous id the wallet can recover by hashing the proof's public key", async () => {
        const { getInstallUrl: realGetInstallUrl } = await import(
            "./getInstallUrl"
        );
        const { getClientIdAsync: realGetClientIdAsync } = await import(
            "../config/clientId"
        );
        const { decodeProof } = await import("../identity/canonical");
        const { deriveClientId } = await import("../identity/derive");

        const url = (await realGetInstallUrl({
            merchantId: MERCHANT_ID,
        })) as string;
        const wire = decodeURIComponent(url.split("#p=")[1] ?? "");
        const proof = decodeProof(wire);

        expect(proof).not.toBeNull();
        expect(await deriveClientId(proof?.pk ?? new Uint8Array())).toBe(
            await realGetClientIdAsync()
        );
    });

    it("returns the bare ?m= URL when no entropy source exists to derive a credential", async () => {
        // No `getRandomValues`: `ensureIdentityKey` rejects, the real no-credential case.
        vi.stubGlobal("crypto", {});

        const { getInstallUrl: realGetInstallUrl } = await import(
            "./getInstallUrl"
        );

        const url = await realGetInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toBe(`https://wallet.frak.id/i?m=${COMPACT_MERCHANT}`);
    });
});
