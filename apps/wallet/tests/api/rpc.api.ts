import type { Page, Route } from "@playwright/test";
import {
    type EIP1193Parameters,
    type Hex,
    type PublicRpcSchema,
    decodeFunctionData,
    decodeFunctionResult,
    encodeFunctionResult,
    multicall3Abi,
} from "viem";

type RpcRequest = {
    jsonrpc?: "2.0" | undefined;
    method: string;
    // biome-ignore lint/suspicious/noExplicitAny: Generic params type for any rpc request
    params?: any | undefined;
    id?: number | undefined;
};

type RpcResponse = {
    jsonrpc: `${number}`;
    id: number | string | undefined;
} & ( // biome-ignore lint/suspicious/noExplicitAny: Generic params type for any rpc request
    | { method?: undefined; result: any; error?: undefined }
    // biome-ignore lint/suspicious/noExplicitAny: Generic params type for any rpc request
    | { method?: undefined; result?: undefined; error: any }
);

type MockedRpcRequest = {
    request: RpcRequest;
    response: RpcResponse;
};

type ResponseTransformer = {
    request: RpcRequest;
    transform: (response: RpcResponse) => RpcResponse | Promise<RpcResponse>;
};

type InterceptResult = {
    mocks: MockedRpcRequest[];
    transformers: ResponseTransformer[];
};

type Aggregate3Result = {
    success: boolean;
    returnData: Hex;
};

export class RpcApi {
    constructor(private readonly page: Page) {}

    private async interceptRpcRoute(handler: (route: Route) => void) {
        await this.page.route(
            "https://erpc.gcp*.frak.id/nexus-rpc/evm/**/*",
            handler
        );
    }

    /**
     * Helper to intercept an rpc request, even when requests are batched
     * @param handler
     */
    async interceptRpcRequest(
        handler: (
            requests: RpcRequest[],
            route: Route
        ) =>
            | Promise<InterceptResult | MockedRpcRequest[]>
            | InterceptResult
            | MockedRpcRequest[]
    ) {
        await this.interceptRpcRoute(async (route) => {
            const request = route.request();

            // Skip if that's not a post method
            if (request.method() !== "POST") {
                return route.continue();
            }

            // Extract the body
            const body = request.postDataJSON() as
                | null
                | RpcRequest
                | RpcRequest[];
            if (!body) {
                return route.continue();
            }

            // Check if that's an array or not
            const requests: RpcRequest[] = [];
            if (Array.isArray(body)) {
                requests.push(...body);
            } else {
                requests.push(body);
            }

            // Transmit that to the handler
            const result = await handler(requests, route);

            // Handle backward compatibility - if result is an array, treat it as mocks only
            let mocks: MockedRpcRequest[];
            let transformers: ResponseTransformer[] = [];

            if (Array.isArray(result)) {
                mocks = result;
            } else {
                mocks = result.mocks || [];
                transformers = result.transformers || [];
            }

            if (!mocks.length && !transformers.length) {
                return route.continue();
            }

            // Remove mocked payloads from the initial request
            const filteredRequests = requests.filter(
                (req) => !mocks.some((mock) => mock.request.id === req.id)
            );

            // If the filtered request is empty and no transformers, just output the response
            if (!filteredRequests.length && !transformers.length) {
                return route.fulfill({
                    status: 200,
                    body: JSON.stringify(mocks.map((mock) => mock.response)),
                });
            }

            // Otherwise, get the response from the RPC
            const rpcResponse = await route.fetch({
                postData: JSON.stringify(filteredRequests),
            });
            const responseBody = (await rpcResponse.json()) as
                | null
                | RpcResponse
                | RpcResponse[];

            // Build the response array
            let allResponses = Array.isArray(responseBody)
                ? responseBody
                : responseBody
                  ? [responseBody]
                  : [];

            // Apply transformers to matching responses
            if (transformers.length > 0) {
                allResponses = await Promise.all(
                    allResponses.map(async (response) => {
                        // Find transformer for this response
                        const transformer = transformers.find((t) => {
                            const originalReq = requests.find(
                                (r) => r.id === response.id
                            );
                            return originalReq?.id === t?.request?.id;
                        });

                        if (transformer) {
                            return await transformer.transform(response);
                        }
                        return response;
                    })
                );
            }

            // Add mocked responses
            allResponses.push(...mocks.map((mock) => mock.response));

            // And fulfill the request
            return route.fulfill({
                status: 200,
                body: JSON.stringify(allResponses),
            });
        });
    }

