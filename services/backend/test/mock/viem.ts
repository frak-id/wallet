import { mock, spyOn } from "bun:test";
import type { Address, Hex } from "viem";
import * as viem from "viem";

/* -------------------------------------------------------------------------- */
/*                                    Viem                                    */
/* -------------------------------------------------------------------------- */

const keccak256Spy = spyOn(viem, "keccak256");
const concatHexSpy = spyOn(viem, "concatHex");

const requestMock = mock(() => Promise.resolve("0x"));

export const viemMocks = {
    ...viem,
    // Spies
    keccak256: keccak256Spy,
    concatHex: concatHexSpy,
    // Mocks
    request: requestMock,
};

// Create proper mock functions with proper typing
const multicallMock = mock(<T = unknown>() => Promise.resolve([] as T[]));
const readContractMock = mock(<T = unknown>() =>
    Promise.resolve(undefined as T)
);
const simulateContractMock = mock(() =>
    Promise.resolve({ request: {}, result: undefined })
);
const writeContractMock = mock(() => Promise.resolve("0x" as Hex));
const waitForTransactionReceiptMock = mock(() =>
    Promise.resolve({ status: "success" as const })
);
const getTransactionCountMock = mock(() => Promise.resolve(0));
const verifyMessageMock = mock(() => Promise.resolve(true));
const getCodeMock = mock(() => Promise.resolve("0x"));
const getStorageAtMock = mock(() => Promise.resolve("0x" as Hex));
const estimateGasMock = mock(() => Promise.resolve(100000n));
const sendTransactionMock = mock(() => Promise.resolve("0x" as Hex));
const signTypedDataMock = mock(() => Promise.resolve("0x" as Hex));

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

export function mockViemActions() {
    // Mock the entire viem/actions module
    mock.module("viem/actions", () => ({
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
        prepareAuthorization: mock(() => Promise.resolve({})),
    }));
}
/* -------------------------------------------------------------------------- */
/*                               Permissionless                               */
/* -------------------------------------------------------------------------- */

const getSenderAddressMock = mock(() => Promise.resolve("0x" as Address));

export const permissionlessActionsMocks = {
    getSenderAddress: getSenderAddressMock,
};

/**
 * Mock the permissionless actions.
 */
export function mockPermissionlessActions() {
    mock.module("permissionless/actions", () => ({
        getSenderAddress: getSenderAddressMock,
    }));
}

/* -------------------------------------------------------------------------- */
/*                                     Ox                                     */
/* -------------------------------------------------------------------------- */

const oxWebAuthnP256VerifyMock = mock(() => true);

export const oxMocks = {
    WebAuthnP256: {
        verify: oxWebAuthnP256VerifyMock,
    },
};

/**
 * Mock the ox library.
 */
export function mockOx() {
    mock.module("ox", () => ({
        WebAuthnP256: {
            verify: oxWebAuthnP256VerifyMock,
        },
        Signature: {},
    }));
}
