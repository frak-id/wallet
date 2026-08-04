import { beforeEach, describe, expect, it, vi } from "vitest";
import { JwtContextMock } from "../../../../test/mock/common";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    buildIdentityNodes,
    resolveSdkIdentity,
    resolveWalletAddress,
} from "./sdkIdentity";

vi.mock("../../../orchestration/context", () => ({
    OrchestrationContext: {
        orchestrators: {
            identity: {
                resolveForAttribution: vi.fn(),
                resolveAndAssociate: vi.fn(),
            },
        },
    },
}));

const WALLET = "0x1111111111111111111111111111111111111111" as const;
const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const VICTIM_CLIENT_ID = "victim-anon-id";

describe("resolveWalletAddress (§3.7 — raw-hex bypass removed)", () => {
    beforeEach(() => {
        JwtContextMock.walletSdk.verify.mockReset();
    });

    it("rejects a raw hex address with no signature at all — verify is the only path now", async () => {
        JwtContextMock.walletSdk.verify.mockResolvedValue(null as never);

        const result = await resolveWalletAddress(WALLET);

        expect(result).toBeNull();
        // The raw string must still go through JWT verification — there is
        // no early-return bypass left for anything that merely looks like an
        // address.
        expect(JwtContextMock.walletSdk.verify).toHaveBeenCalledWith(WALLET);
    });

    it("accepts a valid signed x-wallet-sdk-auth JWT", async () => {
        JwtContextMock.walletSdk.verify.mockResolvedValue({
            address: WALLET,
            scopes: ["interaction"],
        } as never);

        const result = await resolveWalletAddress("a-real-jwt");

        expect(result).toBe(WALLET);
    });

    it("rejects a garbage token", async () => {
        JwtContextMock.walletSdk.verify.mockResolvedValue(null as never);

        const result = await resolveWalletAddress("not-a-jwt");

        expect(result).toBeNull();
    });
});

describe("resolveSdkIdentity (§3.9 — resolve-only, never merge)", () => {
    beforeEach(() => {
        vi.mocked(
            OrchestrationContext.orchestrators.identity.resolveForAttribution
        ).mockReset();
        vi.mocked(
            OrchestrationContext.orchestrators.identity.resolveAndAssociate
        ).mockReset();
        JwtContextMock.walletSdk.verify.mockReset();
    });

    it("a forged x-frak-client-id + a legitimate attacker wallet JWT never calls the merging resolver", async () => {
        // Simulates POST /user/track/interaction with a foreign clientId
        // (the victim's, harvested from a share link) and the attacker's own
        // valid wallet JWT — the single-request variant of the headline
        // attack.
        vi.mocked(
            OrchestrationContext.orchestrators.identity.resolveForAttribution
        ).mockResolvedValue({ groupId: "attacker-group" });
        JwtContextMock.walletSdk.verify.mockResolvedValue({
            address: WALLET,
            scopes: ["interaction"],
        } as never);

        const result = await resolveSdkIdentity({
            headers: {
                "x-frak-client-id": VICTIM_CLIENT_ID,
                "x-wallet-sdk-auth": "attacker-own-valid-jwt",
            },
            merchantId: MERCHANT_ID,
        });

        expect(result).toEqual({
            success: true,
            identityGroupId: "attacker-group",
            walletAddress: WALLET,
        });
        expect(
            OrchestrationContext.orchestrators.identity.resolveForAttribution
        ).toHaveBeenCalledTimes(1);
        // The merging entrypoint must never be reached from this path.
        expect(
            OrchestrationContext.orchestrators.identity.resolveAndAssociate
        ).not.toHaveBeenCalled();
    });

    it("builds both nodes so resolveForAttribution can anchor on the wallet", async () => {
        vi.mocked(
            OrchestrationContext.orchestrators.identity.resolveForAttribution
        ).mockResolvedValue({ groupId: "some-group" });
        JwtContextMock.walletSdk.verify.mockResolvedValue({
            address: WALLET,
            scopes: ["interaction"],
        } as never);

        await resolveSdkIdentity({
            headers: {
                "x-frak-client-id": VICTIM_CLIENT_ID,
                "x-wallet-sdk-auth": "a-real-jwt",
            },
            merchantId: MERCHANT_ID,
        });

        expect(
            OrchestrationContext.orchestrators.identity.resolveForAttribution
        ).toHaveBeenCalledWith([
            { type: "wallet", value: WALLET },
            {
                type: "anonymous_fingerprint",
                value: VICTIM_CLIENT_ID,
                merchantId: MERCHANT_ID,
            },
        ]);
    });

    it("rejects an invalid wallet SDK JWT when it is the only identity offered", async () => {
        JwtContextMock.walletSdk.verify.mockResolvedValue(null as never);

        const result = await resolveSdkIdentity({
            headers: { "x-wallet-sdk-auth": "garbage" },
            merchantId: MERCHANT_ID,
        });

        expect(result).toEqual({
            success: false,
            error: "Invalid wallet SDK JWT",
            statusCode: 401,
        });
        expect(
            OrchestrationContext.orchestrators.identity.resolveForAttribution
        ).not.toHaveBeenCalled();
    });

    it("falls back to the anonymous identity when the wallet JWT is expired", async () => {
        // The SDK caches the wallet-status token client-side (1 day TTL), so a
        // stale x-wallet-sdk-auth alongside a good x-frak-client-id is routine
        // and must not 401 the whole interaction.
        vi.mocked(
            OrchestrationContext.orchestrators.identity.resolveForAttribution
        ).mockResolvedValue({ groupId: "anon-group" });
        JwtContextMock.walletSdk.verify.mockResolvedValue(null as never);

        const result = await resolveSdkIdentity({
            headers: {
                "x-frak-client-id": VICTIM_CLIENT_ID,
                "x-wallet-sdk-auth": "an-expired-jwt",
            },
            merchantId: MERCHANT_ID,
        });

        expect(result).toEqual({
            success: true,
            identityGroupId: "anon-group",
            walletAddress: undefined,
        });
        // The unverified wallet must not leak into the identity nodes.
        expect(
            OrchestrationContext.orchestrators.identity.resolveForAttribution
        ).toHaveBeenCalledWith([
            {
                type: "anonymous_fingerprint",
                value: VICTIM_CLIENT_ID,
                merchantId: MERCHANT_ID,
            },
        ]);
    });

    it("still returns 400 for a clientId with no merchantId when the JWT is absent", async () => {
        const result = await resolveSdkIdentity({
            headers: { "x-frak-client-id": VICTIM_CLIENT_ID },
        });

        expect(result).toEqual({
            success: false,
            error: "merchantId required when using x-frak-client-id",
            statusCode: 400,
        });
    });
});

describe("buildIdentityNodes", () => {
    it("omits the anonymous_fingerprint node when merchantId is missing", () => {
        const nodes = buildIdentityNodes({ clientId: VICTIM_CLIENT_ID });
        expect(nodes).toEqual([]);
    });

    it("orders wallet before anonymous_fingerprint", () => {
        const nodes = buildIdentityNodes({
            walletAddress: WALLET,
            clientId: VICTIM_CLIENT_ID,
            merchantId: MERCHANT_ID,
        });
        expect(nodes).toEqual([
            { type: "wallet", value: WALLET },
            {
                type: "anonymous_fingerprint",
                value: VICTIM_CLIENT_ID,
                merchantId: MERCHANT_ID,
            },
        ]);
    });
});
