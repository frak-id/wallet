import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { pairingKey } from "./index";

describe("pairingKey", () => {
    describe("getInfo", () => {
        it("should generate key with id", () => {
            const id = "pairing-123";
            const result = pairingKey.getInfo(id);

            expect(result).toEqual(["pairing", id]);
        });

        it("should generate key with empty string when id is undefined", () => {
            const result = pairingKey.getInfo(undefined);

            expect(result).toEqual(["pairing", ""]);
        });

        it("should generate key with empty string when no id provided", () => {
            const result = pairingKey.getInfo();

            expect(result).toEqual(["pairing", ""]);
        });

        it("should return array with exactly 2 elements", () => {
            const result = pairingKey.getInfo("test-id");

            expect(result).toHaveLength(2);
        });

        it("should be deterministic for same id", () => {
            const id = "pairing-456";
            const result1 = pairingKey.getInfo(id);
            const result2 = pairingKey.getInfo(id);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different ids", () => {
            const result1 = pairingKey.getInfo("id-1");
            const result2 = pairingKey.getInfo("id-2");

            expect(result1).not.toEqual(result2);
        });
    });

    describe("remove", () => {
        it("should return constant mutation key", () => {
            expect(pairingKey.remove).toEqual(["pairing", "delete"]);
        });

        it("should be an array with 2 elements", () => {
            expect(pairingKey.remove).toHaveLength(2);
        });

        it("should always return the same reference", () => {
            const ref1 = pairingKey.remove;
            const ref2 = pairingKey.remove;

            expect(ref1).toBe(ref2);
        });
    });

    describe("listByWallet", () => {
        it("should generate key with wallet address", () => {
            const wallet =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;
            const result = pairingKey.listByWallet(wallet);

            expect(result).toEqual(["pairing", "list", wallet]);
        });

        it("should generate key with undefined when no wallet provided", () => {
            const result = pairingKey.listByWallet(undefined);

            expect(result).toEqual(["pairing", "list", undefined]);
        });

        it("should generate key with undefined when wallet is undefined", () => {
            const result = pairingKey.listByWallet();

            expect(result).toEqual(["pairing", "list", undefined]);
        });

        it("should return array with exactly 3 elements", () => {
            const result = pairingKey.listByWallet("0xabc" as Address);

            expect(result).toHaveLength(3);
        });

        it("should be deterministic for same wallet", () => {
            const wallet =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;
            const result1 = pairingKey.listByWallet(wallet);
            const result2 = pairingKey.listByWallet(wallet);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different wallets", () => {
            const wallet1 =
                "0x1111111111111111111111111111111111111111" as Address;
            const wallet2 =
                "0x2222222222222222222222222222222222222222" as Address;

            const result1 = pairingKey.listByWallet(wallet1);
            const result2 = pairingKey.listByWallet(wallet2);

            expect(result1).not.toEqual(result2);
        });
    });

    describe("target namespace", () => {
        describe("handleSignatureRequest", () => {
            it("should generate key with wallet address", () => {
                const wallet =
                    "0x1234567890abcdef1234567890abcdef12345678" as Address;
                const result = pairingKey.target.handleSignatureRequest(wallet);

                expect(result).toEqual([
                    "pairing",
                    "target",
                    "signature-request",
                    wallet,
                ]);
            });

            it("should generate key with undefined when no wallet provided", () => {
                const result =
                    pairingKey.target.handleSignatureRequest(undefined);

                expect(result).toEqual([
                    "pairing",
                    "target",
                    "signature-request",
                    undefined,
                ]);
            });

            it("should generate key with undefined when wallet is undefined", () => {
                const result = pairingKey.target.handleSignatureRequest();

                expect(result).toEqual([
                    "pairing",
                    "target",
                    "signature-request",
                    undefined,
                ]);
            });

            it("should return array with exactly 4 elements", () => {
                const result = pairingKey.target.handleSignatureRequest(
                    "0xabc" as Address
                );

                expect(result).toHaveLength(4);
            });

            it("should include base keys", () => {
                const result = pairingKey.target.handleSignatureRequest(
                    "0xabc" as Address
                );

                expect(result[0]).toBe("pairing");
                expect(result[1]).toBe("target");
                expect(result[2]).toBe("signature-request");
            });

            it("should be deterministic for same wallet", () => {
                const wallet =
                    "0x1234567890abcdef1234567890abcdef12345678" as Address;
                const result1 =
                    pairingKey.target.handleSignatureRequest(wallet);
                const result2 =
                    pairingKey.target.handleSignatureRequest(wallet);

                expect(result1).toEqual(result2);
            });

            it("should generate different keys for different wallets", () => {
                const wallet1 =
                    "0x1111111111111111111111111111111111111111" as Address;
                const wallet2 =
                    "0x2222222222222222222222222222222222222222" as Address;

                const result1 =
                    pairingKey.target.handleSignatureRequest(wallet1);
                const result2 =
                    pairingKey.target.handleSignatureRequest(wallet2);

                expect(result1).not.toEqual(result2);
            });
        });
    });
});
