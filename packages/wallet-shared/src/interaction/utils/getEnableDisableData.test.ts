import * as appEssentials from "@frak-labs/app-essentials";
import type { Address, Hex } from "viem";
import * as viem from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as multicall from "../../wallet/utils/multicall";
import {
    getDisableSessionData,
    getEnableSessionData,
} from "./getEnableDisableData";

// Mock dependencies
vi.mock("viem", async () => {
    const actual = await vi.importActual("viem");
    return {
        ...actual,
        encodeFunctionData: vi.fn(),
    };
});

vi.mock("../../wallet/utils/multicall", () => ({
    encodeWalletMulticall: vi.fn(),
}));

describe("getEnableDisableData utils", () => {
    const mockWallet = "0x1234567890123456789012345678901234567890" as Address;
    const mockEncodedTx1 = "0xabc123" as Hex;
    const mockEncodedTx2 = "0xdef456" as Hex;
    const mockMulticallResult = "0x789ghi" as Hex;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEnableSessionData", () => {
        it("should generate enable session data with correct timestamps", () => {
            const sessionEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
            const startTimestamp = Math.floor(Date.now() / 1000);
            const endTimestamp = Math.floor(sessionEnd.getTime() / 1000);

            vi.mocked(viem.encodeFunctionData)
                .mockReturnValueOnce(mockEncodedTx1)
                .mockReturnValueOnce(mockEncodedTx2);
            vi.mocked(multicall.encodeWalletMulticall).mockReturnValue(
                mockMulticallResult
            );

            const result = getEnableSessionData({
                sessionEnd,
                wallet: mockWallet,
            });

            // Verify encodeFunctionData was called twice (once per selector)
            expect(viem.encodeFunctionData).toHaveBeenCalledTimes(2);

            // Verify first call includes sendInteractionSelector
            expect(viem.encodeFunctionData).toHaveBeenNthCalledWith(1, {
                abi: expect.any(Array),
                functionName: "setExecution",
                args: [
                    appEssentials.sendInteractionSelector,
                    appEssentials.addresses.interactionDelegatorAction,
                    appEssentials.addresses.interactionDelegatorValidator,
                    endTimestamp,
                    startTimestamp,
                    "0x00",
                ],
            });

            // Verify second call includes sendInteractionsSelector
            expect(viem.encodeFunctionData).toHaveBeenNthCalledWith(2, {
                abi: expect.any(Array),
                functionName: "setExecution",
                args: [
                    appEssentials.sendInteractionsSelector,
                    appEssentials.addresses.interactionDelegatorAction,
                    appEssentials.addresses.interactionDelegatorValidator,
                    endTimestamp,
                    startTimestamp,
                    "0x00",
                ],
            });

            // Verify multicall encoding
            expect(multicall.encodeWalletMulticall).toHaveBeenCalledWith([
                { to: mockWallet, data: mockEncodedTx1 },
                { to: mockWallet, data: mockEncodedTx2 },
            ]);

            expect(result).toBe(mockMulticallResult);
        });

        it("should convert timestamps from milliseconds to seconds", () => {
            const sessionEnd = new Date("2025-12-31T23:59:59.999Z");
            const expectedEndSeconds = Math.floor(sessionEnd.getTime() / 1000);

            vi.mocked(viem.encodeFunctionData)
                .mockReturnValueOnce(mockEncodedTx1)
                .mockReturnValueOnce(mockEncodedTx2);
            vi.mocked(multicall.encodeWalletMulticall).mockReturnValue(
                mockMulticallResult
            );

            getEnableSessionData({
                sessionEnd,
                wallet: mockWallet,
            });

            // Check that timestamps are in seconds (not milliseconds)
            const firstCall = vi.mocked(viem.encodeFunctionData).mock
                .calls[0][0];
            const endTimestampArg = firstCall.args![3];

            expect(endTimestampArg).toBe(expectedEndSeconds);
            expect(endTimestampArg).toBeLessThan(Date.now()); // Seconds should be much smaller than ms
        });

        it("should use current time as start timestamp", () => {
            const sessionEnd = new Date(Date.now() + 1000000);
            const beforeCall = Math.floor(Date.now() / 1000);

            vi.mocked(viem.encodeFunctionData)
                .mockReturnValueOnce(mockEncodedTx1)
                .mockReturnValueOnce(mockEncodedTx2);
            vi.mocked(multicall.encodeWalletMulticall).mockReturnValue(
                mockMulticallResult
            );

            getEnableSessionData({
                sessionEnd,
                wallet: mockWallet,
            });

            const afterCall = Math.floor(Date.now() / 1000);

            const firstCall = vi.mocked(viem.encodeFunctionData).mock
                .calls[0][0];
            const startTimestampArg = firstCall.args![4];

            // Start timestamp should be within reasonable range of now
            expect(startTimestampArg).toBeGreaterThanOrEqual(beforeCall);
            expect(startTimestampArg).toBeLessThanOrEqual(afterCall);
        });

        it("should create multicall with wallet as target address", () => {
            const sessionEnd = new Date(Date.now() + 1000000);

            vi.mocked(viem.encodeFunctionData)
                .mockReturnValueOnce(mockEncodedTx1)
                .mockReturnValueOnce(mockEncodedTx2);
            vi.mocked(multicall.encodeWalletMulticall).mockReturnValue(
                mockMulticallResult
            );

            getEnableSessionData({
                sessionEnd,
                wallet: mockWallet,
            });

            expect(multicall.encodeWalletMulticall).toHaveBeenCalledWith([
                { to: mockWallet, data: mockEncodedTx1 },
                { to: mockWallet, data: mockEncodedTx2 },
            ]);
        });

        it("should enable both sendInteraction and sendInteractions selectors", () => {
            const sessionEnd = new Date(Date.now() + 1000000);

            vi.mocked(viem.encodeFunctionData)
                .mockReturnValueOnce(mockEncodedTx1)
                .mockReturnValueOnce(mockEncodedTx2);
            vi.mocked(multicall.encodeWalletMulticall).mockReturnValue(
                mockMulticallResult
            );

            getEnableSessionData({
                sessionEnd,
                wallet: mockWallet,
            });

            // Verify both selectors are used
            const calls = vi.mocked(viem.encodeFunctionData).mock.calls;
            expect(calls[0]![0].args![0]).toBe(
                appEssentials.sendInteractionSelector
            );
            expect(calls[1]![0].args![0]).toBe(
                appEssentials.sendInteractionsSelector
            );
        });
    });

    describe("getDisableSessionData", () => {
        it("should generate disable session data with zero timestamps", () => {
            vi.mocked(viem.encodeFunctionData)
                .mockReturnValueOnce(mockEncodedTx1)
                .mockReturnValueOnce(mockEncodedTx2);
            vi.mocked(multicall.encodeWalletMulticall).mockReturnValue(
                mockMulticallResult
            );

            const result = getDisableSessionData({
                wallet: mockWallet,
            });

            // Verify encodeFunctionData was called twice
            expect(viem.encodeFunctionData).toHaveBeenCalledTimes(2);

            // Verify first call uses zeroAddress and zero timestamps
            expect(viem.encodeFunctionData).toHaveBeenNthCalledWith(1, {
                abi: expect.any(Array),
                functionName: "setExecution",
                args: [
                    appEssentials.sendInteractionSelector,
                    viem.zeroAddress,
                    appEssentials.addresses.interactionDelegatorValidator,
                    0,
                    0,
                    "0x00",
                ],
            });

            // Verify second call uses zeroAddress and zero timestamps
            expect(viem.encodeFunctionData).toHaveBeenNthCalledWith(2, {
                abi: expect.any(Array),
                functionName: "setExecution",
                args: [
                    appEssentials.sendInteractionsSelector,
                    viem.zeroAddress,
                    appEssentials.addresses.interactionDelegatorValidator,
                    0,
                    0,
                    "0x00",
                ],
            });

            expect(result).toBe(mockMulticallResult);
        });

        it("should use zeroAddress as action address to disable", () => {
            vi.mocked(viem.encodeFunctionData)
                .mockReturnValueOnce(mockEncodedTx1)
                .mockReturnValueOnce(mockEncodedTx2);
            vi.mocked(multicall.encodeWalletMulticall).mockReturnValue(
                mockMulticallResult
            );

            getDisableSessionData({
                wallet: mockWallet,
            });

            // Verify zeroAddress is used (second argument)
            const calls = vi.mocked(viem.encodeFunctionData).mock.calls;
            expect(calls[0]![0].args![1]).toBe(viem.zeroAddress);
            expect(calls[1]![0].args![1]).toBe(viem.zeroAddress);
        });

        it("should create multicall with wallet as target address", () => {
            vi.mocked(viem.encodeFunctionData)
                .mockReturnValueOnce(mockEncodedTx1)
                .mockReturnValueOnce(mockEncodedTx2);
            vi.mocked(multicall.encodeWalletMulticall).mockReturnValue(
                mockMulticallResult
            );

            getDisableSessionData({
                wallet: mockWallet,
            });

            expect(multicall.encodeWalletMulticall).toHaveBeenCalledWith([
                { to: mockWallet, data: mockEncodedTx1 },
                { to: mockWallet, data: mockEncodedTx2 },
            ]);
        });

        it("should disable both sendInteraction and sendInteractions selectors", () => {
            vi.mocked(viem.encodeFunctionData)
                .mockReturnValueOnce(mockEncodedTx1)
                .mockReturnValueOnce(mockEncodedTx2);
            vi.mocked(multicall.encodeWalletMulticall).mockReturnValue(
                mockMulticallResult
            );

            getDisableSessionData({
                wallet: mockWallet,
            });

            // Verify both selectors are used
            const calls = vi.mocked(viem.encodeFunctionData).mock.calls;
            expect(calls[0]![0].args![0]).toBe(
                appEssentials.sendInteractionSelector
            );
            expect(calls[1]![0].args![0]).toBe(
                appEssentials.sendInteractionsSelector
            );
        });
    });
});
