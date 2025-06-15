import { mock, spyOn } from "bun:test";
import * as permissionlessActions from "permissionless/actions";
import * as viem from "viem";

const keccak256Spy = spyOn(viem, "keccak256");
const concatHexSpy = spyOn(viem, "concatHex");

const multicallMock = mock(() => Promise.resolve([]));
const requestMock = mock(() => Promise.resolve("0x"));

export const viemMocks = {
    ...viem,
    // Spies
    keccak256: keccak256Spy,
    concatHex: concatHexSpy,
    // Mocks
    multicall: multicallMock,
    request: requestMock,
};

const getSenderAddressSpy = spyOn(permissionlessActions, "getSenderAddress");

export const permissionlessActionsMocks = {
    getSenderAddress: getSenderAddressSpy,
};
