/**
 * Viem, Permissionless, and Ox Mocks
 *
 * This file sets up mocks for blockchain-related libraries used in the backend.
 * Mocks are created at module level using vi.mock() and exported for test access.
 */

import { vi } from "vitest";
import type { Address, Hex } from "viem";

/* -------------------------------------------------------------------------- */
/*                                    Viem                                    */
/* -------------------------------------------------------------------------- */

const requestMock = vi.fn(() => Promise.resolve("0x"));

export const viemMocks = {
    request: requestMock,
};

// Create mock functions with proper typing for viem actions
const multicallMock = vi.fn(<T = unknown>() => Promise.resolve([] as T[]));
const readContractMock = vi.fn(<T = unknown>() =>
    Promise.resolve(undefined as T)
);
const simulateContractMock = vi.fn(() =>
    Promise.resolve({ request: {}, result: undefined })
);
const writeContractMock = vi.fn(() => Promise.resolve("0x" as Hex));
const waitForTransactionReceiptMock = vi.fn(() =>
    Promise.resolve({ status: "success" as const })
);
const getTransactionCountMock = vi.fn(() => Promise.resolve(0));
const verifyMessageMock = vi.fn(() => Promise.resolve(true));
const getCodeMock = vi.fn(() => Promise.resolve("0x"));
const getStorageAtMock = vi.fn(() => Promise.resolve("0x" as Hex));
const estimateGasMock = vi.fn(() => Promise.resolve(100000n));
const sendTransactionMock = vi.fn(() => Promise.resolve("0x" as Hex));
const signTypedDataMock = vi.fn(() => Promise.resolve("0x" as Hex));

export const viemActionsMocks = {
    multicall: multicallMock,
    readContract: readContractMock,
    simulateContract: simulateContractMock,
    writeContract: writeContractMock,
    waitForTransactionReceipt: waitForTransactionReceiptMock,
    getTransactionCount: getTransactionCountMock,
    verifyMessage: verifyMessageMock,
    getCode: getCodeMock,
    getStorageAt: getStorageAtMock,
    estimateGas: estimateGasMock,
    sendTransaction: sendTransactionMock,
    signTypedData: signTypedDataMock,
};

// Mock the entire viem/actions module at module level
vi.mock("viem/actions", () => ({
    multicall: multicallMock,
    readContract: readContractMock,
    simulateContract: simulateContractMock,
    writeContract: writeContractMock,
    waitForTransactionReceipt: waitForTransactionReceiptMock,
    getTransactionCount: getTransactionCountMock,
    verifyMessage: verifyMessageMock,
    getCode: getCodeMock,
    getStorageAt: getStorageAtMock,
    estimateGas: estimateGasMock,
    sendTransaction: sendTransactionMock,
    signTypedData: signTypedDataMock,
    prepareAuthorization: vi.fn(() => Promise.resolve({})),
}));
/* -------------------------------------------------------------------------- */
/*                               Permissionless                               */
/* -------------------------------------------------------------------------- */

const getSenderAddressMock = vi.fn(() => Promise.resolve("0x" as Address));

export const permissionlessActionsMocks = {
    getSenderAddress: getSenderAddressMock,
};

// Mock permissionless/actions at module level
vi.mock("permissionless/actions", () => ({
    getSenderAddress: getSenderAddressMock,
}));

/* -------------------------------------------------------------------------- */
/*                                     Ox                                     */
/* -------------------------------------------------------------------------- */

const oxWebAuthnP256VerifyMock = vi.fn(() => true);

export const oxMocks = {
    WebAuthnP256: {
        verify: oxWebAuthnP256VerifyMock,
    },
};

// Mock ox library at module level
vi.mock("ox", () => ({
    WebAuthnP256: {
        verify: oxWebAuthnP256VerifyMock,
    },
    Signature: {},
}));
