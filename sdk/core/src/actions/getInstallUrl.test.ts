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
import { getInstallUrl } from "./getInstallUrl";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const ANONYMOUS_ID = "anon-id-123";
const PROOF = "proof-token";

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

    it("builds the credentialed URL with a= and #p= when both are available", async () => {
        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toBe(
            `https://wallet.frak.id/install?m=${encodeURIComponent(MERCHANT_ID)}&a=${encodeURIComponent(ANONYMOUS_ID)}#p=${encodeURIComponent(PROOF)}`
        );
    });

    it("falls back to the bare ?m= URL when no anonymousId resolves", async () => {
        getClientIdAsync.mockRejectedValue(new Error("no id"));

        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toBe(
            `https://wallet.frak.id/install?m=${encodeURIComponent(MERCHANT_ID)}`
        );
    });

    it("carries checkoutToken in the query, before the fragment", async () => {
        const url = await getInstallUrl({
            merchantId: MERCHANT_ID,
            checkoutToken: "tok/1",
        });

        expect(url).toBe(
            `https://wallet.frak.id/install?m=${encodeURIComponent(MERCHANT_ID)}&a=${encodeURIComponent(ANONYMOUS_ID)}&checkoutToken=tok%2F1#p=${encodeURIComponent(PROOF)}`
        );
    });

    it("keeps checkoutToken when no anonymousId resolves, the proofless rescue", async () => {
        getClientIdAsync.mockRejectedValue(new Error("no id"));

        const url = await getInstallUrl({
            merchantId: MERCHANT_ID,
            checkoutToken: "tok",
        });

        expect(url).toBe(
            `https://wallet.frak.id/install?m=${encodeURIComponent(MERCHANT_ID)}&checkoutToken=tok`
        );
    });

    it("keeps a= without a fragment when signProof returns null", async () => {
        signProof.mockResolvedValue(null);

        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toBe(
            `https://wallet.frak.id/install?m=${encodeURIComponent(MERCHANT_ID)}&a=${encodeURIComponent(ANONYMOUS_ID)}`
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

        expect(url).toContain(`?m=${encodeURIComponent(MERCHANT_ID)}&a=`);
    });

    it("prefers an explicit merchantId over the resolved one", async () => {
        resolveMerchantId.mockResolvedValue("resolved-id");

        const url = await getInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toContain(`?m=${encodeURIComponent(MERCHANT_ID)}&a=`);
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
            `https://wallet.custom.test/install?m=${encodeURIComponent(MERCHANT_ID)}&a=${encodeURIComponent(ANONYMOUS_ID)}#p=${encodeURIComponent(PROOF)}`
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
            /^https:\/\/wallet\.frak\.id\/install\?m=[^&]+&a=[^&#]+#p=.+$/
        );
    });

    it("returns the bare ?m= URL when no entropy source exists to derive a credential", async () => {
        // No `getRandomValues`: `ensureIdentityKey` rejects, the real no-credential case.
        vi.stubGlobal("crypto", {});

        const { getInstallUrl: realGetInstallUrl } = await import(
            "./getInstallUrl"
        );

        const url = await realGetInstallUrl({ merchantId: MERCHANT_ID });

        expect(url).toBe(
            `https://wallet.frak.id/install?m=${encodeURIComponent(MERCHANT_ID)}`
        );
    });
});
