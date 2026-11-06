import type { RampSendRejection } from "@frak-labs/wallet-shared";
import { type Address, isAddress, isAddressEqual, parseUnits } from "viem";

export type RampSendRequest = { token: Address; to: Address; amount: bigint };

export type RampSendError = Error & { reason: RampSendRejection };

export function createRampSendError(reason: RampSendRejection): RampSendError {
    const error = Object.assign(new Error(reason), { reason });
    error.name = "RampSendError";
    return error;
}

export function isRampSendError(error: unknown): error is RampSendError {
    return error instanceof Error && error.name === "RampSendError";
}

/** Ramp documents sale amounts in base units; a decimal string is parsed defensively. */
function parseAmount(amount: string, decimals: number): bigint | null {
    if (/^\d+$/.test(amount)) return BigInt(amount);
    if (/^\d+\.\d+$/.test(amount)) return parseUnits(amount, decimals);
    return null;
}

/** Validates the widget's SEND_CRYPTO payload before the wallet signs anything. */
export function parseRampSendRequest(
    request: {
        assetInfo: { address: string | null; decimals: number };
        amount: string;
        address: string;
    },
    expected: { token: Address; balance: bigint }
): RampSendRequest {
    const { assetInfo, amount, address } = request;
    if (
        !assetInfo.address ||
        !isAddress(assetInfo.address) ||
        !isAddressEqual(assetInfo.address, expected.token)
    ) {
        throw createRampSendError("unsupported_asset");
    }
    if (!isAddress(address)) throw createRampSendError("invalid_address");

    const parsed = parseAmount(amount, assetInfo.decimals);
    // Under one whole token means a unit mismatch: Ramp's floor is far above it.
    if (parsed === null || parsed < 10n ** BigInt(assetInfo.decimals)) {
        throw createRampSendError("invalid_amount");
    }
    if (parsed > expected.balance) {
        throw createRampSendError("insufficient_balance");
    }
    return { token: expected.token, to: address, amount: parsed };
}
