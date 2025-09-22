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

    async removeRpcRoute() {
        await this.page.unroute("https://erpc.gcp*.frak.id/nexus-rpc/evm/**/*");
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

            // Extract requests from body
            const requests = this.extractRequests(request);
            if (!requests) {
                return route.continue();
            }

            // Process handler and get mocks/transformers
            const { mocks, transformers } = await this.processHandler(
                handler,
                requests,
                route
            );

            if (!mocks.length && !transformers.length) {
                return route.continue();
            }

            // Handle the intercepted response
            return this.handleInterceptedResponse(
                route,
                requests,
                mocks,
                transformers
            );
        });
    }

    private extractRequests(
        request: ReturnType<Route["request"]>
    ): RpcRequest[] | null {
        const body = request.postDataJSON() as null | RpcRequest | RpcRequest[];
        if (!body) {
            return null;
        }

        return Array.isArray(body) ? body : [body];
    }

    private async processHandler(
        handler: (
            requests: RpcRequest[],
            route: Route
        ) =>
            | Promise<InterceptResult | MockedRpcRequest[]>
            | InterceptResult
            | MockedRpcRequest[],
        requests: RpcRequest[],
        route: Route
    ): Promise<{
        mocks: MockedRpcRequest[];
        transformers: ResponseTransformer[];
    }> {
        const result = await handler(requests, route);

        // Handle backward compatibility
        if (Array.isArray(result)) {
            return { mocks: result, transformers: [] };
        }

        return {
            mocks: result.mocks || [],
            transformers: result.transformers || [],
        };
    }

    private async handleInterceptedResponse(
        route: Route,
        requests: RpcRequest[],
        mocks: MockedRpcRequest[],
        transformers: ResponseTransformer[]
    ) {
        // Remove mocked payloads from the initial request
        const filteredRequests = requests.filter(
            (req) => !mocks.some((mock) => mock.request.id === req.id)
        );

        // If only mocks and no real requests, return mocked responses
        if (!filteredRequests.length && !transformers.length) {
            return route.fulfill({
                status: 200,
                body: JSON.stringify(mocks.map((mock) => mock.response)),
            });
        }

        // Get the real RPC response
        const rpcResponse = await route.fetch({
            postData: JSON.stringify(filteredRequests),
        });
        const responseBody = (await rpcResponse.json()) as
            | null
            | RpcResponse
            | RpcResponse[];

        // Build and transform responses
        let allResponses = this.buildResponseArray(responseBody);

        if (transformers.length > 0) {
            allResponses = await this.applyTransformers(
                allResponses,
                transformers,
                requests
            );
        }

        // Add mocked responses
        allResponses.push(...mocks.map((mock) => mock.response));

        return route.fulfill({
            status: 200,
            body: JSON.stringify(allResponses),
        });
    }

    private buildResponseArray(
        responseBody: null | RpcResponse | RpcResponse[]
    ): RpcResponse[] {
        return Array.isArray(responseBody)
            ? responseBody
            : responseBody
              ? [responseBody]
              : [];
    }

    private async applyTransformers(
        responses: RpcResponse[],
        transformers: ResponseTransformer[],
        originalRequests: RpcRequest[]
    ): Promise<RpcResponse[]> {
        return Promise.all(
            responses.map(async (response) => {
                const transformer = transformers.find((t) => {
                    const originalReq = originalRequests.find(
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

            // Process each request
            for (const request of requests) {
                const result = await this.processEthCallRequest(
                    request,
                    handler
                );
                if (result) {
                    if ("transform" in result) {
                        transformers.push(result);
                    } else {
                        mocks.push(result);
                    }
                }
            }

            return { mocks, transformers };
        });
    }

    private async processEthCallRequest(
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
    ): Promise<MockedRpcRequest | ResponseTransformer | null> {
        if (request.method !== "eth_call") {
            return null;
        }

        const calldata = request.params[0]?.data;
        if (!calldata) return null;

        // Check if this is an aggregate3 call
        if (calldata.startsWith("0x82ad56cb")) {
            const transformer = await this.createAggregate3Transformer(
                request,
                handler
            );
            return transformer || null;
        }

        // Handle regular eth_call
        const result = await handler(
            request as Extract<
                EIP1193Parameters<PublicRpcSchema>,
                { method: "eth_call" }
            >
        );

        if (!result) return null;

        return {
            request: request,
            response: {
                jsonrpc: "2.0",
                id: request.id?.toString(),
                result,
            },
        };
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
