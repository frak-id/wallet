import { currentStablecoins } from "@frak-labs/app-essentials";
import {
    balanceKey,
    type RampSendRejection,
    recordError,
    trackEvent,
} from "@frak-labs/wallet-shared";
import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";
import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { erc20Abi, formatUnits, type Hex } from "viem";
import { useConfig, useConnection } from "wagmi";
import { readContract, writeContract } from "wagmi/actions";
import { useBiometricConfirm } from "@/module/biometrics";
import { getAmountBucket } from "@/module/monerium/utils/amountBucket";
import { isUserCancelledError } from "@/module/monerium/utils/moneriumErrors";
import {
    isRampSendError,
    parseRampSendRequest,
    type RampSendRequest,
} from "@/module/ramp/utils/parseRampSendRequest";

const rejectionKeys: Record<RampSendRejection, DefaultTranslationKey> = {
    unsupported_asset: "ramp.flow.send.errors.unsupportedAsset",
    invalid_address: "ramp.flow.send.errors.invalidAddress",
    invalid_amount: "ramp.flow.send.errors.invalidAmount",
    insufficient_balance: "ramp.flow.send.errors.insufficientBalance",
};

type SendRequestPayload = Parameters<typeof parseRampSendRequest>[0];

type SendCryptoCallback = (
    assetInfo: SendRequestPayload["assetInfo"],
    amount: string,
    address: string
) => Promise<{ txHash: Hex }>;

/** Turns a rejected payload into widget-facing copy, tracking the reason. */
function parseOrReject(
    payload: SendRequestPayload,
    expected: Parameters<typeof parseRampSendRequest>[1],
    t: TFunction
): RampSendRequest {
    try {
        return parseRampSendRequest(payload, expected);
    } catch (error) {
        if (!isRampSendError(error)) throw error;
        trackEvent("ramp_send_rejected", { reason: error.reason });
        throw new Error(t(rejectionKeys[error.reason]));
    }
}

/** Maps a failed transfer to widget-facing copy; real failures are recorded. */
function toSendError(error: unknown, t: TFunction): Error {
    const cancelled = isUserCancelledError(error);
    trackEvent("ramp_send_failed", { cancelled });
    if (!cancelled) recordError(error, { source: "ramp_offramp" });
    return new Error(
        t(
            cancelled
                ? "ramp.flow.send.errors.cancelled"
                : "ramp.flow.send.errors.generic"
        )
    );
}

/**
 * Answers the widget's SEND_CRYPTO request with a USDC transfer from the smart account.
 * Thrown messages are shown by the widget, so they are user-facing copy.
 */
export function useRampSendCrypto(
    onSent: (txHash: Hex) => void
): SendCryptoCallback {
    const config = useConfig();
    const queryClient = useQueryClient();
    const { address } = useConnection();
    const { t } = useTranslation();
    const { confirm } = useBiometricConfirm();

    return useCallback(
        async (assetInfo, amount, to) => {
            if (!address) throw new Error(t("ramp.flow.send.errors.generic"));
            const balance = await readContract(config, {
                address: currentStablecoins.usdc,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [address],
            });
            const request = parseOrReject(
                { assetInfo, amount, address: to },
                { token: currentStablecoins.usdc, balance },
                t
            );

            if (!(await confirm())) {
                trackEvent("ramp_send_failed", { cancelled: true });
                throw new Error(t("ramp.flow.send.errors.cancelled"));
            }

            let txHash: Hex;
            try {
                txHash = await writeContract(config, {
                    address: request.token,
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [request.to, request.amount],
                });
            } catch (error) {
                throw toSendError(error, t);
            }

            trackEvent("ramp_crypto_sent", {
                amount_bucket: getAmountBucket(
                    formatUnits(request.amount, assetInfo.decimals)
                ),
            });
            onSent(txHash);
            void queryClient.invalidateQueries({
                queryKey: balanceKey.baseKey,
            });
            return { txHash };
        },
        [address, config, confirm, onSent, queryClient, t]
    );
}
