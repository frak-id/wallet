/**
 * Tests for prepareSsoUrl: the ahead-of-gesture URL builder that lets
 * openSso() skip every await before window.open.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/clientId", () => ({
    getClientId: vi.fn().mockReturnValue("client-1"),
    getClientIdAsync: vi.fn().mockResolvedValue("client-1"),
}));

vi.mock("../config/sdkConfigStore", () => ({
    sdkConfigStore: {
        resolveMerchantId: vi.fn().mockResolvedValue("merchant-1"),
    },
}));

vi.mock("../identity/sign", () => ({
    signProof: vi.fn(),
}));

import { getClientId, getClientIdAsync } from "../config/clientId";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { signProof } from "../identity/sign";
import type { FrakClient } from "../types";
import { decompressJsonFromB64 } from "../utils/compression/decompress";
import type { CompressedSsoData } from "../utils/sso/sso";
import { openSso } from "./openSso";
import { prepareSsoUrl } from "./prepareSsoUrl";

function decode(url: string): CompressedSsoData {
    const p = new URL(url).searchParams.get("p");
    if (!p) throw new Error("missing p param");
    const decoded = decompressJsonFromB64<CompressedSsoData>(p);
    if (!decoded) throw new Error("failed to decompress");
    return decoded;
}

describe("prepareSsoUrl", () => {
    let mockClient: FrakClient;

    beforeEach(() => {
        vi.mocked(getClientId).mockReturnValue("client-1");
        vi.mocked(getClientIdAsync).mockResolvedValue("client-1");
        vi.mocked(sdkConfigStore.resolveMerchantId).mockResolvedValue(
            "merchant-1"
        );
        vi.mocked(signProof).mockResolvedValue("signed-proof");
        vi.stubGlobal("open", vi.fn().mockReturnValue({ focus: vi.fn() }));

        mockClient = {
            config: {
                metadata: { name: "Test App" },
                customizations: {},
            },
            request: vi.fn().mockResolvedValue({}),
        } as unknown as FrakClient;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("mints a frak-sso-v1 proof and embeds it in the url", async () => {
        const { ssoUrl } = await prepareSsoUrl(mockClient, {
            directExit: true,
        });

        expect(signProof).toHaveBeenCalledWith({
            op: "frak-sso-v1",
            merchantId: "merchant-1",
            anonymousId: "client-1",
        });
        expect(decode(ssoUrl).pf).toBe("signed-proof");
    });

    it("omits the proof without throwing when no key exists (legacy client)", async () => {
        vi.mocked(signProof).mockResolvedValue(null);

        const { ssoUrl } = await prepareSsoUrl(mockClient, {
            directExit: true,
        });

        expect(decode(ssoUrl).pf).toBeUndefined();
    });

    it("still builds a url when no provable id can be derived", async () => {
        // `getClientIdAsync` rejects with no WebCrypto/localStorage. SSO must
        // degrade to an unlinked login rather than reject the whole flow.
        vi.mocked(getClientId).mockReturnValue(undefined);
        vi.mocked(getClientIdAsync).mockRejectedValue(
            new Error("no provable id")
        );

        const { ssoUrl } = await prepareSsoUrl(mockClient, {
            directExit: true,
        });

        expect(decode(ssoUrl).cId).toBeUndefined();
        expect(decode(ssoUrl).pf).toBeUndefined();
        expect(signProof).not.toHaveBeenCalled();
    });

    it("openSso does not reject when no provable id can be derived", async () => {
        vi.mocked(getClientId).mockReturnValue(undefined);
        vi.mocked(getClientIdAsync).mockRejectedValue(
            new Error("no provable id")
        );

        await expect(
            openSso(mockClient, { directExit: true })
        ).resolves.toBeDefined();
        expect(window.open).toHaveBeenCalled();
    });

    it("defaults directExit when no redirectUrl is given, so the popup closes itself", async () => {
        const withoutRedirect = await prepareSsoUrl(mockClient, {});
        expect(decode(withoutRedirect.ssoUrl).d).toBe(true);

        const withRedirect = await prepareSsoUrl(mockClient, {
            redirectUrl: "https://example.com/cb",
        });
        expect(decode(withRedirect.ssoUrl).d).toBe(false);
    });

    it("produces a url openSso opens verbatim", async () => {
        // The two halves have to agree, otherwise the prepared URL silently
        // loses the proof it was prepared to carry.
        const { ssoUrl } = await prepareSsoUrl(mockClient, {
            directExit: true,
        });

        await openSso(mockClient, { ssoUrl });

        expect(vi.mocked(window.open).mock.calls[0][0]).toBe(ssoUrl);
        expect(decode(ssoUrl).pf).toBe("signed-proof");
    });
});
