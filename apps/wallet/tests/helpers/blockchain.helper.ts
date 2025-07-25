import {
    addresses,
    getExecutionAbi,
    sendInteractionSelector,
} from "@frak-labs/app-essentials";
import type { Page } from "@playwright/test";
import { RpcApi } from "tests/api/rpc.api";
import { encodeFunctionData, encodeFunctionResult, zeroAddress } from "viem";

/**
 * The calldata to search for when looking for the session status
 */
const interactionReadRequest = encodeFunctionData({
    abi: [getExecutionAbi],
    functionName: "getExecution",
    args: [sendInteractionSelector],
});

export class BlockchainHelper {
    private readonly rpcApi: RpcApi;

    constructor(page: Page) {
        this.rpcApi = new RpcApi(page);
    }

    /**
     * Mock an enabled user session for the duration of the test
     */
    async withEnabledSession() {
        await this.rpcApi.interceptEthCall(async (call) => {
            const callData = call.params[0].data;
            if (!callData) return;

            if (callData.startsWith(interactionReadRequest)) {
                return encodeFunctionResult({
                    abi: [getExecutionAbi],
                    functionName: "getExecution",
                    result: {
                        validAfter: 0,
                        // Session valid for 10min
                        validUntil: Math.round(Date.now() / 1000 + 600),
                        executor: addresses.interactionDelegatorAction,
                        validator: addresses.interactionDelegatorValidator,
                    },
                });
            }

            return undefined;
        });
    }

    /**
     * Mock an enabled user session for the duration of the test
     */
    async withDisabledSession() {
        await this.rpcApi.interceptEthCall(async (call) => {
            const callData = call.params[0].data;
            if (!callData) return;

            if (callData.startsWith(interactionReadRequest)) {
                return encodeFunctionResult({
                    abi: [getExecutionAbi],
                    functionName: "getExecution",
                    result: {
                        validAfter: 0,
                        validUntil: 0,
                        executor: zeroAddress,
                        validator: zeroAddress,
                    },
                });
            }

            return undefined;
        });
    }
}
