import { vi } from "vitest";

vi.mock("../displayModal", () => ({
    displayModal: vi.fn(),
}));

import type { Address, Hex } from "viem";
import { describe, expect, it } from "../../../tests/vitest-fixtures";
import type { FrakClient } from "../../types";
import { sendTransaction } from "./sendTransaction";

describe("sendTransaction", () => {
    const mockClient = {
        config: {
            metadata: {
                name: "Test App",
            },
        },
        request: vi.fn(),
    } as unknown as FrakClient;

    describe("basic usage", () => {
        it("should call displayModal with correct params for single tx", async () => {
            const { displayModal } = await import("../displayModal");

            const mockTxHash =
                "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
            vi.mocked(displayModal).mockResolvedValue({
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
                sendTransaction: { hash: mockTxHash },
            } as any);

            const txParams = {
                to: "0x1234567890123456789012345678901234567890" as Address,
                data: "0xdeadbeef" as Hex,
            };

            await sendTransaction(mockClient, { tx: txParams });

            expect(displayModal).toHaveBeenCalledWith(mockClient, {
                metadata: undefined,
                steps: {
                    login: {},
                    sendTransaction: { tx: txParams },
                },
            });
        });

        it("should return transaction hash", async () => {
            const { displayModal } = await import("../displayModal");

            const mockTxHash =
                "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
            vi.mocked(displayModal).mockResolvedValue({
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
                sendTransaction: { hash: mockTxHash },
            } as any);

            const result = await sendTransaction(mockClient, {
                tx: {
                    to: "0x1234567890123456789012345678901234567890" as Address,
                },
            });

            expect(result).toEqual({ hash: mockTxHash });
        });
    });

    describe("batched transactions", () => {
        it("should handle multiple transactions", async () => {
            const { displayModal } = await import("../displayModal");

            const mockTxHash =
                "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                sendTransaction: { hash: mockTxHash },
            } as any);

            const txParams = [
                {
                    to: "0x1234567890123456789012345678901234567890" as Address,
                    data: "0xdata1" as Hex,
                },
                {
                    to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                    data: "0xdata2" as Hex,
                },
            ];

            await sendTransaction(mockClient, { tx: txParams });

            expect(displayModal).toHaveBeenCalledWith(mockClient, {
                metadata: undefined,
                steps: {
                    login: {},
                    sendTransaction: { tx: txParams },
                },
            });
        });
    });

    describe("with metadata", () => {
        it("should pass metadata to displayModal", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                sendTransaction: { hash: "0x123" as Hex },
            } as any);

            const metadata = {
                header: {
                    title: "Send ETH",
                    icon: "https://example.com/icon.png",
                },
                context: "Send 100 wei to recipient",
            };

            await sendTransaction(mockClient, {
                tx: {
                    to: "0x1234567890123456789012345678901234567890" as Address,
                    value: "0x64" as Hex,
                },
                metadata,
            });

            expect(displayModal).toHaveBeenCalledWith(mockClient, {
                metadata,
                steps: {
                    login: {},
                    sendTransaction: {
                        tx: {
                            to: "0x1234567890123456789012345678901234567890",
                            value: "0x64",
                        },
                    },
                },
            });
        });
    });

    describe("error handling", () => {
        it("should propagate errors from displayModal", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockRejectedValue(
                new Error("Transaction rejected")
            );

            await expect(
                sendTransaction(mockClient, {
                    tx: {
                        to: "0x1234567890123456789012345678901234567890" as Address,
                    },
                })
            ).rejects.toThrow("Transaction rejected");
        });
    });
});
