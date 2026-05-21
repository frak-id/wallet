import {
    addresses,
    multiWebAuthNValidatorV2Abi,
} from "@frak-labs/app-essentials";
import type {
    MergePreviewResponse,
    MergeSettleResponse,
} from "@frak-labs/backend-elysia/api/schemas";
import {
    authenticatedWalletApi,
    authKey,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { encodeFunctionData, type Hex, keccak256, toHex } from "viem";
import { useSendTransaction } from "wagmi";
import { useSwitchAuthenticator } from "./useSwitchAuthenticator";

type UseMergeFinaliseArgs = {
    preview: MergePreviewResponse;
    /**
     * `session.authenticatorId` of the credential the user is currently
     * logged in with. Used together with the preview to pick the winner
     * credential id when a session switch is required.
     */
    currentAuthenticatorId: string;
    /**
     * The credential id of the *other* wallet — same value originally
     * passed to `/merge/preview` as `targetAuthenticatorId`. Comes from the
     * AssociateEmail conflict response.
     */
    targetAuthenticatorId: string;
    loserConsentSignature: string;
    /**
     * Pass a txHash from a previous attempt to skip the on-chain step on
     * retry. Lets `/merge/settle` failures (network blip, backend race)
     * resolve without forcing a second biometric prompt + userOp fee.
     */
    existingTxHash?: Hex;
};

export type MergeFinaliseResult = {
    onChainTxHash: Hex;
    settle: MergeSettleResponse;
};

/**
 * One-shot finaliser for the same-device wallet-merge flow.
 *
 * Flow inside the mutation:
 *  1. If the winner credential is not the live session, switch to it via
 *     {@link useSwitchAuthenticator}. The previous session stays parked in
 *     `sessionStore.previousSession` so popSession can restore it later.
 *  2. Build `addPassKey(authenticatorIdHash, x, y)` calldata and send it
 *     through wagmi's smart-account aware `useSendTransaction`. The wagmi
 *     connector follows the live session — once step 1 has flipped the
 *     session, the userOp is produced and signed from the **winner's**
 *     smart account context.
 *  3. POST the resulting `txHash` plus the `loserConsentSignature` to
 *     `/user/wallet/merge/settle`. The backend re-verifies the on-chain
 *     state, the consent assertion, and then repoints the binding +
 *     collapses the identity graphs.
 *  4. Pop the parked session back so the user lands on whichever wallet
 *     they started from. The backend resolves their credential via the
 *     binding from this point on; the popped session token stays valid
 *     even though the on-chain wallet for that credential has changed.
 *
 * Retry semantics: each step is independently idempotent server-side. The
 * caller can re-invoke the mutation with the prior `existingTxHash` to skip
 * the on-chain leg when only `/merge/settle` failed.
 */
export function useMergeFinaliseLocal() {
    const switchAuthenticator = useSwitchAuthenticator();
    const { sendTransactionAsync } = useSendTransaction();

    return useMutation<MergeFinaliseResult, Error, UseMergeFinaliseArgs>({
        mutationKey: authKey.merge.finalise,
        gcTime: 0,
        mutationFn: async ({
            preview,
            currentAuthenticatorId,
            targetAuthenticatorId,
            loserConsentSignature,
            existingTxHash,
        }) => {
            const currentSession = sessionStore.getState().session;
            if (!currentSession) {
                throw new Error("MERGE_FINALISE_NO_SESSION");
            }

            const requesterWins =
                preview.winner.toLowerCase() ===
                preview.requesterWallet.toLowerCase();
            const winnerAuthenticatorId = requesterWins
                ? currentAuthenticatorId
                : targetAuthenticatorId;
            const needsSwitch =
                currentSession.address.toLowerCase() !==
                preview.winner.toLowerCase();

            if (needsSwitch) {
                await switchAuthenticator.mutateAsync({
                    wallet: preview.winner,
                    authenticatorId: winnerAuthenticatorId,
                });
            }

            const onChainTxHash =
                existingTxHash ??
                (await sendAddPassKeyTx({
                    sendTransactionAsync,
                    loserAuthenticatorId: preview.loserAuthenticatorId,
                    loserPublicKey: preview.loserPublicKey,
                }));

            const { data, error } =
                await authenticatedWalletApi.merge.settle.post({
                    targetAuthenticatorId: preview.loserAuthenticatorId,
                    onChainTxHash,
                    loserConsentSignature,
                });
            if (error) {
                // Surface the network/backend error to the caller so the UI
                // can decide whether to retry — `/merge/settle` is
                // idempotent, retrying with the same txHash converges.
                throw new Error(extractSettleErrorCode(error.value));
            }

            // Restore the original session now that the merge is durably
            // applied server-side. No-op when we didn't push.
            sessionStore.getState().popSession();

            return { onChainTxHash, settle: data };
        },
    });
}

function extractSettleErrorCode(value: unknown): string {
    if (typeof value === "string") return value;
    if (
        value &&
        typeof value === "object" &&
        "code" in value &&
        typeof (value as { code: unknown }).code === "string"
    ) {
        return (value as { code: string }).code;
    }
    if (
        value &&
        typeof value === "object" &&
        "error" in value &&
        typeof (value as { error: unknown }).error === "string"
    ) {
        return (value as { error: string }).error;
    }
    return "MERGE_SETTLE_FAILED";
}

async function sendAddPassKeyTx({
    sendTransactionAsync,
    loserAuthenticatorId,
    loserPublicKey,
}: {
    sendTransactionAsync: ReturnType<
        typeof useSendTransaction
    >["sendTransactionAsync"];
    loserAuthenticatorId: string;
    loserPublicKey: { x: Hex; y: Hex };
}): Promise<Hex> {
    const data = encodeFunctionData({
        abi: multiWebAuthNValidatorV2Abi,
        functionName: "addPassKey",
        args: [
            keccak256(toHex(loserAuthenticatorId)),
            BigInt(loserPublicKey.x),
            BigInt(loserPublicKey.y),
        ],
    });
    return sendTransactionAsync({
        to: addresses.webAuthNValidator,
        data,
    });
}
