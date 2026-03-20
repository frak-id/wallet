import { useMutation } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import {
    moneriumStore,
    selectAccessToken,
} from "@/module/monerium/store/moneriumStore";
import { placeOrder } from "@/module/monerium/utils/moneriumApi";
import { moneriumConfig } from "@/module/monerium/utils/moneriumConfig";
import { useMoneriumTokenRefresh } from "./useMoneriumClient";

function rfc3339(d: Date): string {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const tzOffset = (offset: number) => {
        if (offset === 0) return "Z";
        const sign = offset > 0 ? "-" : "+";
        const abs = Math.abs(offset);
        return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
    };

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tzOffset(d.getTimezoneOffset())}`;
}

function shortenIban(iban: string): string {
    const ns = iban.replace(/\s/g, "");
    return ns.length > 11
        ? `${ns.substring(0, 4)}...${ns.substring(ns.length - 4)}`
        : iban;
}

function buildPlaceOrderMessage(amount: string, iban: string): string {
    return `Send EUR ${amount} to ${shortenIban(iban)} at ${rfc3339(new Date())}`;
}

type PlaceOrderParams = {
    amount: string;
    iban: string;
};

function isSigningCancelledError(errorMessage: string): boolean {
    const normalizedMessage = errorMessage.toLowerCase();

    return ["rejected", "cancelled", "denied"].some((keyword) =>
        normalizedMessage.includes(keyword)
    );
}

function isNetworkError(errorMessage: string): boolean {
    const normalizedMessage = errorMessage.toLowerCase();

    return [
        "network",
        "failed to fetch",
        "network request failed",
        "load failed",
        "fetch failed",
    ].some((keyword) => normalizedMessage.includes(keyword));
}

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "string") {
        return error;
    }

    if (typeof error === "object" && error !== null) {
        const withMessage = error as { message?: unknown };
        if (typeof withMessage.message === "string") {
            return withMessage.message;
        }
    }

    return "Unknown error";
}

export function useMoneriumOfframp() {
    const { signMessageAsync } = useSignMessage();
    const { address: walletAddress } = useAccount();
    const accessToken = moneriumStore(selectAccessToken);
    const { isReady } = useMoneriumTokenRefresh();

    const mutation = useMutation({
        mutationFn: async ({ amount, iban }: PlaceOrderParams) => {
            if (!accessToken || !isReady) {
                throw new Error("Monerium is not ready");
            }

            if (!walletAddress) {
                throw new Error("Wallet is not connected");
            }

            const message = buildPlaceOrderMessage(amount, iban);

            try {
                const signature = await signMessageAsync({ message });

                return await placeOrder(accessToken, {
                    amount,
                    signature,
                    currency: "eur",
                    address: walletAddress,
                    chain: moneriumConfig.chain,
                    counterpart: {
                        identifier: {
                            standard: "iban",
                            iban,
                        },
                        details: {},
                    },
                    message,
                    memo: "Frak Wallet offramp",
                });
            } catch (error) {
                const errorMessage = extractErrorMessage(error);

                if (isSigningCancelledError(errorMessage)) {
                    throw new Error("Signature cancelled by user");
                }

                if (isNetworkError(errorMessage)) {
                    throw new Error("Connection failed, please retry");
                }

                throw new Error(errorMessage);
            }
        },
    });

    return {
        placeOrder: mutation.mutateAsync,
        isPending: mutation.isPending,
        isSuccess: mutation.isSuccess,
        isError: mutation.isError,
        error: mutation.error,
        reset: mutation.reset,
    };
}
