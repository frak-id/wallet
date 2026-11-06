import { type Address, encodeFunctionData, erc20Abi, type Hex } from "viem";

/** Same addresses on every chain CoW is deployed to. */
export const COW_SETTLEMENT: Address =
    "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";
export const COW_VAULT_RELAYER: Address =
    "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110";

/** CoW has no Arbitrum Sepolia orderbook, so swaps only run on Arbitrum One. */
const COW_API_BASE = "https://api.cow.fi/arbitrum_one/api/v1";

const COW_APP_DATA = JSON.stringify({
    appCode: "Frak Wallet",
    metadata: {},
    version: "1.3.0",
});

/** Stable-to-stable pair, so the default CoW slippage is plenty. */
export const COW_SLIPPAGE_BPS = 50n;

export type CowQuote = {
    id: number;
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    feeAmount: bigint;
    buyAmount: bigint;
    validTo: number;
};

export type CowOrderStatus =
    | "presignaturePending"
    | "open"
    | "fulfilled"
    | "cancelled"
    | "expired";

export type CowOrder = {
    uid: Hex;
    status: CowOrderStatus;
    executedBuyAmount: bigint;
};

export type CowApiError = Error & {
    status: number;
    /** CoW `errorType`, e.g. `NoLiquidity` or `SellAmountDoesNotCoverFee`. */
    errorType: string | null;
};

export function isCowApiError(error: unknown): error is CowApiError {
    return error instanceof Error && error.name === "CowApiError";
}

async function cowFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${COW_API_BASE}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = await response.json().catch(() => undefined);
    if (!response.ok) {
        const error: CowApiError = Object.assign(
            new Error(body?.description ?? `CoW API ${response.status}`),
            { status: response.status, errorType: body?.errorType ?? null }
        );
        error.name = "CowApiError";
        throw error;
    }
    return body as T;
}

type QuoteResponse = {
    id: number;
    quote: {
        sellToken: Address;
        buyToken: Address;
        sellAmount: string;
        buyAmount: string;
        feeAmount: string;
        validTo: number;
    };
};

/** Sell-side quote for an exact `sellAmount`, network costs included. */
export async function fetchCowQuote(params: {
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    owner: Address;
}): Promise<CowQuote> {
    const { id, quote } = await cowFetch<QuoteResponse>("/quote", {
        method: "POST",
        body: JSON.stringify({
            sellToken: params.sellToken,
            buyToken: params.buyToken,
            from: params.owner,
            receiver: params.owner,
            kind: "sell",
            sellAmountBeforeFee: params.sellAmount.toString(),
            signingScheme: "presign",
            onchainOrder: false,
            partiallyFillable: false,
            appData: COW_APP_DATA,
        }),
    });
    return {
        id,
        sellToken: params.sellToken,
        buyToken: params.buyToken,
        sellAmount: BigInt(quote.sellAmount),
        feeAmount: BigInt(quote.feeAmount),
        buyAmount: BigInt(quote.buyAmount),
        validTo: quote.validTo,
    };
}

/** Minimum the order accepts: the quoted output minus slippage. */
export function getMinBuyAmount(quote: CowQuote): bigint {
    return (quote.buyAmount * (10_000n - COW_SLIPPAGE_BPS)) / 10_000n;
}

/** Fee-less order (CoW takes network costs from the surplus), pre-signed on-chain afterwards. */
export async function postCowPresignOrder(
    quote: CowQuote,
    owner: Address
): Promise<Hex> {
    return cowFetch<Hex>("/orders", {
        method: "POST",
        body: JSON.stringify({
            sellToken: quote.sellToken,
            buyToken: quote.buyToken,
            receiver: owner,
            sellAmount: (quote.sellAmount + quote.feeAmount).toString(),
            buyAmount: getMinBuyAmount(quote).toString(),
            validTo: quote.validTo,
            appData: COW_APP_DATA,
            feeAmount: "0",
            kind: "sell",
            partiallyFillable: false,
            sellTokenBalance: "erc20",
            buyTokenBalance: "erc20",
            signingScheme: "presign",
            signature: "0x",
            from: owner,
            quoteId: quote.id,
        }),
    });
}

type OrderResponse = {
    uid: Hex;
    status: CowOrderStatus;
    executedBuyAmount: string;
};

export async function fetchCowOrder(uid: Hex): Promise<CowOrder> {
    const order = await cowFetch<OrderResponse>(`/orders/${uid}`);
    return {
        uid: order.uid,
        status: order.status,
        executedBuyAmount: BigInt(order.executedBuyAmount),
    };
}

const setPreSignatureAbi = [
    {
        type: "function",
        name: "setPreSignature",
        stateMutability: "nonpayable",
        inputs: [
            { name: "orderUid", type: "bytes" },
            { name: "signed", type: "bool" },
        ],
        outputs: [],
    },
] as const;

/** Approve then pre-sign, batched so the swap costs a single user operation. */
export function buildPresignCalls(params: {
    sellToken: Address;
    sellAmount: bigint;
    orderUid: Hex;
}): { to: Address; data: Hex }[] {
    return [
        {
            to: params.sellToken,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [COW_VAULT_RELAYER, params.sellAmount],
            }),
        },
        {
            to: COW_SETTLEMENT,
            data: encodeFunctionData({
                abi: setPreSignatureAbi,
                functionName: "setPreSignature",
                args: [params.orderUid, true],
            }),
        },
    ];
}
