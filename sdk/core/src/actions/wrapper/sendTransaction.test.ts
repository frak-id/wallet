/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    FrakClient,
    ModalRpcMetadata,
    ModalRpcStepsResultType,
    ModalStepTypes,
    SendTransactionReturnType,
    SendTransactionTxType,
} from "../../types";
import { displayModal } from "../displayModal";
import { sendTransaction } from "./sendTransaction";

// Mock displayModal
vi.mock("../displayModal", () => ({
    displayModal: vi.fn(),
}));

describe("sendTransaction", () => {
    // Mock client
    const mockClientMetadataName = "My App";
    const mockClient: FrakClient = {
        config: {
            metadata: {
                name: mockClientMetadataName,
            },
        },
    } as unknown as FrakClient;

    // Mock transaction data
    const mockTx = [
        { to: "0xdeadbeef", data: "0xdeadbeef" },
    ] as SendTransactionTxType[];

    // Mock transaction result
    const mockTxResult: SendTransactionReturnType = {
        hash: "0xabcdef",
    };

    // Mock displayModal result
    const mockModalResult = {
        login: { wallet: "0x123" },
        sendTransaction: mockTxResult,
    } as unknown as ModalRpcStepsResultType<ModalStepTypes[]>;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(displayModal).mockResolvedValue(mockModalResult);
    });

    it("should call displayModal with correct parameters", async () => {
        // Execute
        await sendTransaction(mockClient, { tx: mockTx });

        // Verify
        expect(displayModal).toHaveBeenCalledWith(mockClient, {
            metadata: undefined,
            steps: {
                login: {},
                sendTransaction: { tx: mockTx },
            },
        });
    });

    it("should return only the sendTransaction part of the result", async () => {
        // Execute
        const result = await sendTransaction(mockClient, { tx: mockTx });

        // Verify
        expect(result).toEqual(mockTxResult);
        expect(result).toBe(mockModalResult.sendTransaction);
    });

    it("should pass custom metadata to displayModal", async () => {
        // Setup - custom metadata
        const customMetadata: ModalRpcMetadata = {
            lang: "fr" as const,
            header: {
                title: "Custom Transaction",
                icon: "https://example.com/icon.png",
            },
            context: "Transaction context",
        };

        // Execute
        await sendTransaction(mockClient, {
            tx: mockTx,
            metadata: customMetadata,
        });

        // Verify
        expect(displayModal).toHaveBeenCalledWith(mockClient, {
            metadata: customMetadata,
            steps: {
                login: {},
                sendTransaction: { tx: mockTx },
            },
        });
    });

    it("should handle array of transactions", async () => {
        // Setup - multiple transactions
        const multiTx = [
            { to: "0xdeadbeef1", data: "0xdata1" },
            { to: "0xdeadbeef2", data: "0xdata2" },
        ];

        // Execute
        await sendTransaction(mockClient, {
            tx: multiTx as SendTransactionTxType[],
        });

        // Verify
        expect(displayModal).toHaveBeenCalledWith(mockClient, {
            metadata: undefined,
            steps: {
                login: {},
                sendTransaction: { tx: multiTx },
            },
        });
    });

    it("should forward errors from displayModal", async () => {
        // Setup - mock error
        const mockError = new Error("Transaction failed");
        vi.mocked(displayModal).mockRejectedValue(mockError);

        // Execute and verify
        await expect(
            sendTransaction(mockClient, { tx: mockTx })
        ).rejects.toThrow(mockError);
    });
});
