import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecoveryClaimOrchestrator } from "./RecoveryClaimOrchestrator";

vi.mock("@simplewebauthn/server", () => ({
    verifyRegistrationResponse: vi.fn(),
}));

const mockVerify = vi.mocked(verifyRegistrationResponse);

const WALLET = "0x1111111111111111111111111111111111111111" as const;
const CRED_ID = "cred-abc";
const PUBLIC_KEY = { x: "0x01", y: "0x02", prefix: 4 } as const;

function verifiedRegistration() {
    return {
        verified: true,
        registrationInfo: {
            credential: {
                id: CRED_ID,
                publicKey: new Uint8Array([1, 2, 3]),
                counter: 0,
                transports: ["internal"],
            },
            credentialDeviceType: "singleDevice",
            credentialBackedUp: false,
        },
    };
}

function makeOrchestrator() {
    const authenticatorRepository = {
        createAuthenticator: vi.fn().mockResolvedValue({
            created: true,
            document: { publicKey: { x: PUBLIC_KEY.x, y: PUBLIC_KEY.y } },
        }),
    };
    const walletBindingRepository = { seedInitialBinding: vi.fn() };
    const webAuthNService = {
        parseCompressedResponse: vi.fn().mockReturnValue({}),
    };
    const webAuthNValidatorReader = {
        getPasskey: vi.fn().mockResolvedValue({ x: 1n, y: 2n }),
    };
    const identityOrchestrator = { linkWalletToFingerprint: vi.fn() };
    const walletSessionOrchestrator = {
        mintSessionForExplicitWallet: vi
            .fn()
            .mockResolvedValue({ token: "jwt", address: WALLET }),
    };

    const orchestrator = new RecoveryClaimOrchestrator(
        authenticatorRepository as never,
        walletBindingRepository as never,
        webAuthNService as never,
        webAuthNValidatorReader as never,
        identityOrchestrator as never,
        walletSessionOrchestrator as never
    );

    return {
        orchestrator,
        authenticatorRepository,
        walletBindingRepository,
        webAuthNValidatorReader,
        identityOrchestrator,
        walletSessionOrchestrator,
    };
}

const params = {
    id: CRED_ID,
    publicKey: PUBLIC_KEY,
    raw: "raw-registration",
    userAgent: "test-agent",
    recoveredWallet: WALLET,
};

describe("RecoveryClaimOrchestrator", () => {
    beforeEach(() => {
        mockVerify.mockResolvedValue(verifiedRegistration() as never);
    });

    it("binds the passkey to the recovered wallet and mints its session", async () => {
        const ctx = makeOrchestrator();

        const result = await ctx.orchestrator.claimRecoveredWallet(params);

        expect(result.status).toBe("claimed");
        // Bound to the RECOVERED wallet, on the active chain — never derived.
        expect(
            ctx.walletBindingRepository.seedInitialBinding
        ).toHaveBeenCalledWith({
            credentialId: CRED_ID,
            chainId: currentChainId,
            smartWalletAddress: WALLET,
        });
        // Anchored on the wallet's existing identity group, not a new one.
        expect(
            ctx.identityOrchestrator.linkWalletToFingerprint
        ).toHaveBeenCalledWith(
            expect.objectContaining({ walletAddress: WALLET })
        );
        expect(
            ctx.walletSessionOrchestrator.mintSessionForExplicitWallet
        ).toHaveBeenCalledWith({
            credentialId: CRED_ID,
            walletAddress: WALLET,
        });
    });

    it("rejects when the passkey is not registered on-chain for the wallet", async () => {
        const ctx = makeOrchestrator();
        ctx.webAuthNValidatorReader.getPasskey.mockResolvedValue(null);

        const result = await ctx.orchestrator.claimRecoveredWallet(params);

        expect(result.status).toBe("notAuthorized");
        // No binding, no session — the on-chain readback is the gate.
        expect(
            ctx.authenticatorRepository.createAuthenticator
        ).not.toHaveBeenCalled();
        expect(
            ctx.walletBindingRepository.seedInitialBinding
        ).not.toHaveBeenCalled();
    });

    it("rejects when the on-chain key differs from the claimed key", async () => {
        const ctx = makeOrchestrator();
        ctx.webAuthNValidatorReader.getPasskey.mockResolvedValue({
            x: 9n,
            y: 9n,
        });

        const result = await ctx.orchestrator.claimRecoveredWallet(params);

        expect(result.status).toBe("notAuthorized");
    });

    it("rejects an unverified passkey registration", async () => {
        const ctx = makeOrchestrator();
        mockVerify.mockResolvedValue({ verified: false } as never);

        const result = await ctx.orchestrator.claimRecoveredWallet(params);

        expect(result.status).toBe("notAuthorized");
        expect(ctx.webAuthNValidatorReader.getPasskey).not.toHaveBeenCalled();
    });

    it("reports a conflict when the credential id is reused with another key", async () => {
        const ctx = makeOrchestrator();
        ctx.authenticatorRepository.createAuthenticator.mockResolvedValue({
            created: false,
            document: { publicKey: { x: "0xff", y: "0xee" } },
        });

        const result = await ctx.orchestrator.claimRecoveredWallet(params);

        expect(result.status).toBe("conflict");
    });
});