    async interceptEthCall(
        handler: (
            callRequest: Extract<
                EIP1193Parameters<PublicRpcSchema>,
                { method: "eth_call" }
            >
        ) => Promise<
            | Extract<
                  PublicRpcSchema[number],
                  { Method: "eth_call" }
              >["ReturnType"]
            | undefined
        >
    ) {
        return this.interceptRpcRequest(async (requests) => {
            const mocks: MockedRpcRequest[] = [];
            const transformers: ResponseTransformer[] = [];

            // Iterate over each request
            for (const request of requests) {
                if (request.method !== "eth_call") {
                    continue;
                }

                const calldata = request.params[0]?.data;
                if (!calldata) continue;

                // Check if this is an aggregate3 call
                if (calldata.startsWith("0x82ad56cb")) {
                    // For aggregate3, we'll use a response transformer
                    const transformer = await this.createAggregate3Transformer(
                        request,
                        handler
                    );

                    if (transformer) {
                        transformers.push(transformer);
                    }
                } else {
                    // Handle regular eth_call
                    const result = await handler(
                        request as Extract<
                            EIP1193Parameters<PublicRpcSchema>,
                            { method: "eth_call" }
                        >
                    );

                    if (result) {
                        mocks.push({
                            request: request,
                            response: {
                                jsonrpc: "2.0",
                                id: request.id?.toString(),
                                result,
                            },
                        });
                    }
                }
            }

            // Return the intercept result
            return { mocks, transformers };
        });
    }

    private async createAggregate3Transformer(
        request: RpcRequest,
        handler: (
            callRequest: Extract<
                EIP1193Parameters<PublicRpcSchema>,
                { method: "eth_call" }
            >
        ) => Promise<
            | Extract<
                  PublicRpcSchema[number],
                  { Method: "eth_call" }
              >["ReturnType"]
            | undefined
        >
    ): Promise<ResponseTransformer | undefined> {
        const calldata = request.params[0]?.data;
        if (!calldata) return undefined;

        // Decode the aggregate3 call
        const decoded = decodeFunctionData({
            abi: multicall3Abi,
            data: calldata,
        });

        if (decoded.functionName !== "aggregate3") {
            return undefined;
        }

        const calls = decoded.args[0];

        // Pre-process to find which calls we want to mock
        const mockIndices: Map<number, Hex> = new Map();

        for (let i = 0; i < calls.length; i++) {
            const call = calls[i];

            // Create a synthetic eth_call request for this sub-call
            const subCallRequest = {
                method: "eth_call",
                params: [
                    {
                        ...request.params[0], // Preserve other params like blockNumber
                        to: call.target,
                        data: call.callData,
                    },
                    request.params[1], // Block parameter
                ],
            } as Extract<
                EIP1193Parameters<PublicRpcSchema>,
                { method: "eth_call" }
            >;

            // Try to handle this sub-call with the handler
            const mockedResult = await handler(subCallRequest);

            if (mockedResult !== undefined) {
                mockIndices.set(i, mockedResult);
            }
        }

        // If no mocks, don't create a transformer
        if (mockIndices.size === 0) {
            return undefined;
        }

        // If all calls are mocked, we can return a full mock
        if (mockIndices.size === calls.length) {
            const results: Aggregate3Result[] = [];
            for (let i = 0; i < calls.length; i++) {
                const mockedData = mockIndices.get(i);
                if (mockedData) {
                    results[i] = {
                        success: true,
                        returnData: mockedData,
                    };
                }
            }

            // Return a transformer that replaces the entire response
            return {
                request,
                transform: (response) => ({
                    ...response,
                    result: encodeFunctionResult({
                        abi: multicall3Abi,
                        functionName: "aggregate3",
                        result: results,
                    }),
                }),
            };
        }

        // Otherwise, create a transformer that modifies the response
        return {
            request,
            transform: (response) => {
                if (!response.result || response.error) {
                    return response;
                }

                try {
                    // Decode the aggregate3 response
                    const decodedResponse = decodeFunctionResult({
                        abi: multicall3Abi,
                        functionName: "aggregate3",
                        data: response.result,
                    }) as Aggregate3Result[];

                    // Replace mocked indices
                    const modifiedResults = [...decodedResponse];
                    for (const [index, mockedData] of mockIndices) {
                        modifiedResults[index] = {
                            success: true,
                            returnData: mockedData,
                        };
                    }

                    // Re-encode the result
                    const newResult = encodeFunctionResult({
                        abi: multicall3Abi,
                        functionName: "aggregate3",
                        result: modifiedResults,
                    });

                    return {
                        ...response,
                        result: newResult,
                    };
                } catch (error) {
                    // If decoding fails, return original response
                    console.error(
                        "Failed to transform aggregate3 response:",
                        error
                    );
                    return response;
                }
            },
        };
    }
}
