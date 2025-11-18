import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminWalletsRepository } from "./AdminWalletsRepository";

describe("AdminWalletsRepository", () => {
    let repository: AdminWalletsRepository;
    const mockMasterKey =
        "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    beforeEach(() => {
        // Set up environment variable for master key
        process.env.MASTER_KEY_SECRET = JSON.stringify({
            masterPrivateKey: mockMasterKey,
        });

        // Create a fresh instance for each test
        repository = new AdminWalletsRepository();
    });

    describe("getProductSpecificAccount", () => {
        it("should return an account for a given product ID", async () => {
            const productId = 123n;

            const account = await repository.getProductSpecificAccount({
                productId,
            });

            expect(account).toBeDefined();
            expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
            expect(account.signMessage).toBeDefined();
            expect(account.signTransaction).toBeDefined();
        });

        it("should return the same account for the same product ID (caching)", async () => {
            const productId = 456n;

            const account1 = await repository.getProductSpecificAccount({
                productId,
            });
            const account2 = await repository.getProductSpecificAccount({
                productId,
            });

            expect(account1.address).toBe(account2.address);
        });

        it("should return different accounts for different product IDs", async () => {
            const productId1 = 123n;
            const productId2 = 456n;

            const account1 = await repository.getProductSpecificAccount({
                productId: productId1,
            });
            const account2 = await repository.getProductSpecificAccount({
                productId: productId2,
            });

            expect(account1.address).not.toBe(account2.address);
        });
    });

    describe("getKeySpecificAccount", () => {
        it("should return an account for interaction-executor key", async () => {
            const account = await repository.getKeySpecificAccount({
                key: "interaction-executor",
            });

            expect(account).toBeDefined();
            expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        });

        it("should return an account for oracle-updater key", async () => {
            const account = await repository.getKeySpecificAccount({
                key: "oracle-updater",
            });

            expect(account).toBeDefined();
            expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        });

        it("should return an account for minter key", async () => {
            const account = await repository.getKeySpecificAccount({
                key: "minter",
            });

            expect(account).toBeDefined();
            expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        });

        it("should return an account for custom key", async () => {
            const account = await repository.getKeySpecificAccount({
                key: "custom-key",
            });

            expect(account).toBeDefined();
            expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        });

        it("should return the same account for the same key (caching)", async () => {
            const key = "interaction-executor";

            const account1 = await repository.getKeySpecificAccount({ key });
            const account2 = await repository.getKeySpecificAccount({ key });

            expect(account1.address).toBe(account2.address);
        });

        it("should return different accounts for different keys", async () => {
            const account1 = await repository.getKeySpecificAccount({
                key: "interaction-executor",
            });
            const account2 = await repository.getKeySpecificAccount({
                key: "oracle-updater",
            });

            expect(account1.address).not.toBe(account2.address);
        });
    });

    describe("getMutexForAccount", () => {
        it("should return a mutex for a given key", () => {
            const mutex = repository.getMutexForAccount({
                key: "interaction-executor",
            });

            expect(mutex).toBeDefined();
            expect(mutex.isLocked).toBeDefined();
            expect(mutex.acquire).toBeDefined();
        });

        it("should return the same mutex for the same key", () => {
            const key = "interaction-executor";

            const mutex1 = repository.getMutexForAccount({ key });
            const mutex2 = repository.getMutexForAccount({ key });

            expect(mutex1).toBe(mutex2);
        });

        it("should return different mutexes for different keys", () => {
            const mutex1 = repository.getMutexForAccount({
                key: "interaction-executor",
            });
            const mutex2 = repository.getMutexForAccount({
                key: "oracle-updater",
            });

            expect(mutex1).not.toBe(mutex2);
        });

        it("should allow acquiring and releasing mutex", async () => {
            const mutex = repository.getMutexForAccount({
                key: "interaction-executor",
            });

            expect(mutex.isLocked()).toBe(false);

            const release = await mutex.acquire();
            expect(mutex.isLocked()).toBe(true);

            release();
            expect(mutex.isLocked()).toBe(false);
        });
    });

    describe("error handling", () => {
        it("should throw error when MASTER_KEY_SECRET is missing", async () => {
            delete process.env.MASTER_KEY_SECRET;
            const newRepository = new AdminWalletsRepository();

            await expect(
                newRepository.getProductSpecificAccount({ productId: 123n })
            ).rejects.toThrow("Missing MASTER_KEY_SECRET");
        });

        it("should throw error when masterPrivateKey is missing in secret", async () => {
            process.env.MASTER_KEY_SECRET = JSON.stringify({});
            const newRepository = new AdminWalletsRepository();

            await expect(
                newRepository.getProductSpecificAccount({ productId: 123n })
            ).rejects.toThrow("Missing masterPrivateKey in the secret");
        });
    });

    describe("caching behavior", () => {
        it("should cache master private key", async () => {
            const spy = vi.spyOn(JSON, "parse");

            // First call should parse the env variable
            await repository.getProductSpecificAccount({ productId: 123n });
            const firstCallCount = spy.mock.calls.length;

            // Second call should use cache
            await repository.getProductSpecificAccount({ productId: 456n });
            const secondCallCount = spy.mock.calls.length;

            // Should not parse again (same call count)
            expect(secondCallCount).toBe(firstCallCount);

            spy.mockRestore();
        });

        it("should cache derived keys", async () => {
            const productId = 789n;

            // First call
            const account1 = await repository.getProductSpecificAccount({
                productId,
            });

            // Second call should return cached result
            const account2 = await repository.getProductSpecificAccount({
                productId,
            });

            // Should have the same address (cached private key)
            expect(account1.address).toBe(account2.address);
        });
    });
});
