import type { SendTransactionModalStepType } from "@frak-labs/core-sdk";
import { DEEP_LINK_SCHEME } from "@frak-labs/core-sdk";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import {
    encodeWalletMulticall,
    HandleErrors,
    sessionStore,
    ua,
    useMountedTimeout,
} from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { useStore } from "zustand";
import { useDeepLinkFallback } from "@/module/hooks/useDeepLinkFallback";
import { AccordionTransactions } from "@/module/modal/component/Transaction/AccordionTransactions";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";
import styles from "./index.module.css";

const mobileWalletDeepLink = `${DEEP_LINK_SCHEME}wallet`;

/**
 * Transaction step modal — routes to desktop (direct WebAuthn) or mobile (distant-webauthn via deep link) flow
 */
export function TransactionModalStep({
    params,
    onFinish,
}: {
    params: SendTransactionModalStepType["params"];
    onFinish: (result: SendTransactionModalStepType["returns"]) => void;
}) {
    const { sendTransaction, isPending, isError, error } = useSendTransaction({
        mutation: {
            onSuccess: (hash) => {
                onFinish({ hash });
            },
        },
    });

    const { txs, toSendTx } = useMappedTx({ tx: params.tx });

    const sessionType = useStore(sessionStore, (s) => s.session?.type);
    const isMobilePairing = ua.isMobile && sessionType === "distant-webauthn";

    if (!(params && toSendTx)) {
        return null;
    }

    if (isMobilePairing) {
        return (
            <MobileTransactionStep
                txs={txs}
                toSendTx={toSendTx}
                sendTransaction={sendTransaction}
                isPending={isPending}
                isError={isError}
                error={error}
            />
        );
    }

    return (
        <DesktopTransactionStep
            txs={txs}
            toSendTx={toSendTx}
            sendTransaction={sendTransaction}
            isPending={isPending}
            isError={isError}
            error={error}
        />
    );
}

type TransactionStepProps = {
    txs: ReturnType<typeof useMappedTx>["txs"];
    toSendTx: NonNullable<ReturnType<typeof useMappedTx>["toSendTx"]>;
    sendTransaction: ReturnType<typeof useSendTransaction>["sendTransaction"];
    isPending: boolean;
    isError: boolean;
    error: Error | null;
};

function DesktopTransactionStep({
    txs,
    toSendTx,
    sendTransaction,
    isPending,
    isError,
    error,
}: TransactionStepProps) {
    const { t } = useListenerTranslation();

    return (
        <>
            <AccordionTransactions txs={txs} />

            <ButtonAuth
                size={"small"}
                width={"full"}
                disabled={isPending}
                onClick={() => {
                    sendTransaction(toSendTx);
                }}
            >
                {t("sdk.modal.sendTransaction.primaryAction", {
                    count: txs.length,
                })}
            </ButtonAuth>

            {isError && error && <HandleErrors error={error} />}
        </>
    );
}

function MobileTransactionStep({
    txs,
    toSendTx,
    sendTransaction,
    isPending,
    isError,
    error,
}: TransactionStepProps) {
    const { t } = useListenerTranslation();
    const [status, setStatus] = useState<"idle" | "waiting" | "timeout">(
        "idle"
    );
    const [appNotFound, setAppNotFound] = useState(false);
    const { startTimeout, clearTimeout: clearTxTimeout } = useMountedTimeout();
    const { emitRedirectWithFallback } = useDeepLinkFallback();
    const deepLinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isPendingRef = useRef(isPending);
    isPendingRef.current = isPending;

    useEffect(() => {
        return () => {
            if (deepLinkTimerRef.current) {
                clearTimeout(deepLinkTimerRef.current);
            }
        };
    }, []);

    const emitDeepLink = useCallback(() => {
        emitRedirectWithFallback(mobileWalletDeepLink, () => {
            setAppNotFound(true);
        });
    }, [emitRedirectWithFallback]);

    const triggerTransaction = useCallback(() => {
        setStatus("waiting");
        sendTransaction(toSendTx);

        // Delay deep link to let the WS signature request queue before browser context switches
        deepLinkTimerRef.current = setTimeout(emitDeepLink, 150);

        startTimeout(() => {
            if (!isPendingRef.current) return;
            setStatus("timeout");
        }, 30_000);
    }, [sendTransaction, toSendTx, emitDeepLink, startTimeout]);

    useEffect(() => {
        if (!isError && !isPending && status === "waiting") {
            clearTxTimeout();
        }
    }, [isPending, isError, status, clearTxTimeout]);

    if (appNotFound) {
        return (
            <div className={styles.mobileTx__appNotFound}>
                <p className={styles.mobileTx__appNotFoundText}>
                    {t("mobile-tx.appNotFound")}
                </p>
                <p className={styles.mobileTx__appNotFoundHint}>
                    {t("mobile-tx.appNotFoundHint")}
                </p>
                <button
                    type="button"
                    onClick={() => setAppNotFound(false)}
                    className={styles.mobileTx__retryButton}
                >
                    {t("mobile-tx.retry")}
                </button>
            </div>
        );
    }

    return (
        <>
            <AccordionTransactions txs={txs} />

            <ButtonAuth
                size={"small"}
                width={"full"}
                disabled={isPending}
                onClick={triggerTransaction}
            >
                {t("mobile-tx.sendTransaction")}
            </ButtonAuth>

            {/* Waiting state - show after user triggered tx + deep link */}
            {isPending && status === "waiting" && (
                <div className={styles.mobileTx__statusContainer}>
                    <p className={styles.mobileTx__statusText}>
                        {t("mobile-tx.waiting")}
                    </p>
                    <button
                        type="button"
                        onClick={emitDeepLink}
                        className={styles.mobileTx__reopenLink}
                    >
                        {t("mobile-tx.reopenWallet")}
                    </button>
                </div>
            )}

            {/* Timeout state */}
            {status === "timeout" && (
                <div className={styles.mobileTx__statusContainer}>
                    <p className={styles.mobileTx__timeoutText}>
                        {t("mobile-tx.timeout")}
                    </p>
                    <button
                        type="button"
                        onClick={triggerTransaction}
                        className={styles.mobileTx__retryButton}
                    >
                        {t("mobile-tx.retry")}
                    </button>
                </div>
            )}

            {isError && error && <HandleErrors error={error} />}
        </>
    );
}

function useMappedTx({
    tx,
}: {
    tx: SendTransactionModalStepType["params"]["tx"];
}) {
    const { address } = useAccount();

    return useMemo(() => {
        if (!tx || !address) {
            return {
                txs: [],
                toSendTx: undefined,
            };
        }

        // Case of a single tx
        if (!Array.isArray(tx)) {
            return {
                txs: [tx],
                toSendTx: { ...tx, value: tx.value ? BigInt(tx.value) : 0n },
            };
        }

        // Otherwise, prepare a batch call
        return {
            txs: tx,
            toSendTx: {
                to: address,
                value: 0n,
                data: encodeWalletMulticall(
                    tx.map((tx) => ({
                        to: tx.to,
                        data: tx.data ?? "0x",
                        value: tx.value ? BigInt(tx.value) : undefined,
                    }))
                ),
            },
        };
    }, [address, tx]);
}
