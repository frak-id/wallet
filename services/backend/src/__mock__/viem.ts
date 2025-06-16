import { mock, spyOn } from "bun:test";
import * as permissionlessActions from "permissionless/actions";
import * as viem from "viem";
import * as viemActions from "viem/actions";

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

let multicallSpy = spyOn(viemActions, "multicall");
let readContractSpy = spyOn(viemActions, "readContract");
let simulateContractSpy = spyOn(viemActions, "simulateContract");
let writeContractSpy = spyOn(viemActions, "writeContract");
let waitForTransactionReceiptSpy = spyOn(
    viemActions,
    "waitForTransactionReceipt"
);

export const viemActionsMocks = {
    multicall: multicallSpy,
    readContract: readContractSpy,
    simulateContract: simulateContractSpy,
    writeContract: writeContractSpy,
    waitForTransactionReceipt: waitForTransactionReceiptSpy,
};

export function mockViemActions() {
    multicallSpy = spyOn(viemActions, "multicall");
    readContractSpy = spyOn(viemActions, "readContract");
    simulateContractSpy = spyOn(viemActions, "simulateContract");
    writeContractSpy = spyOn(viemActions, "writeContract");
    waitForTransactionReceiptSpy = spyOn(
        viemActions,
        "waitForTransactionReceipt"
    );

    viemActionsMocks.multicall = multicallSpy;
    viemActionsMocks.readContract = readContractSpy;
    viemActionsMocks.simulateContract = simulateContractSpy;
    viemActionsMocks.writeContract = writeContractSpy;
    viemActionsMocks.waitForTransactionReceipt = waitForTransactionReceiptSpy;
}

/* -------------------------------------------------------------------------- */
/*                               Permissionless                               */
/* -------------------------------------------------------------------------- */

let getSenderAddressSpy = spyOn(permissionlessActions, "getSenderAddress");

export const permissionlessActionsMocks = {
    getSenderAddress: getSenderAddressSpy,
};

/**
 * Mock the permissionless actions.
 */
export function mockPermissionlessActions() {
    getSenderAddressSpy = spyOn(permissionlessActions, "getSenderAddress");
    permissionlessActionsMocks.getSenderAddress = getSenderAddressSpy;
}
