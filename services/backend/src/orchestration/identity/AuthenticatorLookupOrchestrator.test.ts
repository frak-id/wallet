import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatorLookupOrchestrator } from "./AuthenticatorLookupOrchestrator";

const WALLET = "0x1111111111111111111111111111111111111111" as const;

function makeOrchestrator() {
    const identityRepository = {
        findEmailNode: vi.fn(),
        getWalletForGroup: vi.fn(),
    };
    const walletBindingRepository = {
        getActiveAuthenticatorIdsByWallet: vi.fn(),
    };
    const orchestrator = new AuthenticatorLookupOrchestrator(
        walletBindingRepository as never,
        identityRepository as never
    );
    return { orchestrator, identityRepository, walletBindingRepository };
}

describe("AuthenticatorLookupOrchestrator.resolveEmail", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
    });

    it("is available when no email node exists", async () => {
        ctx.identityRepository.findEmailNode.mockResolvedValue(null);

        const result = await ctx.orchestrator.resolveEmail(
            "free@test.com",
            "group-1"
        );

        expect(result).toEqual({ status: "available" });
    });

    it("is available when the address is the caller's own active email", async () => {
        ctx.identityRepository.findEmailNode.mockResolvedValue({
            groupId: "group-1",
            unlinkedAt: null,
        });

        const result = await ctx.orchestrator.resolveEmail(
            "mine@test.com",
            "group-1"
        );

        expect(result).toEqual({ status: "available" });
        expect(ctx.identityRepository.getWalletForGroup).not.toHaveBeenCalled();
    });

    it("is a merge target with wallet + credentials when actively owned by another group", async () => {
        ctx.identityRepository.findEmailNode.mockResolvedValue({
            groupId: "group-2",
            unlinkedAt: null,
        });
        ctx.identityRepository.getWalletForGroup.mockResolvedValue(WALLET);
        ctx.walletBindingRepository.getActiveAuthenticatorIdsByWallet.mockResolvedValue(
            ["cred-a", "cred-b"]
        );

        const result = await ctx.orchestrator.resolveEmail(
            "taken@test.com",
            "group-1"
        );

        expect(result).toEqual({
            status: "merge",
            wallet: WALLET,
            authenticatorIds: ["cred-a", "cred-b"],
        });
    });

    it("is a merge target with no wallet when the owning group is anonymous-only", async () => {
        ctx.identityRepository.findEmailNode.mockResolvedValue({
            groupId: "group-2",
            unlinkedAt: null,
        });
        ctx.identityRepository.getWalletForGroup.mockResolvedValue(null);

        const result = await ctx.orchestrator.resolveEmail(
            "taken@test.com",
            "group-1"
        );

        expect(result).toEqual({
            status: "merge",
            wallet: undefined,
            authenticatorIds: [],
        });
        expect(
            ctx.walletBindingRepository.getActiveAuthenticatorIdsByWallet
        ).not.toHaveBeenCalled();
    });

    it("is unavailable when the address is retired (unlinked), even on the caller's own group", async () => {
        ctx.identityRepository.findEmailNode.mockResolvedValue({
            groupId: "group-1",
            unlinkedAt: new Date(),
        });

        const result = await ctx.orchestrator.resolveEmail(
            "old@test.com",
            "group-1"
        );

        expect(result).toEqual({ status: "unavailable" });
    });

    it("treats an active foreign email as a merge target when no caller group is supplied", async () => {
        ctx.identityRepository.findEmailNode.mockResolvedValue({
            groupId: "group-2",
            unlinkedAt: null,
        });
        ctx.identityRepository.getWalletForGroup.mockResolvedValue(WALLET);
        ctx.walletBindingRepository.getActiveAuthenticatorIdsByWallet.mockResolvedValue(
            ["cred-a"]
        );

        const result = await ctx.orchestrator.resolveEmail("taken@test.com");

        expect(result).toEqual({
            status: "merge",
            wallet: WALLET,
            authenticatorIds: ["cred-a"],
        });
    });
});
