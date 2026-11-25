import { describe, expect, it, vi } from "vitest";
import { AdminWalletsRepository } from "../../../infrastructure/keys/AdminWalletsRepository";
import type { MerchantWebhook } from "../db/schema";
import type { SubscriptionResolver, TokenCheck } from "../subscription/types";
import { SubscriptionConnectionService } from "./SubscriptionConnectionService";
import { SubscriptionCredentialsCipher } from "./SubscriptionCredentialsCipher";

vi.mock("@backend-infrastructure", () => ({
    log: { error: vi.fn(), warn: vi.fn() },
}));

const MERCHANT = "merchant-1";

const webhook = (over: Partial<MerchantWebhook> = {}): MerchantWebhook => ({
    id: 1,
    merchantId: MERCHANT,
    hookSignatureKey: "key",
    createdAt: new Date(),
    platform: "shopify",
    subscriptionProvider: null,
    subscriptionCredentials: null,
    ...over,
});

function setup(options: {
    webhook: MerchantWebhook | null;
    check?: TokenCheck;
}) {
    const repository = {
        getWebhookByMerchantId: vi.fn().mockResolvedValue(options.webhook),
        setSubscriptionConnection: vi.fn().mockResolvedValue(true),
        setSubscriptionCredentials: vi.fn().mockResolvedValue(undefined),
    };
    const resolver = {
        provider: "recharge",
        verifyToken: vi.fn().mockResolvedValue(options.check ?? "valid"),
        resolve: vi.fn(),
    } satisfies SubscriptionResolver;
    const cipher = new SubscriptionCredentialsCipher(
        new AdminWalletsRepository()
    );
    const service = new SubscriptionConnectionService(
        repository as never,
        cipher,
        { recharge: resolver }
    );
    return { service, repository, resolver };
}

async function connected() {
    const { service, repository } = setup({ webhook: webhook() });
    await service.connect({
        merchantId: MERCHANT,
        provider: "recharge",
        token: "recharge-token",
    });
    const stored = repository.setSubscriptionConnection.mock.calls[0]?.[1] as {
        provider: "recharge";
        credentials: string;
    };
    return {
        service,
        repository,
        row: webhook({
            subscriptionProvider: "recharge",
            subscriptionCredentials: stored.credentials,
        }),
        stored,
    };
}

describe("SubscriptionConnectionService.connect", () => {
    it("stores the token encrypted once the provider accepts it", async () => {
        const { stored } = await connected();

        expect(stored.provider).toBe("recharge");
        expect(stored.credentials).not.toContain("recharge-token");
    });

    it("asks the merchant to set up the order webhook first", async () => {
        const { service, repository } = setup({ webhook: null });

        await expect(
            service.connect({
                merchantId: MERCHANT,
                provider: "recharge",
                token: "recharge-token",
            })
        ).resolves.toBe("no_webhook");
        expect(repository.setSubscriptionConnection).not.toHaveBeenCalled();
    });

    it.each(["unauthorized", "unavailable"] as const)(
        "stores nothing when the token check is %s",
        async (check) => {
            const { service, repository } = setup({
                webhook: webhook(),
                check,
            });

            await expect(
                service.connect({
                    merchantId: MERCHANT,
                    provider: "recharge",
                    token: "recharge-token",
                })
            ).resolves.toBe(check);
            expect(repository.setSubscriptionConnection).not.toHaveBeenCalled();
        }
    );
});

describe("SubscriptionConnectionService.resolveProvider", () => {
    it("hands back the resolver with the decrypted token", async () => {
        const { service, row } = await connected();

        const provider = await service.resolveProvider(row);

        expect(provider?.token).toBe("recharge-token");
        expect(provider?.resolver.provider).toBe("recharge");
    });

    it("returns null for a merchant without a provider", async () => {
        const { service } = setup({ webhook: webhook() });

        await expect(service.resolveProvider(webhook())).resolves.toBeNull();
    });

    it("returns null when the stored token cannot be decrypted", async () => {
        const { service, row } = await connected();

        await expect(
            service.resolveProvider({ ...row, merchantId: "merchant-2" })
        ).resolves.toBeNull();
    });
});

describe("SubscriptionConnectionService status", () => {
    it("reports the provider and the last authentication error", async () => {
        const { service, repository, row } = await connected();
        await service.recordAuthError(row);
        const credentials = repository.setSubscriptionCredentials.mock
            .calls[0]?.[1] as string;
        repository.getWebhookByMerchantId.mockResolvedValue({
            ...row,
            subscriptionCredentials: credentials,
        });

        const status = await service.getStatus(MERCHANT);

        expect(status.provider).toBe("recharge");
        expect(status.lastError).toMatchObject({ code: "unauthorized" });
    });

    it("reports nothing for a disconnected merchant", async () => {
        const { service } = setup({ webhook: webhook() });

        await expect(service.getStatus(MERCHANT)).resolves.toEqual({
            provider: null,
            lastError: null,
        });
    });

    it("keeps the first error instead of rewriting the row on every failure", async () => {
        const { service, repository, row } = await connected();
        await service.recordAuthError(row);
        const credentials = repository.setSubscriptionCredentials.mock
            .calls[0]?.[1] as string;

        await service.recordAuthError({
            ...row,
            subscriptionCredentials: credentials,
        });

        expect(repository.setSubscriptionCredentials).toHaveBeenCalledOnce();
    });

    it("clears the connection on disconnect", async () => {
        const { service, repository } = setup({ webhook: webhook() });

        await service.disconnect(MERCHANT);

        expect(repository.setSubscriptionConnection).toHaveBeenCalledWith(
            MERCHANT,
            null
        );
    });
});
