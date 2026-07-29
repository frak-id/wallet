/**
 * Tests for openSso action, focused on proof-of-possession minting for the
 * popup flow (README §4.1).
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

import { getClientId } from "../config/clientId";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { signProof } from "../identity/sign";
import type { FrakClient, OpenSsoParamsType } from "../types";
import { decompressJsonFromB64 } from "../utils/compression/decompress";
import type { CompressedSsoData } from "../utils/sso/sso";
import { openSso, ssoPopupFeatures, ssoPopupName } from "./openSso";

function decodeOpenUrl(): CompressedSsoData {
    const call = vi.mocked(window.open).mock.calls[0];
    const url = call[0] as string;
    const p = new URL(url).searchParams.get("p");
    if (!p) throw new Error("missing p param");
    const decoded = decompressJsonFromB64<CompressedSsoData>(p);
    if (!decoded) throw new Error("failed to decompress");
    return decoded;
}

describe("openSso", () => {
    let mockClient: FrakClient;

    beforeEach(() => {
        vi.mocked(getClientId).mockReturnValue("client-1");
        vi.mocked(sdkConfigStore.resolveMerchantId).mockResolvedValue(
            "merchant-1"
        );

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

    it("includes a proof in the SSO URL when signProof resolves a value", async () => {
        vi.mocked(signProof).mockResolvedValue("signed-proof");

        const args: OpenSsoParamsType = { directExit: true };
        await openSso(mockClient, args);

        expect(signProof).toHaveBeenCalledWith({
            op: "frak-sso-v1",
            merchantId: "merchant-1",
            anonymousId: "client-1",
        });

        const decoded = decodeOpenUrl();
        expect(decoded.pf).toBe("signed-proof");
    });

    describe("pre-built url form", () => {
        it("opens the url without resolving ids or signing anything", async () => {
            await openSso(mockClient, {
                ssoUrl: "https://wallet.frak.id/sso?p=prebuilt",
            });

            // The whole point of this form: nothing is awaited before the
            // popup opens, so no blocker heuristic can fire.
            expect(signProof).not.toHaveBeenCalled();
            expect(getClientId).not.toHaveBeenCalled();
            expect(sdkConfigStore.resolveMerchantId).not.toHaveBeenCalled();
            expect(window.open).toHaveBeenCalledWith(
                "https://wallet.frak.id/sso?p=prebuilt",
                ssoPopupName,
                ssoPopupFeatures
            );
        });

        it("still awaits completion over RPC, so the caller gets the wallet back", async () => {
            vi.mocked(mockClient.request).mockResolvedValue({
                wallet: "0xdeadbeef",
            });

            const result = await openSso(mockClient, {
                ssoUrl: "https://wallet.frak.id/sso?p=prebuilt",
            });

            expect(result).toEqual({ wallet: "0xdeadbeef" });
        });

        it("throws the blocker error when the popup is refused", async () => {
            vi.stubGlobal("open", vi.fn().mockReturnValue(null));

            await expect(
                openSso(mockClient, {
                    ssoUrl: "https://wallet.frak.id/sso?p=prebuilt",
                })
            ).rejects.toThrow("Popup was blocked");
        });
    });

    it("does not include a proof and does not throw when signProof resolves null (legacy no-key client)", async () => {
        vi.mocked(signProof).mockResolvedValue(null);

        const args: OpenSsoParamsType = { directExit: true };
        await expect(openSso(mockClient, args)).resolves.toBeDefined();

        const decoded = decodeOpenUrl();
        expect(decoded.pf).toBeUndefined();
    });
});
