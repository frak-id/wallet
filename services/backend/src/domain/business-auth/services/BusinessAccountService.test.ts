import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessAccountSelect } from "../db/schema";
import type { BusinessAccountRepository } from "../repositories/BusinessAccountRepository";
import { BusinessAccountService } from "./BusinessAccountService";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const ACCOUNT_ID = "acc-1";

/** A postgres-js unique_violation (SQLSTATE 23505), duck-typed. */
const UNIQUE_VIOLATION = { code: "23505" };

const account = (
    overrides: Partial<BusinessAccountSelect> = {}
): BusinessAccountSelect =>
    ({
        id: ACCOUNT_ID,
        walletAddress: null,
        email: null,
        totpActivatedAt: null,
        ...overrides,
    }) as BusinessAccountSelect;

const createRepository = () =>
    ({
        findByWallet: vi.fn(),
        insertWalletAccount: vi.fn(),
        findByShopifyUser: vi.fn(),
        findByEmail: vi.fn(),
        insertShopifyAccount: vi.fn(),
        setWallet: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
    }) as unknown as BusinessAccountRepository &
        Record<string, ReturnType<typeof vi.fn>>;

describe("BusinessAccountService", () => {
    let repository: ReturnType<typeof createRepository>;
    let service: BusinessAccountService;

    beforeEach(() => {
        repository = createRepository();
        service = new BusinessAccountService(
            repository as unknown as BusinessAccountRepository
        );
    });

    describe("upsertWalletAccount", () => {
        it("returns the existing account without inserting", async () => {
            const existing = account({ walletAddress: WALLET });
            repository.findByWallet.mockResolvedValue(existing);

            expect(await service.upsertWalletAccount(WALLET)).toBe(existing);
            expect(repository.insertWalletAccount).not.toHaveBeenCalled();
        });

        it("creates the account when the wallet was never seen", async () => {
            const created = account({ walletAddress: WALLET });
            repository.findByWallet.mockResolvedValue(null);
            repository.insertWalletAccount.mockResolvedValue(created);

            expect(await service.upsertWalletAccount(WALLET)).toBe(created);
        });

        it("resolves the concurrent winner when it loses the insert race", async () => {
            const winner = account({ walletAddress: WALLET });
            // Not found, our insert hit ON CONFLICT DO NOTHING (null), then the
            // winner's row is authoritative.
            repository.findByWallet
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(winner);
            repository.insertWalletAccount.mockResolvedValue(null);

            expect(await service.upsertWalletAccount(WALLET)).toBe(winner);
        });

        it("throws when neither insert nor re-read resolves a row", async () => {
            repository.findByWallet.mockResolvedValue(null);
            repository.insertWalletAccount.mockResolvedValue(null);

            await expect(service.upsertWalletAccount(WALLET)).rejects.toThrow(
                /failed to resolve/
            );
        });
    });

    describe("createInvitedAccount", () => {
        const EMAIL = "invitee@acme.com";

        it("creates the credential-less account", async () => {
            const created = account({ email: EMAIL });
            repository.create.mockResolvedValue(created);

            expect(await service.createInvitedAccount(EMAIL)).toBe(created);
            expect(repository.create).toHaveBeenCalledWith({ email: EMAIL });
        });

        it("resolves the concurrent winner on a create race (existing account, resend/cross-merchant invite)", async () => {
            const winner = account({ email: EMAIL });
            repository.create.mockRejectedValue(UNIQUE_VIOLATION);
            repository.findByEmail.mockResolvedValue(winner);

            expect(await service.createInvitedAccount(EMAIL)).toBe(winner);
        });

        it("throws when the race winner can't be re-read", async () => {
            repository.create.mockRejectedValue(UNIQUE_VIOLATION);
            repository.findByEmail.mockResolvedValue(null);

            await expect(service.createInvitedAccount(EMAIL)).rejects.toThrow(
                /failed to resolve/
            );
        });

        it("rethrows a non-unique-violation insert error", async () => {
            repository.create.mockRejectedValue(new Error("connection reset"));

            await expect(service.createInvitedAccount(EMAIL)).rejects.toThrow(
                "connection reset"
            );
        });
    });

    describe("upsertShopifyAccount", () => {
        const params = {
            shopifyUserId: "shopify-1",
            shopDomain: "my-shop.myshopify.com",
            email: "staff@my-shop.com",
        };

        it("returns the existing account without inserting", async () => {
            const existing = account();
            repository.findByShopifyUser.mockResolvedValue(existing);

            expect(await service.upsertShopifyAccount(params)).toBe(existing);
            expect(repository.insertShopifyAccount).not.toHaveBeenCalled();
        });

        it("prefills the email when it is free", async () => {
            const created = account({ email: params.email });
            repository.findByShopifyUser.mockResolvedValue(null);
            repository.findByEmail.mockResolvedValue(null);
            repository.insertShopifyAccount.mockResolvedValue(created);

            expect(await service.upsertShopifyAccount(params)).toBe(created);
            expect(repository.insertShopifyAccount).toHaveBeenCalledWith(
                expect.objectContaining({ email: params.email })
            );
        });

        it("skips the email prefill when it is already taken", async () => {
            const created = account();
            repository.findByShopifyUser.mockResolvedValue(null);
            // Another account already owns this email.
            repository.findByEmail.mockResolvedValue(account({ id: "other" }));
            repository.insertShopifyAccount.mockResolvedValue(created);

            expect(await service.upsertShopifyAccount(params)).toBe(created);
            expect(repository.insertShopifyAccount).toHaveBeenCalledWith(
                expect.objectContaining({ email: undefined })
            );
        });

        it("retries without the email on a prefill unique-violation race", async () => {
            const retried = account();
            repository.findByShopifyUser.mockResolvedValue(null);
            repository.findByEmail.mockResolvedValue(null);
            repository.insertShopifyAccount
                // First attempt (with email) races another account's email.
                .mockRejectedValueOnce(UNIQUE_VIOLATION)
                // Retry without the email succeeds.
                .mockResolvedValueOnce(retried);

            expect(await service.upsertShopifyAccount(params)).toBe(retried);
            expect(repository.insertShopifyAccount).toHaveBeenCalledTimes(2);
            // The retry must not re-send the colliding email.
            const retryArg = repository.insertShopifyAccount.mock.calls[1][0];
            expect(retryArg.email).toBeUndefined();
        });

        it("rethrows a non-unique-violation insert error", async () => {
            repository.findByShopifyUser.mockResolvedValue(null);
            repository.findByEmail.mockResolvedValue(null);
            repository.insertShopifyAccount.mockRejectedValue(
                new Error("connection reset")
            );

            await expect(service.upsertShopifyAccount(params)).rejects.toThrow(
                "connection reset"
            );
        });

        it("resolves the concurrent winner on an identity conflict", async () => {
            const winner = account();
            repository.findByShopifyUser
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(winner);
            repository.findByEmail.mockResolvedValue(null);
            // Identity index conflict → null (not a throw).
            repository.insertShopifyAccount.mockResolvedValue(null);

            expect(await service.upsertShopifyAccount(params)).toBe(winner);
        });
    });

    describe("getEnabledTwoFactorMethods", () => {
        it("returns [] for an unknown account", async () => {
            repository.findById.mockResolvedValue(null);
            expect(
                await service.getEnabledTwoFactorMethods(ACCOUNT_ID)
            ).toEqual([]);
        });

        it("returns email only for an email-only account", async () => {
            repository.findById.mockResolvedValue(
                account({ email: "a@b.com" })
            );
            expect(
                await service.getEnabledTwoFactorMethods(ACCOUNT_ID)
            ).toEqual(["email"]);
        });

        it("offers email, totp and siwe together as peers", async () => {
            repository.findById.mockResolvedValue(
                account({
                    email: "a@b.com",
                    totpActivatedAt: new Date(),
                    walletAddress: WALLET,
                })
            );
            expect(
                await service.getEnabledTwoFactorMethods(ACCOUNT_ID)
            ).toEqual(["email", "totp", "siwe"]);
        });

        it("returns totp and siwe for a walletless-email TOTP account", async () => {
            repository.findById.mockResolvedValue(
                account({ totpActivatedAt: new Date(), walletAddress: WALLET })
            );
            expect(
                await service.getEnabledTwoFactorMethods(ACCOUNT_ID)
            ).toEqual(["totp", "siwe"]);
        });
    });

    describe("linkWallet", () => {
        it("reports alreadyLinked when the wallet is this account's", async () => {
            repository.findByWallet.mockResolvedValue(
                account({ id: ACCOUNT_ID, walletAddress: WALLET })
            );

            expect(
                await service.linkWallet({
                    accountId: ACCOUNT_ID,
                    wallet: WALLET,
                })
            ).toEqual({ status: "alreadyLinked" });
            expect(repository.setWallet).not.toHaveBeenCalled();
        });

        it("reports walletTaken when another account owns the wallet", async () => {
            repository.findByWallet.mockResolvedValue(
                account({ id: "other", walletAddress: WALLET })
            );

            expect(
                await service.linkWallet({
                    accountId: ACCOUNT_ID,
                    wallet: WALLET,
                })
            ).toEqual({ status: "walletTaken" });
        });

        it("links a free wallet", async () => {
            repository.findByWallet.mockResolvedValue(null);
            repository.setWallet.mockResolvedValue(undefined);

            expect(
                await service.linkWallet({
                    accountId: ACCOUNT_ID,
                    wallet: WALLET,
                })
            ).toEqual({ status: "linked" });
        });

        it("maps a setWallet unique-violation race to walletTaken", async () => {
            repository.findByWallet.mockResolvedValue(null);
            repository.setWallet.mockRejectedValue(UNIQUE_VIOLATION);

            expect(
                await service.linkWallet({
                    accountId: ACCOUNT_ID,
                    wallet: WALLET,
                })
            ).toEqual({ status: "walletTaken" });
        });
    });
});
