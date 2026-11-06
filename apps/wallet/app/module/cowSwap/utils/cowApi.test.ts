import { type Address, decodeFunctionData, erc20Abi, parseAbi } from "viem";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from "@/tests/vitest-fixtures";
import {
    buildPresignCalls,
    COW_SETTLEMENT,
    COW_VAULT_RELAYER,
    type CowQuote,
    fetchCowQuote,
    getMinBuyAmount,
    isCowApiError,
    postCowPresignOrder,
} from "./cowApi";

const EURE: Address = "0x0c06cCF38114ddfc35e07427B9424adcca9F44F8";
const USDC: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const OWNER: Address = "0x1111111111111111111111111111111111111111";

const quote: CowQuote = {
    id: 42,
    sellToken: EURE,
    buyToken: USDC,
    sellAmount: 99_000_000_000_000_000_000n,
    feeAmount: 1_000_000_000_000_000_000n,
    buyAmount: 111_000_000n,
    validTo: 1_800_000_000,
};

const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
    fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(body), { status })
    );
}

function sentBody(): Record<string, unknown> {
    return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe("cowApi", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => {
        fetchMock.mockReset();
        vi.unstubAllGlobals();
    });

    test("fetchCowQuote asks a presign sell quote and maps amounts to bigint", async () => {
        respond(200, {
            id: 7,
            quote: {
                sellToken: EURE,
                buyToken: USDC,
                sellAmount: "99",
                buyAmount: "110",
                feeAmount: "1",
                validTo: 123,
            },
        });

        const result = await fetchCowQuote({
            sellToken: EURE,
            buyToken: USDC,
            sellAmount: 100n,
            owner: OWNER,
        });

        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://api.cow.fi/arbitrum_one/api/v1/quote"
        );
        expect(sentBody()).toMatchObject({
            kind: "sell",
            sellAmountBeforeFee: "100",
            signingScheme: "presign",
            from: OWNER,
            receiver: OWNER,
        });
        expect(result).toEqual({
            id: 7,
            sellToken: EURE,
            buyToken: USDC,
            sellAmount: 99n,
            feeAmount: 1n,
            buyAmount: 110n,
            validTo: 123,
        });
    });

    test("an orderbook error keeps its CoW errorType", async () => {
        respond(404, { errorType: "NoLiquidity", description: "no route" });

        const error = await fetchCowQuote({
            sellToken: EURE,
            buyToken: USDC,
            sellAmount: 100n,
            owner: OWNER,
        }).catch((e: unknown) => e);

        expect(isCowApiError(error)).toBe(true);
        expect(error).toMatchObject({ status: 404, errorType: "NoLiquidity" });
    });

    test("getMinBuyAmount takes 0.5% slippage off the quoted output", () => {
        expect(getMinBuyAmount(quote)).toBe(110_445_000n);
    });

    test("postCowPresignOrder sells the full amount with no fee and the slipped minimum", async () => {
        respond(201, "0xabc");

        const uid = await postCowPresignOrder(quote, OWNER);

        expect(uid).toBe("0xabc");
        expect(sentBody()).toMatchObject({
            sellAmount: "100000000000000000000",
            buyAmount: "110445000",
            feeAmount: "0",
            signingScheme: "presign",
            signature: "0x",
            from: OWNER,
            receiver: OWNER,
            quoteId: 42,
            validTo: quote.validTo,
        });
    });

    test("buildPresignCalls approves the vault relayer then pre-signs the order", () => {
        const [approve, presign] = buildPresignCalls({
            sellToken: EURE,
            sellAmount: 100n,
            orderUid: "0xdeadbeef",
        });

        expect(approve.to).toBe(EURE);
        expect(
            decodeFunctionData({ abi: erc20Abi, data: approve.data })
        ).toEqual({
            functionName: "approve",
            args: [COW_VAULT_RELAYER, 100n],
        });
        expect(presign.to).toBe(COW_SETTLEMENT);
        expect(
            decodeFunctionData({
                abi: parseAbi([
                    "function setPreSignature(bytes orderUid, bool signed)",
                ]),
                data: presign.data,
            })
        ).toEqual({
            functionName: "setPreSignature",
            args: ["0xdeadbeef", true],
        });
    });
});
