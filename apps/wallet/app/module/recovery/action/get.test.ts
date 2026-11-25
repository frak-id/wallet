import { BaseError, encodeFunctionResult, multicall3Abi } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentRecoveryOption } from "./get";

const rpc = vi.hoisted(() => ({
    reply: (_id: number): Response => new Response(null, { status: 500 }),
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const { createFakeRpcClient } = await import("@/tests/fakeRpcClient");
    return {
        ...(await importOriginal<typeof import("@frak-labs/wallet-shared")>()),
        currentViemClient: createFakeRpcClient((id) => rpc.reply(id)),
    };
});

const wallet = "0x1111111111111111111111111111111111111111";

const jsonRpcResult = (result: string) => (id: number) =>
    Response.json({ jsonrpc: "2.0", id, result });
const jsonRpcError = (code: number, message: string) => (id: number) =>
    Response.json({ jsonrpc: "2.0", id, error: { code, message } });
const multicallResult = (success: boolean) =>
    jsonRpcResult(
        encodeFunctionResult({
            abi: multicall3Abi,
            functionName: "aggregate3",
            result: [{ success, returnData: "0x" }],
        })
    );

describe("getCurrentRecoveryOption", () => {
    beforeEach(() => {
        rpc.reply = jsonRpcResult("0x");
    });

    it("reads a wallet with no contract code as having no recovery", async () => {
        rpc.reply = multicallResult(true);

        await expect(getCurrentRecoveryOption({ wallet })).resolves.toBeNull();
    });

    it("reads a getExecution revert as having no recovery", async () => {
        rpc.reply = multicallResult(false);

        await expect(getCurrentRecoveryOption({ wallet })).resolves.toBeNull();
    });

    it("fails instead of reporting no recovery on an RPC internal error", async () => {
        rpc.reply = jsonRpcError(-32603, "Internal error");

        await expect(
            getCurrentRecoveryOption({ wallet })
        ).rejects.toBeInstanceOf(BaseError);
    });

    it("fails instead of reporting no recovery when the RPC cannot be reached", async () => {
        rpc.reply = () => new Response("upstream down", { status: 503 });

        await expect(
            getCurrentRecoveryOption({ wallet })
        ).rejects.toBeInstanceOf(BaseError);
    });
});
