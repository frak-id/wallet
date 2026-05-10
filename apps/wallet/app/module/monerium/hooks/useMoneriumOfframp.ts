import { useMutation } from "@tanstack/react-query";
import { useConnection, useSignMessage } from "wagmi";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { shortenIban } from "@/module/monerium/utils/maskIban";
import { placeOrder } from "@/module/monerium/utils/moneriumApi";
import { moneriumConfig } from "@/module/monerium/utils/moneriumConfig";

// Per Monerium docs, redeems ≥ €15,000 require a `supportingDocumentId`
// uploaded via POST /files (PDF/JPEG, ≤5MB). We don't yet have that flow,
// so we hard-cap here to keep transfers within the no-document tier.
export const MAX_REDEEM_AMOUNT_EUR = 15_000;

type PlaceOrderParams = {
    amount: string;
    iban: string;
    firstName: string;
    lastName: string;
    memo?: string;
};

function toFriendlyError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    if (/rejected|cancelled|denied/i.test(message)) {
        return new Error("Signature cancelled by user");
    }
    return error instanceof Error ? error : new Error(message);
}

export function useMoneriumOfframp() {
    const { mutateAsync: signMessageAsync } = useSignMessage();
    const { address: walletAddress } = useConnection();
    const accessToken = moneriumStore((s) => s.accessToken);

    const mutation = useMutation({
        mutationFn: async ({
            amount,
            iban,
            firstName,
            lastName,
            memo,
        }: PlaceOrderParams) => {
            if (!accessToken) throw new Error("Monerium is not ready");
            if (!walletAddress) throw new Error("Wallet is not connected");

            const numericAmount = Number.parseFloat(amount.replace(",", "."));
            if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                throw new Error("Invalid amount");
            }
            if (numericAmount >= MAX_REDEEM_AMOUNT_EUR) {
                throw new Error(
                    `Transfers of €${MAX_REDEEM_AMOUNT_EUR.toLocaleString("en-US")} or more require additional documentation.`
                );
            }

            // Per Monerium docs: "Send <CCY> <AMOUNT> to <IBAN> at <RFC3339>".
            // Timestamp must be UTC and accurate to the minute (zero seconds).
            const timestamp = new Date()
                .toISOString()
                .replace(/:\d{2}\.\d{3}Z$/, ":00Z");
            const message = `Send EUR ${amount} to ${shortenIban(iban)} at ${timestamp}`;

            try {
                const signature = await signMessageAsync({ message });
                return await placeOrder({
                    amount,
                    signature,
                    currency: "eur",
                    address: walletAddress,
                    chain: moneriumConfig.chain,
                    counterpart: {
                        identifier: { standard: "iban", iban },
                        details: {
                            firstName: firstName.trim(),
                            lastName: lastName.trim(),
                        },
                    },
                    message,
                    memo: memo?.trim() || "Frak Wallet offramp",
                });
            } catch (error) {
                throw toFriendlyError(error);
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
