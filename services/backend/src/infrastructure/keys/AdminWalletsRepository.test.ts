import { beforeEach, describe, expect, it } from "vitest";
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
});
